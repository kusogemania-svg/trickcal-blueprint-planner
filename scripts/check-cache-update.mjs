import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const base = "/trickcal-blueprint-planner/";
const index = await readFile(resolve(root, "index.html"), "utf8");
const css = await readFile(resolve(root, "src/styles.css"), "utf8");
const legacyCss = css.replace("padding-inline: 12px; background: var(--green)", "padding-inline: 12px; background: var(--orange)");
// 以前のcache-first動作を再現する固定fixture。
const legacyWorker = `
const CACHE = 'trickcal-blueprint-legacy-test';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', './index.html', './src/styles.css']))); self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))));
`;
let release = "legacy";
let servedCss = css;
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    assert.ok(path.startsWith(base));
    const relative = path.slice(base.length) || "index.html";
    const file = resolve(root, relative);
    assert.ok(file.startsWith(root));
    const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };
    response.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
    response.setHeader("Cache-Control", relative === "service-worker.js" ? "no-cache" : "max-age=3600");
    if (relative === "index.html") response.end(release === "legacy" ? index.replace(/styles\.css\?v=[^"]+/, "styles.css") : index);
    else if (relative === "src/styles.css") response.end(release === "legacy" ? legacyCss : servedCss);
    else if (relative === "service-worker.js" && release === "legacy") response.end(legacyWorker);
    else response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  const url = `http://127.0.0.1:${server.address().port}${base}`;
  const color = () => page.locator("[data-open-selector]").evaluate((button) => getComputedStyle(button).backgroundColor);
  await page.goto(url);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.reload();
  assert.equal(await color(), "rgb(244, 165, 58)");
  await page.evaluate(async () => {
    const { createInitialData } = await import('./data/initial-data.js');
    const { saveMasterData } = await import('./src/core/storage.js');
    const data = createInitialData();
    data.source.name = 'cache-update-preserved-data';
    await saveMasterData(data);
  });
  release = "current";
  await page.goto(url + "?refresh=green");
  assert.equal(await color(), "rgb(40, 133, 108)");
  let updated = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    updated = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !(await caches.keys()).includes('trickcal-blueprint-legacy-test') &&
        registration.active?.state === 'activated' && registration.active === navigator.serviceWorker.controller;
    });
    if (updated) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.equal(updated, true);
  console.log("PASS: 旧オレンジ色キャッシュから更新リンクで緑色へ移行");

  servedCss = css.replace("--green: #28856c", "--green: #0066ff");
  await page.reload();
  assert.equal(await color(), "rgb(0, 102, 255)");
  servedCss = css;
  await page.reload();
  assert.equal(await color(), "rgb(40, 133, 108)");
  console.log("PASS: 同一URLの再読み込みでもネットワークの最新CSSを反映");

  await context.setOffline(true);
  await page.reload();
  assert.equal(await color(), "rgb(40, 133, 108)");
  assert.equal(await page.evaluate(async () => {
    const { loadMasterData } = await import('./src/core/storage.js');
    return (await loadMasterData()).source.name;
  }), "cache-update-preserved-data");
  console.log("PASS: オフライン時も緑色を表示・編集済みマスターデータ保持");
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
