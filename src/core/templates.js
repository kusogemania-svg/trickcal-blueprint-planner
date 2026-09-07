const COMMON_CATEGORIES = Object.freeze(["鎧", "ネックレス", "帽子", "リング", "ブーツ"]);

function makeTemplate(rank, type, quantities) {
  const weaponCategory = type === "physical" ? "剣" : "杖";
  const typeLabel = type === "physical" ? "物理" : "魔法";
  return Object.freeze({
    id: `rank-${rank}-${type}`,
    label: `ランク${rank} ${typeLabel}`,
    quantities: Object.freeze(quantities.map((entry) => Object.freeze({ ...entry }))),
    categories: Object.freeze([...COMMON_CATEGORIES, weaponCategory]),
  });
}

// Wikiの「周回ステージ例 > 組み合わせ例」に併記された必要個数を使用する。
export const EQUIPMENT_TEMPLATES = Object.freeze([
  makeTemplate(8, "physical", [{ rank: 8, quantity: 46 }]),
  makeTemplate(8, "magic", [{ rank: 8, quantity: 46 }]),
  makeTemplate(7, "physical", [
    { rank: 8, quantity: 18 },
    { rank: 7, quantity: 42 },
  ]),
  makeTemplate(7, "magic", [
    { rank: 8, quantity: 18 },
    { rank: 7, quantity: 42 },
  ]),
  makeTemplate(6, "physical", [{ rank: 6, quantity: 36 }]),
  makeTemplate(6, "magic", [{ rank: 6, quantity: 36 }]),
  makeTemplate(5, "physical", [
    { rank: 6, quantity: 14 },
    { rank: 5, quantity: 30 },
  ]),
  makeTemplate(5, "magic", [
    { rank: 6, quantity: 14 },
    { rank: 5, quantity: 30 },
  ]),
  makeTemplate(4, "physical", [
    { rank: 5, quantity: 12 },
    { rank: 4, quantity: 20 },
  ]),
  makeTemplate(4, "magic", [
    { rank: 5, quantity: 12 },
    { rank: 4, quantity: 20 },
  ]),
]);

export function resolveEquipmentTemplate(templateId, items) {
  const template = EQUIPMENT_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) return null;

  const requests = [];
  const missing = [];
  for (const quantityEntry of template.quantities) {
    for (const category of template.categories) {
      const item = items.find((entry) => entry.rank === quantityEntry.rank && entry.category === category);
      if (item) requests.push({ itemId: item.id, quantity: quantityEntry.quantity });
      else missing.push({ rank: quantityEntry.rank, category });
    }
  }

  return { template, requests, missing };
}
