/** Android SystemAccountingCategories — do not rename/deactivate. */
export const SYSTEM_ACCOUNTING_CATEGORY_SEEDS = [
  { name: "Sales", type: "income" as const },
  { name: "Purchase", type: "expense" as const },
  { name: "Sales Return", type: "expense" as const },
] as const;

export function isSystemAccountingCategory(
  name: string,
  type: "income" | "expense",
): boolean {
  const normalized = name.trim().toLowerCase();
  return SYSTEM_ACCOUNTING_CATEGORY_SEEDS.some(
    (seed) =>
      seed.type === type && seed.name.toLowerCase() === normalized,
  );
}
