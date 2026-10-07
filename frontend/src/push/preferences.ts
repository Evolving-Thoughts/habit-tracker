// Device preference only: no account, email, Todo/Habit content or session token.
export interface PushPreference {
  enabled: boolean;
  subscriptionId: string | null;
}
const DB = "habit-push-preferences";
const STORE = "settings";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Geräteeinstellung konnte nicht gespeichert werden."));
  });
}
export async function readPreference(): Promise<PushPreference> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get("push");
      request.onsuccess = () =>
        resolve(request.result ?? { enabled: false, subscriptionId: null });
      request.onerror = () =>
        reject(new Error("Geräteeinstellung konnte nicht gelesen werden."));
    });
  } finally {
    db.close();
  }
}
export async function writePreference(value: PushPreference): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, "push");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(new Error("Geräteeinstellung konnte nicht gespeichert werden."));
      transaction.onabort = () =>
        reject(new Error("Geräteeinstellung konnte nicht gespeichert werden."));
    });
  } finally {
    db.close();
  }
}

// Auto-login binding may update an ID, but must NEVER undo explicit opt-out,
// including when another tab disables Push while its network request is pending.
export async function bindIfEnabled(subscriptionId: string): Promise<boolean> {
  const db = await database();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      let bound = false;
      const tx = db.transaction(STORE, "readwrite");
      const read = tx.objectStore(STORE).get("push");
      read.onsuccess = () => {
        if (read.result?.enabled === true) {
          tx.objectStore(STORE).put({ enabled: true, subscriptionId }, "push");
          bound = true;
        }
      };
      tx.oncomplete = () => resolve(bound);
      tx.onerror = () =>
        reject(new Error("Geräteeinstellung konnte nicht gespeichert werden."));
      tx.onabort = () =>
        reject(new Error("Geräteeinstellung konnte nicht gespeichert werden."));
    });
  } finally {
    db.close();
  }
}
