export const CATEGORY_ORDER = Object.freeze(["鎧", "ネックレス", "帽子", "リング", "ブーツ", "剣", "杖"]);

function normalizedCategory(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function deriveItemName({ rank, category }) {
  const rankLabel = Number.isInteger(rank) && rank > 0 ? `ランク${rank}` : "ランク未設定";
  return `${rankLabel} ${normalizedCategory(category) || "分類未設定"}`;
}

export function deriveStageName({ chapter, number }) {
  if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(number) || number < 1) return "番号未設定";
  return `${chapter}-${number}`;
}

function compareCategories(a, b) {
  const aCategory = normalizedCategory(a);
  const bCategory = normalizedCategory(b);
  const aIndex = CATEGORY_ORDER.indexOf(aCategory);
  const bIndex = CATEGORY_ORDER.indexOf(bCategory);
  const normalizedAIndex = aIndex < 0 ? CATEGORY_ORDER.length : aIndex;
  const normalizedBIndex = bIndex < 0 ? CATEGORY_ORDER.length : bIndex;
  return normalizedAIndex - normalizedBIndex || aCategory.localeCompare(bCategory, "ja");
}

export function compareItems(a, b) {
  const aIncomplete = !Number.isInteger(a.rank) || a.rank < 1 || !normalizedCategory(a.category);
  const bIncomplete = !Number.isInteger(b.rank) || b.rank < 1 || !normalizedCategory(b.category);
  if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
  if (a.rank !== b.rank) return (b.rank ?? 0) - (a.rank ?? 0);
  return compareCategories(a.category, b.category) || String(a.id).localeCompare(String(b.id), "ja");
}

export function compareStages(a, b) {
  const aIncomplete = !Number.isInteger(a.chapter) || !Number.isInteger(a.number);
  const bIncomplete = !Number.isInteger(b.chapter) || !Number.isInteger(b.number);
  if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
  return (
    (b.chapter ?? 0) - (a.chapter ?? 0) ||
    (b.number ?? 0) - (a.number ?? 0) ||
    String(a.id).localeCompare(String(b.id), "ja")
  );
}

export function itemIdentityKey(item) {
  return `${Number.isInteger(item?.rank) ? item.rank : ""}\u0000${normalizedCategory(item?.category)}`;
}

export function stageIdentityKey(stage) {
  return `${Number.isInteger(stage?.chapter) ? stage.chapter : ""}\u0000${Number.isInteger(stage?.number) ? stage.number : ""}`;
}
