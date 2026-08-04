import { createInitialData } from "../../data/initial-data.js";
import { migrateKnownNames } from "./migrations.js";
import { assertValidMasterData } from "./validator.js";

const DATABASE_NAME = "trickcal-blueprint-planner";
const DATABASE_VERSION = 1;
const STORE_NAME = "master-data";
const MASTER_KEY = "current";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function runTransaction(mode, operation) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result;
        try {
          result = operation(store);
        } catch (error) {
          database.close();
          reject(error);
          return;
        }
        transaction.addEventListener("complete", () => {
          database.close();
          resolve(result?.result);
        });
        transaction.addEventListener("error", () => {
          database.close();
          reject(transaction.error);
        });
        transaction.addEventListener("abort", () => {
          database.close();
          reject(transaction.error ?? new Error("保存処理が中断されました。"));
        });
      }),
  );
}

export async function loadMasterData() {
  const stored = await runTransaction("readonly", (store) => store.get(MASTER_KEY));
  if (!stored) return createInitialData();
  const migrated = migrateKnownNames(stored);
  const validData = assertValidMasterData(migrated.data);
  if (migrated.changed) await saveMasterData(validData);
  return validData;
}

export async function saveMasterData(data) {
  const validData = assertValidMasterData(structuredClone(data));
  await runTransaction("readwrite", (store) => store.put(validData, MASTER_KEY));
  return validData;
}

export async function resetMasterData() {
  await runTransaction("readwrite", (store) => store.delete(MASTER_KEY));
  return createInitialData();
}
