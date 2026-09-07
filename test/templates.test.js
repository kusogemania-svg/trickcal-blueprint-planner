import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_DATA } from "../data/initial-data.js";
import { EQUIPMENT_TEMPLATES, resolveEquipmentTemplate } from "../src/core/templates.js";

test("ランク8から4まで物理・魔法の10テンプレートを定義する", () => {
  assert.deepEqual(
    EQUIPMENT_TEMPLATES.map((template) => template.label),
    [
      "ランク8 物理",
      "ランク8 魔法",
      "ランク7 物理",
      "ランク7 魔法",
      "ランク6 物理",
      "ランク6 魔法",
      "ランク5 物理",
      "ランク5 魔法",
      "ランク4 物理",
      "ランク4 魔法",
    ],
  );
});

test("ランク7物理はランク8を18個、ランク7を42個ずつ選ぶ", () => {
  const resolved = resolveEquipmentTemplate("rank-7-physical", INITIAL_DATA.items);
  assert.deepEqual(resolved.missing, []);
  assert.equal(resolved.requests.length, 12);

  const selectedItems = resolved.requests.map((request) => ({
    ...request,
    item: INITIAL_DATA.items.find((item) => item.id === request.itemId),
  }));
  assert.ok(selectedItems.every((entry) => entry.item.category !== "杖"));
  assert.equal(selectedItems.filter((entry) => entry.item.rank === 8 && entry.quantity === 18).length, 6);
  assert.equal(selectedItems.filter((entry) => entry.item.rank === 7 && entry.quantity === 42).length, 6);
});

test("物理と魔法は剣と杖だけが異なる", () => {
  const physical = resolveEquipmentTemplate("rank-5-physical", INITIAL_DATA.items);
  const magic = resolveEquipmentTemplate("rank-5-magic", INITIAL_DATA.items);
  const toIdentity = (resolved) =>
    new Set(
      resolved.requests.map((request) => {
        const item = INITIAL_DATA.items.find((entry) => entry.id === request.itemId);
        return `${item.rank}-${item.category}-${request.quantity}`;
      }),
    );
  const physicalIdentities = toIdentity(physical);
  const magicIdentities = toIdentity(magic);
  const physicalOnly = [...physicalIdentities].filter((entry) => !magicIdentities.has(entry));
  const magicOnly = [...magicIdentities].filter((entry) => !physicalIdentities.has(entry));

  assert.deepEqual(physicalOnly, ["6-剣-14", "5-剣-30"]);
  assert.deepEqual(magicOnly, ["6-杖-14", "5-杖-30"]);
});

test("必要な設計図が削除されたテンプレートは不足を返す", () => {
  const itemsWithoutRank8Armor = INITIAL_DATA.items.filter((item) => !(item.rank === 8 && item.category === "鎧"));
  const resolved = resolveEquipmentTemplate("rank-8-physical", itemsWithoutRank8Armor);
  assert.deepEqual(resolved.missing, [{ rank: 8, category: "鎧" }]);
});
