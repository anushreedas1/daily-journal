const DB_NAME = 'daily-journal-offline';
const DB_VERSION = 1;
const STORE_NAME = 'users';

let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Offline storage is not available in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open offline storage.'));
  });
  return databasePromise;
}

function emptyUserCache(userId) {
  return { userId: String(userId), entries: {}, summaries: {} };
}

async function readUserCache(userId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(String(userId));
    request.onsuccess = () => resolve(request.result || emptyUserCache(userId));
    request.onerror = () => reject(request.error || new Error('Could not read offline journal data.'));
  });
}

async function updateUserCache(userId, update) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(String(userId));
    let updated;

    request.onsuccess = () => {
      updated = update(request.result || emptyUserCache(userId));
      store.put(updated);
    };
    request.onerror = () => reject(request.error || new Error('Could not update offline journal data.'));
    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => reject(tx.error || new Error('Could not update offline journal data.'));
    tx.onabort = () => reject(tx.error || new Error('Offline journal save was interrupted.'));
  });
}

function entryData(entry = {}) {
  return {
    title: entry.title || '',
    body: entry.body || '',
    mood: entry.mood || null,
    tags: entry.tags || []
  };
}

export async function getCachedEntry(userId, date) {
  const cache = await readUserCache(userId);
  return cache.entries[date] || null;
}

export async function cacheServerEntry(userId, entry) {
  const date = entry.date;
  return updateUserCache(userId, (cache) => {
    const existing = cache.entries[date];
    if (existing?.pending) return cache;

    return {
      ...cache,
      entries: {
        ...cache.entries,
        [date]: {
          data: entryData(entry),
          images: entry.images || [],
          serverUpdatedAt: entry.updatedAt || null,
          baseUpdatedAt: entry.updatedAt || null,
          pending: false,
          conflictRemote: null
        }
      }
    };
  });
}

export async function saveLocalDraft(userId, date, data) {
  return updateUserCache(userId, (cache) => {
    const existing = cache.entries[date];
    return {
      ...cache,
      entries: {
        ...cache.entries,
        [date]: {
          data: entryData(data),
          images: existing?.images || [],
          serverUpdatedAt: existing?.serverUpdatedAt || null,
          baseUpdatedAt: existing?.baseUpdatedAt ?? existing?.serverUpdatedAt ?? null,
          pending: true,
          conflictRemote: existing?.conflictRemote || null
        }
      }
    };
  });
}

export async function markDraftSynced(userId, date, submittedData, serverEntry) {
  return updateUserCache(userId, (cache) => {
    const current = cache.entries[date];
    if (!current) return cache;

    const timestamp = serverEntry.updatedAt || new Date().toISOString();
    const unchangedSinceSubmit = JSON.stringify(current.data) === JSON.stringify(entryData(submittedData));
    return {
      ...cache,
      entries: {
        ...cache.entries,
        [date]: unchangedSinceSubmit
          ? {
              data: entryData(serverEntry),
              images: serverEntry.images || current.images || [],
              serverUpdatedAt: timestamp,
              baseUpdatedAt: timestamp,
              pending: false,
              conflictRemote: null
            }
          : { ...current, serverUpdatedAt: timestamp, baseUpdatedAt: timestamp, pending: true }
      }
    };
  });
}

export async function getPendingDrafts(userId) {
  const cache = await readUserCache(userId);
  return Object.entries(cache.entries)
    .filter(([, record]) => record.pending && !record.conflictRemote)
    .map(([date, record]) => ({ date, ...record }));
}

export async function markDraftConflict(userId, date, remoteEntry) {
  return updateUserCache(userId, (cache) => {
    const current = cache.entries[date];
    if (!current) return cache;
    return {
      ...cache,
      entries: {
        ...cache.entries,
        [date]: { ...current, conflictRemote: remoteEntry || { date, missing: true } }
      }
    };
  });
}

export async function keepLocalDraft(userId, date) {
  return updateUserCache(userId, (cache) => {
    const current = cache.entries[date];
    if (!current) return cache;
    const remote = current.conflictRemote;
    return {
      ...cache,
      entries: {
        ...cache.entries,
        [date]: {
          ...current,
          baseUpdatedAt: remote?.missing ? null : remote?.updatedAt || null,
          conflictRemote: null,
          pending: true
        }
      }
    };
  });
}

export async function useRemoteEntry(userId, date) {
  return updateUserCache(userId, (cache) => {
    const current = cache.entries[date];
    if (!current) return cache;
    const remote = current.conflictRemote;
    const entries = { ...cache.entries };
    if (remote?.missing) {
      delete entries[date];
    } else if (remote) {
      entries[date] = {
        data: entryData(remote),
        images: remote.images || [],
        serverUpdatedAt: remote.updatedAt || null,
        baseUpdatedAt: remote.updatedAt || null,
        pending: false,
        conflictRemote: null
      };
    }
    return { ...cache, entries };
  });
}

export async function saveMonthSummary(userId, year, month, summary) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return updateUserCache(userId, (cache) => ({
    ...cache,
    summaries: { ...cache.summaries, [key]: summary }
  }));
}

export async function getMonthSummary(userId, year, month) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const cache = await readUserCache(userId);
  return cache.summaries[key] || {};
}

export async function getMonthEntries(userId, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const cache = await readUserCache(userId);
  return Object.fromEntries(
    Object.entries(cache.entries).filter(([date]) => date.startsWith(prefix))
  );
}
