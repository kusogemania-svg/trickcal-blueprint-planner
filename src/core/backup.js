import { assertValidMasterData, validateMasterData } from "./validator.js";
import { normalizeMasterData } from "./migrations.js";

export function createBackup(masterData) {
  return {
    ...structuredClone(masterData),
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
  };
}

export function downloadBackup(masterData) {
  const backup = createBackup(masterData);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `trickcal-blueprint-backup-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSONファイルを読み取れませんでした。");
  }

  const normalized = normalizeMasterData(parsed).data;
  const validation = validateMasterData(normalized);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));

  const restored = structuredClone(normalized);
  delete restored.exportedAt;
  return assertValidMasterData(restored);
}
