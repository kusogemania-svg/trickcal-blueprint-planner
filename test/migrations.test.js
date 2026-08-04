import test from "node:test";
import assert from "node:assert/strict";
import { migrateKnownNames } from "../src/core/migrations.js";

test("保存済みの初期設計図名を新しい表記へ移行する", () => {
  const oldData = {
    schemaVersion: 1,
    items: [
      { id: "item-83", code: "83", name: "ランク8 煌めく装飾品の設計図", category: "煌めく装飾品" },
      { id: "item-75", code: "75", name: "ランク7 華麗な装飾品の欠片", category: "華麗な装飾品" },
    ],
    stages: [],
  };

  const migrated = migrateKnownNames(oldData);
  assert.equal(migrated.changed, true);
  assert.deepEqual(
    migrated.data.items.map((item) => [item.name, item.category]),
    [
      ["ランク8 リング", "リング"],
      ["ランク7 ネックレス", "ネックレス"],
    ],
  );
});

test("利用者が追加した設計図名は変更しない", () => {
  const customData = {
    schemaVersion: 1,
    items: [{ id: "custom", code: null, name: "記念品の設計図", category: "華麗な装飾品" }],
    stages: [],
  };
  const migrated = migrateKnownNames(customData);
  assert.equal(migrated.changed, false);
  assert.deepEqual(migrated.data, customData);
});
