import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { INITIAL_DATA } from "../data/initial-data.js";

const iconDirectory = fileURLToPath(new URL("../public/blueprint-icons/", import.meta.url));
const expectedCodes = Array.from({ length: 8 }, (_, rankIndex) =>
  Array.from({ length: 7 }, (_, categoryIndex) => `${rankIndex + 2}${categoryIndex + 1}`),
).flat();

test("56種類の初期アイコンが設計図コードと対応している", async () => {
  const filenames = (await readdir(iconDirectory)).filter((name) => name.endsWith(".webp")).sort();
  assert.deepEqual(filenames, expectedCodes.map((code) => `${code}.webp`));
  assert.deepEqual(
    INITIAL_DATA.items.map((item) => item.defaultIconPath).sort(),
    expectedCodes.map((code) => `./blueprint-icons/${code}.webp`).sort(),
  );
});

test("すべての初期アイコンがWebPファイルとして読み取れる", async () => {
  for (const code of expectedCodes) {
    const bytes = await readFile(new URL(`../public/blueprint-icons/${code}.webp`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${code}.webp RIFF header`);
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${code}.webp WEBP header`);
  }
});
