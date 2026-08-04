import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMasterData } from "../src/core/migrations.js";

test("保存済みの初期設計図名を新しい表記へ移行する", () => {
  const oldData = {
    schemaVersion: 1,
    items: [
      { id: "item-83", code: "83", name: "ランク8 煌めく装飾品の設計図", rank: 8, category: "煌めく装飾品" },
      { id: "item-75", code: "75", name: "ランク7 華麗な装飾品の欠片", rank: 7, category: "華麗な装飾品" },
    ],
    stages: [{ id: "old-stage", name: "12-3", drops: [] }],
  };

  const migrated = normalizeMasterData(oldData);
  assert.equal(migrated.changed, true);
  assert.deepEqual(
    migrated.data.items.map((item) => [item.name, item.category]),
    [
      ["ランク8 リング", "リング"],
      ["ランク7 ネックレス", "ネックレス"],
    ],
  );
  assert.deepEqual(
    migrated.data.items.map((item) => item.defaultIconPath),
    ["./blueprint-icons/83.webp", "./blueprint-icons/75.webp"],
  );
  assert.deepEqual(
    [migrated.data.stages[0].chapter, migrated.data.stages[0].number, migrated.data.stages[0].name],
    [12, 3, "12-3"],
  );
});

test("利用者が追加した設計図もランクと分類から名称を生成する", () => {
  const customData = {
    schemaVersion: 1,
    items: [{ id: "custom", code: null, name: "自由入力名", rank: 11, category: "剣" }],
    stages: [],
  };
  const migrated = normalizeMasterData(customData);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.data.items[0].name, "ランク11 剣");
});
