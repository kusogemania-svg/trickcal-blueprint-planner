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

// ランク別装備表に記載された、6部位それぞれの必要個数を使用する。
export const EQUIPMENT_TEMPLATES = Object.freeze([
  makeTemplate(9, "physical", [
    { rank: 9, quantity: 52 },
    { rank: 8, quantity: 20 },
  ]),
  makeTemplate(9, "magic", [
    { rank: 9, quantity: 52 },
    { rank: 8, quantity: 20 },
  ]),
  makeTemplate(8, "physical", [
    { rank: 8, quantity: 46 },
    { rank: 7, quantity: 18 },
  ]),
  makeTemplate(8, "magic", [
    { rank: 8, quantity: 46 },
    { rank: 7, quantity: 18 },
  ]),
  makeTemplate(7, "physical", [{ rank: 7, quantity: 42 }]),
  makeTemplate(7, "magic", [{ rank: 7, quantity: 42 }]),
  makeTemplate(6, "physical", [
    { rank: 6, quantity: 36 },
    { rank: 5, quantity: 14 },
  ]),
  makeTemplate(6, "magic", [
    { rank: 6, quantity: 36 },
    { rank: 5, quantity: 14 },
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
