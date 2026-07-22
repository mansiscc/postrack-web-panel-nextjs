/** Build occurrence counts keyed by a foreign-key column. */
export function buildCountMap<T>(
  rows: T[],
  keySelector: (row: T) => string | null | undefined,
): Map<string, number> {
  const countMap = new Map<string, number>();
  for (const row of rows) {
    const key = keySelector(row);
    if (!key) continue;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }
  return countMap;
}
