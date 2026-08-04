import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_DATA } from "../data/initial-data.js";
import { validateMasterData } from "../src/core/validator.js";

test("初期データは280ステージ・56設計図で整合している", () => {
  assert.equal(INITIAL_DATA.stages.length, 280);
  assert.equal(INITIAL_DATA.items.length, 56);
  assert.deepEqual(validateMasterData(INITIAL_DATA), { valid: true, errors: [] });
});

test("重複していた10-5は2ドロップの1ステージに正規化される", () => {
  const stage = INITIAL_DATA.stages.find((entry) => entry.name === "10-5");
  assert.ok(stage);
  assert.deepEqual(stage.drops, [
    { itemId: "item-33", quantity: 1 },
    { itemId: "item-46", quantity: 1 },
  ]);
});

test("副産物のないWiki行は1ドロップとして保持される", () => {
  const stage = INITIAL_DATA.stages.find((entry) => entry.name === "8-10");
  assert.deepEqual(stage.drops, [{ itemId: "item-34", quantity: 1 }]);
});

test("初期設計図は短縮した分類名と名称を使用する", () => {
  const categories = new Set(INITIAL_DATA.items.map((item) => item.category));
  assert.ok(categories.has("リング"));
  assert.ok(categories.has("ネックレス"));
  assert.ok(categories.has("剣"));
  assert.ok(categories.has("杖"));
  assert.ok(INITIAL_DATA.items.every((item) => !/の(?:設計図|欠片)$/.test(item.name)));
});

test("設計図とステージの重複を検出する", () => {
  const duplicateItemData = structuredClone(INITIAL_DATA);
  duplicateItemData.items.push({ ...duplicateItemData.items[0], id: "duplicate-item" });
  assert.match(validateMasterData(duplicateItemData).errors.join("\n"), /ランクと装備分類.*重複/);

  const duplicateStageData = structuredClone(INITIAL_DATA);
  duplicateStageData.stages.push({ ...duplicateStageData.stages[0], id: "duplicate-stage" });
  assert.match(validateMasterData(duplicateStageData).errors.join("\n"), /章番号とステージ番号.*重複/);
});
