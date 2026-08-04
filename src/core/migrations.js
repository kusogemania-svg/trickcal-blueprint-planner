import { compareItems, compareStages, deriveItemName, deriveStageName } from "./catalog.js";

const CATEGORY_RENAMES = Object.freeze({
  煌めく装飾品: "リング",
  華麗な装飾品: "ネックレス",
  物理武器: "剣",
  魔法武器: "杖",
});

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
    const normalizedItem = { ...item, category, name };
    if ("sortOrder" in normalizedItem) delete normalizedItem.sortOrder;

    if (category === item.category && name === item.name && !("sortOrder" in item)) return item;
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
