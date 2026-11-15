type StorageReaderWriter = Pick<Storage, "getItem" | "setItem">;

export function loadCompatibleArray<T>(storage: StorageReaderWriter, primaryKey: string, legacyKeys: string[]): T[] {
  for (const key of [primaryKey, ...legacyKeys]) {
    try {
      const value = storage.getItem(key);
      if (!value) continue;
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) continue;
      if (key !== primaryKey) storage.setItem(primaryKey, value);
      return parsed as T[];
    } catch {
      // Un registro corrupto no impide intentar la siguiente fuente compatible.
    }
  }
  return [];
}
