interface InsertArrayEntryRequest<T> {
  readonly entries: readonly T[];
  readonly entry: T;
  readonly targetIndex: number;
}

interface MoveArrayEntryRequest<T> {
  readonly entries: readonly T[];
  readonly sourceIndex: number;
  readonly targetIndex: number;
}

export function insertArrayEntry<T>({ entries, entry, targetIndex }: InsertArrayEntryRequest<T>): T[] {
  return [...entries.slice(0, targetIndex), entry, ...entries.slice(targetIndex)];
}

export function moveArrayEntry<T>({ entries, sourceIndex, targetIndex }: MoveArrayEntryRequest<T>): T[] {
  const entry = entries[sourceIndex] as T;
  const remainingEntries = entries.filter((_, index) => index !== sourceIndex);
  return insertArrayEntry({ entries: remainingEntries, entry, targetIndex });
}
