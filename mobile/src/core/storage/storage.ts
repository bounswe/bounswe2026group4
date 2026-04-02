import {
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

const storageMap = new Map<string, string>();
const storageDirectory = documentDirectory ? `${documentDirectory}app-storage/` : null;
const storageFile = storageDirectory ? `${storageDirectory}storage.json` : null;

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function readPersistentStore() {
  if (!storageFile || !storageDirectory) {
    return null;
  }

  const directoryInfo = await getInfoAsync(storageDirectory);

  if (!directoryInfo.exists) {
    await makeDirectoryAsync(storageDirectory, { intermediates: true });
  }

  const fileInfo = await getInfoAsync(storageFile);

  if (!fileInfo.exists) {
    return {};
  }

  try {
    const raw = await readAsStringAsync(storageFile);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writePersistentStore(nextStore: Record<string, string>) {
  if (!storageFile || !storageDirectory) {
    return;
  }

  const directoryInfo = await getInfoAsync(storageDirectory);

  if (!directoryInfo.exists) {
    await makeDirectoryAsync(storageDirectory, { intermediates: true });
  }

  await writeAsStringAsync(storageFile, JSON.stringify(nextStore));
}

async function getStore() {
  const persistentStore = await readPersistentStore();

  if (persistentStore) {
    return persistentStore;
  }

  return Object.fromEntries(storageMap.entries());
}

async function syncMemoryStore(nextStore: Record<string, string>) {
  storageMap.clear();
  Object.entries(nextStore).forEach(([key, value]) => {
    storageMap.set(key, value);
  });
}

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    const store = await getStore();
    const rawValue = store[key];

    if (!rawValue) {
      return null;
    }

    return cloneValue(JSON.parse(rawValue) as T);
  },
  async set(key: string, value: unknown): Promise<void> {
    const store = await getStore();
    const nextStore = {
      ...store,
      [key]: JSON.stringify(value),
    };

    await syncMemoryStore(nextStore);
    await writePersistentStore(nextStore);
  },
  async remove(key: string): Promise<void> {
    const store = await getStore();
    const nextStore = { ...store };
    delete nextStore[key];

    await syncMemoryStore(nextStore);
    await writePersistentStore(nextStore);
  },
  async clear(): Promise<void> {
    storageMap.clear();

    if (storageFile) {
      const fileInfo = await getInfoAsync(storageFile);

      if (fileInfo.exists) {
        await deleteAsync(storageFile, { idempotent: true });
      }
    }
  },
};
