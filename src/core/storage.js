import { createInitialData } from "../../data/initial-data.js";
import { addRank10Catalog, normalizeMasterData } from "./migrations.js";
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
          result = operation(store, reject);
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
  return runTransaction("readwrite", (store, reject) => {
    const request = store.get(MASTER_KEY);
    const loaded = { result: null };
    request.addEventListener("success", () => {
      try {
        if (!request.result) {
          loaded.result = createInitialData();
          return;
        }
        const normalized = normalizeMasterData(request.result);
        const updated = addRank10Catalog(assertValidMasterData(normalized.data));
        loaded.result = assertValidMasterData(updated.data);
        if (normalized.changed || updated.changed) store.put(loaded.result, MASTER_KEY);
      } catch (error) {
        reject(error);
        store.transaction.abort();
      }
    });
    return loaded;
  });
}

export async function saveMasterData(data) {
  const normalized = assertValidMasterData(normalizeMasterData(data).data);
  const validData = assertValidMasterData(addRank10Catalog(normalized).data);
  await runTransaction("readwrite", (store) => store.put(validData, MASTER_KEY));
  return validData;
}

export async function resetMasterData() {
  await runTransaction("readwrite", (store) => store.delete(MASTER_KEY));
  return createInitialData();
}
