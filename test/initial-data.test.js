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
