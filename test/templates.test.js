import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_DATA } from "../data/initial-data.js";
import { EQUIPMENT_TEMPLATES, resolveEquipmentTemplate } from "../src/core/templates.js";

test("ランク9から6まで物理・魔法の8テンプレートを定義する", () => {
  assert.deepEqual(
    EQUIPMENT_TEMPLATES.map((template) => template.label),
    [
      "ランク9 物理",
      "ランク9 魔法",
      "ランク8 物理",
      "ランク8 魔法",
      "ランク7 物理",
      "ランク7 魔法",
      "ランク6 物理",
      "ランク6 魔法",
    ],
  );
});

test("画像のランク別必要数を各6部位へ設定する", () => {
  const expected = new Map([
    ["rank-9-physical", [[9, 52], [8, 20]]],
    ["rank-8-physical", [[8, 46], [7, 18]]],
    ["rank-7-physical", [[7, 42]]],
    ["rank-6-physical", [[6, 36], [5, 14]]],
  ]);

  for (const [templateId, rankQuantities] of expected) {
    const resolved = resolveEquipmentTemplate(templateId, INITIAL_DATA.items);
    assert.deepEqual(resolved.missing, []);
    assert.equal(resolved.requests.length, rankQuantities.length * 6);
    for (const [rank, quantity] of rankQuantities) {
      const matches = resolved.requests.filter((request) => {
        const item = INITIAL_DATA.items.find((entry) => entry.id === request.itemId);
        return item.rank === rank && request.quantity === quantity;
      });
      assert.equal(matches.length, 6, `${templateId}: ランク${rank}を各${quantity}個`);
    }
  }
});

test("ランク8物理は杖を含まず、ランク8と7の12設計図を選ぶ", () => {
  const resolved = resolveEquipmentTemplate("rank-8-physical", INITIAL_DATA.items);
  assert.deepEqual(resolved.missing, []);
  assert.equal(resolved.requests.length, 12);

  const selectedItems = resolved.requests.map((request) => ({
    ...request,
    item: INITIAL_DATA.items.find((item) => item.id === request.itemId),
  }));
  assert.ok(selectedItems.every((entry) => entry.item.category !== "杖"));
  assert.equal(selectedItems.filter((entry) => entry.item.rank === 8 && entry.quantity === 46).length, 6);
  assert.equal(selectedItems.filter((entry) => entry.item.rank === 7 && entry.quantity === 18).length, 6);
});

test("物理と魔法は剣と杖だけが異なる", () => {
  const physical = resolveEquipmentTemplate("rank-9-physical", INITIAL_DATA.items);
  const magic = resolveEquipmentTemplate("rank-9-magic", INITIAL_DATA.items);
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

  assert.deepEqual(physicalOnly, ["9-剣-52", "8-剣-20"]);
  assert.deepEqual(magicOnly, ["9-杖-52", "8-杖-20"]);
});

test("必要な設計図が削除されたテンプレートは不足を返す", () => {
  const itemsWithoutRank8Armor = INITIAL_DATA.items.filter((item) => !(item.rank === 8 && item.category === "鎧"));
  const resolved = resolveEquipmentTemplate("rank-8-physical", itemsWithoutRank8Armor);
  assert.deepEqual(resolved.missing, [{ rank: 8, category: "鎧" }]);
});
