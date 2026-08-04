const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUniqueValues(values) {
  return new Set(values).size === values.length;
}

export function validateMasterData(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["データ本体がオブジェクトではありません。"] };
  }

  if (data.schemaVersion !== 1) {
    errors.push("対応していないデータ形式です。schemaVersionは1である必要があります。");
  }

  if (!Array.isArray(data.items) || !Array.isArray(data.stages)) {
    errors.push("設計図またはステージの一覧がありません。");
    return { valid: false, errors };
  }

  const itemIds = data.items.map((item) => item?.id);
  if (!hasUniqueValues(itemIds)) errors.push("設計図IDが重複しています。");
  const itemKeys = data.items.map(itemIdentityKey);
  if (!hasUniqueValues(itemKeys)) errors.push("同じランクと装備分類の設計図が重複しています。");

  for (const [index, item] of data.items.entries()) {
    const label = `設計図${index + 1}`;
    if (!isNonEmptyString(item?.id)) errors.push(`${label}のIDが不正です。`);
    if (!isNonEmptyString(item?.name)) errors.push(`${label}の名称が空です。`);
    if (item?.rank != null && (!Number.isInteger(item.rank) || item.rank < 1)) {
      errors.push(`${label}のランクが不正です。`);
    }
    if (item?.category != null && typeof item.category !== "string") {
      errors.push(`${label}の装備分類が不正です。`);
    }
    if (isNonEmptyString(item?.name) && item.name !== deriveItemName(item)) {
      errors.push(`${label}の名称がランクと装備分類に一致しません。`);
    }
    if (item?.icon != null) {
      if (!ALLOWED_IMAGE_TYPES.has(item.icon.mimeType) || !isNonEmptyString(item.icon.data)) {
        errors.push(`${label}のアイコン画像が不正です。`);
      }
    }
    if (item?.defaultIconPath != null && !/^\.\/blueprint-icons\/\d+\.webp$/.test(item.defaultIconPath)) {
      errors.push(`${label}の初期アイコンパスが不正です。`);
    }
  }

  const stageIds = data.stages.map((stage) => stage?.id);
  const stageNames = data.stages.map((stage) => stage?.name?.trim());
  const stageKeys = data.stages.map(stageIdentityKey);
  if (!hasUniqueValues(stageIds)) errors.push("ステージIDが重複しています。");
  if (!hasUniqueValues(stageNames)) errors.push("ステージ名が重複しています。");
  if (!hasUniqueValues(stageKeys)) errors.push("同じ章番号とステージ番号が重複しています。");

  const itemIdSet = new Set(itemIds);
  for (const [index, stage] of data.stages.entries()) {
    const label = `ステージ${index + 1}`;
    if (!isNonEmptyString(stage?.id)) errors.push(`${label}のIDが不正です。`);
    if (!isNonEmptyString(stage?.name)) errors.push(`${label}の名称が空です。`);
    if (!Number.isInteger(stage?.chapter) || stage.chapter < 1) errors.push(`${label}の章番号が不正です。`);
    if (!Number.isInteger(stage?.number) || stage.number < 1) errors.push(`${label}のステージ番号が不正です。`);
    if (isNonEmptyString(stage?.name) && stage.name !== deriveStageName(stage)) {
      errors.push(`${label}の名称が章番号とステージ番号に一致しません。`);
    }
    if (!Array.isArray(stage?.drops) || stage.drops.length === 0) {
      errors.push(`${label}にドロップがありません。`);
      continue;
    }

    const dropItemIds = stage.drops.map((drop) => drop?.itemId);
    if (!hasUniqueValues(dropItemIds)) errors.push(`${label}に同じ設計図が重複しています。`);

    for (const drop of stage.drops) {
      if (!itemIdSet.has(drop?.itemId)) errors.push(`${label}が存在しない設計図を参照しています。`);
      if (!Number.isInteger(drop?.quantity) || drop.quantity < 1) {
        errors.push(`${label}のドロップ個数が不正です。`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidMasterData(data) {
  const result = validateMasterData(data);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return data;
}
import { deriveItemName, deriveStageName, itemIdentityKey, stageIdentityKey } from "./catalog.js";
