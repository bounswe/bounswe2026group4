const memoryStorage = new Map<string, string>();

function readFromLocalStorage(key: string) {
  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  return globalThis.localStorage.getItem(key);
}

function writeToLocalStorage(key: string, value: string) {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  globalThis.localStorage.setItem(key, value);
}

function removeFromLocalStorage(key: string) {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  globalThis.localStorage.removeItem(key);
}

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    const stored = readFromLocalStorage(key) ?? memoryStorage.get(key) ?? null;

    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as T;
  },
  async set(key: string, value: unknown) {
    const serialized = JSON.stringify(value);
    memoryStorage.set(key, serialized);
    writeToLocalStorage(key, serialized);
  },
  async remove(key: string) {
    memoryStorage.delete(key);
    removeFromLocalStorage(key);
  },
};
