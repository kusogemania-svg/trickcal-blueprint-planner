import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_DATA } from "../data/initial-data.js";
import { createBackup, parseBackup } from "../src/core/backup.js";

test("バックアップを書き出して同じマスターデータへ復元できる", () => {
  const backup = createBackup(INITIAL_DATA);
  const restored = parseBackup(JSON.stringify(backup));
  assert.deepEqual(restored, INITIAL_DATA);
});

test("不正なバックアップを拒否する", () => {
  assert.throws(() => parseBackup('{"schemaVersion":99,"items":[],"stages":[]}'), /対応していない/);
});
