import { INITIAL_DATA } from "../../data/initial-data.js";
import { compareItems, compareStages, deriveItemName, deriveStageName, itemIdentityKey, stageIdentityKey } from "./catalog.js";

const CATEGORY_RENAMES = Object.freeze({
  煌めく装飾品: "リング",
  華麗な装飾品: "ネックレス",
  物理武器: "剣",
  魔法武器: "杖",
});

function reserveId(id, usedIds) {
  let available = id;
  for (let suffix = 2; usedIds.has(available); suffix += 1) available = `${id}-${suffix}`;
  usedIds.add(available);
  return available;
}

export function addRank10Catalog(data) {
  if ((data.catalogRevision ?? 0) >= 1) return { data, changed: false };

  const items = [...data.items];
  const stages = [...data.stages];
  const itemsByIdentity = new Map(items.map((item) => [itemIdentityKey(item), item]));
  const itemIds = new Set(items.map((item) => item.id));
  const stageIds = new Set(stages.map((stage) => stage.id));
  const stageKeys = new Set(stages.map(stageIdentityKey));
  const mappedItemIds = new Map();
  for (const item of INITIAL_DATA.items) {
    const existing = itemsByIdentity.get(itemIdentityKey(item));
    if (existing) {
      mappedItemIds.set(item.id, existing.id);
    } else if (item.rank === 10) {
      const added = { ...item, id: reserveId(item.id, itemIds) };
      items.push(added);
      mappedItemIds.set(item.id, added.id);
    }
  }

  for (const stage of INITIAL_DATA.stages) {
    if (stage.chapter < 31 || stage.chapter > 34 || stageKeys.has(stageIdentityKey(stage))) continue;
    const drops = stage.drops.map((drop) => ({ ...drop, itemId: mappedItemIds.get(drop.itemId) }));
    // 保存データで明示的に削除された旧設計図は復元しない。
    if (drops.some((drop) => !drop.itemId)) continue;
    stages.push({ ...stage, id: reserveId(stage.id, stageIds), drops });
  }

  return { data: { ...data, catalogRevision: 1, items: items.sort(compareItems), stages: stages.sort(compareStages) }, changed: true };
}

export function normalizeMasterData(masterData) {
  const migrated = structuredClone(masterData);
  let changed = false;

  if (!migrated || !Array.isArray(migrated.items) || !Array.isArray(migrated.stages)) {
    return { data: migrated, changed };
  }

  migrated.items = migrated.items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const category = CATEGORY_RENAMES[item.category] ?? item.category;
    const name = deriveItemName({ ...item, category });
    const code = String(item.code ?? "");
    const defaultIconPath = item.defaultIconPath ?? (/^[2-9][1-7]$/.test(code) ? `./blueprint-icons/${code}.webp` : null);
    const normalizedItem = { ...item, category, name, defaultIconPath };
    if ("sortOrder" in normalizedItem) delete normalizedItem.sortOrder;

    if (
      category === item.category &&
      name === item.name &&
      defaultIconPath === item.defaultIconPath &&
      !("sortOrder" in item)
    ) {
      return item;
    }
    changed = true;
    return normalizedItem;
  });

  migrated.stages = migrated.stages.map((stage) => {
    if (!stage || typeof stage !== "object") return stage;
    const match = String(stage.name ?? "").match(/^(\d+)-(\d+)$/);
    const chapter = Number.isInteger(stage.chapter) ? stage.chapter : match ? Number(match[1]) : null;
    const number = Number.isInteger(stage.number) ? stage.number : match ? Number(match[2]) : null;
    const name = deriveStageName({ chapter, number });
    const normalizedStage = { ...stage, chapter, number, name };
    if ("sortOrder" in normalizedStage) delete normalizedStage.sortOrder;
    if (chapter === stage.chapter && number === stage.number && name === stage.name && !("sortOrder" in stage)) return stage;
    changed = true;
    return normalizedStage;
  });

  const itemOrder = migrated.items.map((item) => item.id).join("\u0000");
  const stageOrder = migrated.stages.map((stage) => stage.id).join("\u0000");
  if (migrated.items.every((item) => item && typeof item === "object")) migrated.items.sort(compareItems);
  if (migrated.stages.every((stage) => stage && typeof stage === "object")) migrated.stages.sort(compareStages);
  if (itemOrder !== migrated.items.map((item) => item.id).join("\u0000")) changed = true;
  if (stageOrder !== migrated.stages.map((stage) => stage.id).join("\u0000")) changed = true;

  return { data: migrated, changed };
}
