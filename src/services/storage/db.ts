/**
 * 브라우저 안쪽 저장소.
 *
 * 왜 옮겼나:
 *  예전에는 간단한 저장소(localStorage)를 썼는데 5MB 정도가 한계라
 *  사진을 여러 장 넣으면 자동저장이 실패했다.
 *  이 저장소는 훨씬 넉넉해서 사진이 많아도 저장된다.
 *
 * 규칙:
 *  - 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 앱이 멈추면 안 된다.
 *    그래서 실패는 전부 조용히 null / false 로 돌려준다.
 *  - 글로 바꾸지 않고 값을 그대로 넣는다. (사진이 많을 때 훨씬 빠르다)
 *  - 서버는 쓰지 않는다. 이 컴퓨터 안에만 저장된다.
 */

const DB_NAME = 'saypagemaker';
const STORE = 'projects';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

/** 저장소를 쓸 수 있는지 */
export async function dbAvailable(): Promise<boolean> {
  return (await openDb()) !== null;
}

export async function dbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function dbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      /* 저장 공간을 넘어서면 여기로 온다 */
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function dbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
