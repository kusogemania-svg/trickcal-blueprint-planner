// 本番ビルドに対するモバイルUI回帰チェック。
// PLAYWRIGHT_MODULE_PATHで外部のPlaywrightを指定可能。Edgeをヘッドレスで使用。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
    assert.ok(file.startsWith(root));
    const mime = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };
    response.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let workers = 0;
  page.on("worker", () => workers++);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator("[data-open-selector]").tap();
  const choice = page.locator('[data-select-item="item-61"]');
  await choice.scrollIntoViewIfNeeded();
  const beforeScroll = await page.locator(".selector-sheet").evaluate((el) => el.scrollTop);
  assert.ok(beforeScroll > 0);
  await choice.tap();
  assert.equal(await page.locator(".selector-sheet").evaluate((el) => el.scrollTop), beforeScroll);
  await choice.tap();
  assert.equal(await page.locator(".selector-sheet").evaluate((el) => el.scrollTop), beforeScroll);
  assert.equal(await page.locator(".item-choice.selected").count(), 0);
  console.log("PASS: 選択・解除でスクロール維持");

  await page.locator("[data-template-selection]").selectOption("rank-8-physical");
  await page.locator("[data-confirm-selection]").tap();
  await page.locator("#calculation-result").waitFor();
  assert.equal(workers, 1);
  const ids = await page.locator("[data-quantity-id]").evaluateAll((inputs) => inputs.map((input) => input.dataset.quantityId));
  assert.deepEqual(ids, ["item-81", "item-71", "item-85", "item-75", "item-82", "item-72", "item-83", "item-73", "item-84", "item-74", "item-86", "item-76"]);
  console.log("PASS: テンプレート確定で自動計算・入力一覧は部位→ランク降順");

  const input = page.locator('[data-quantity-id="item-81"]');
  await input.tap();
  assert.deepEqual(await input.evaluate((el) => [el.selectionStart, el.selectionEnd]), [0, 2]);
  await page.keyboard.insertText("4");
  await page.keyboard.insertText("2");
  assert.equal(await input.inputValue(), "42");
  assert.equal(await page.locator("#calculation-result").count(), 0);
  await page.waitForTimeout(300);
  assert.equal(workers, 1);
  await page.locator("[data-calculate]").tap();
  await page.locator("#calculation-result").waitFor();
  assert.equal(workers, 2);
  assert.match(await page.locator("tbody tr").filter({ hasText: "ランク8 鎧" }).innerText(), /42/);
  console.log("PASS: 必要数の全選択・42の連続入力・手動計算");

  await page.locator("[data-open-selector]").tap();
  const choiceIds = await page.locator("[data-select-item]").evaluateAll((buttons) => buttons.slice(0, 8).map((button) => button.dataset.selectItem));
  assert.deepEqual(choiceIds, ["item-91", "item-95", "item-92", "item-93", "item-94", "item-96", "item-97", "item-81"]);
  await page.locator('[data-select-item="item-91"]').tap();
  await page.locator("[data-confirm-selection]").tap();
  const blank = page.locator('[data-quantity-id="item-91"]');
  assert.equal(await blank.inputValue(), "");
  assert.ok(await page.locator("[data-calculate]").isDisabled());
  await blank.tap();
  await page.keyboard.insertText("12");
  assert.ok(await page.locator("[data-calculate]").isEnabled());
  await page.waitForTimeout(300);
  assert.equal(workers, 2);
  await blank.fill("0");
  assert.ok(await page.locator("[data-calculate]").isDisabled());
  await page.locator('[data-remove-request="item-91"]').tap();
  assert.ok(await page.locator("[data-calculate]").isEnabled());
  assert.equal(workers, 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log("PASS: 選択画面の順序維持・個別追加/削除は手動計算・入力検証・横はみ出しなし");
  await page.reload();
  await page.locator("[data-open-selector]").tap();
  await page.locator("[data-template-selection]").selectOption("rank-9-physical");
  await page.locator("[data-confirm-selection]").tap();
  await page.locator("#calculation-result").waitFor({ timeout: 2000 });
  assert.equal(await page.locator(".total-runs strong").innerText(), "312");
  assert.equal(await page.locator(".calculation-status").count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: ランク9物理の確定後に312周の結果を表示");
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
