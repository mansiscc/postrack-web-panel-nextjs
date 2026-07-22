import type { ActiveStatusFilter } from "@/types/list-params";
import { sanitizePostgrestSearch, toIlikePattern } from "@/utils/postgrest-filter";

type IlikeQueryable = {
  ilike: (column: string, pattern: string) => IlikeQueryable;
};

type OrQueryable = {
  or: (filters: string) => OrQueryable;
};

type EqQueryable = {
  eq: (column: string, value: boolean) => EqQueryable;
};

export function applyNameIlikeFilter<T extends IlikeQueryable>(
  query: T,
  search: string | undefined,
  column = "name",
): T {
  if (!search?.trim()) return query;
  return query.ilike(column, toIlikePattern(search)) as T;
}

export function applyMultiFieldOrSearch<T extends OrQueryable>(
  query: T,
  fields: string[],
  search: string | undefined,
): T {
  if (!search?.trim()) return query;
  const term = sanitizePostgrestSearch(search);
  if (!term) return query;
  const filters = fields.map((field) => `${field}.ilike.%${term}%`).join(",");
  return query.or(filters) as T;
}

export function applyActiveStatusFilter<T extends EqQueryable>(
  query: T,
  status: ActiveStatusFilter | undefined,
  column = "is_active",
): T {
  if (status === "active") return query.eq(column, true) as T;
  if (status === "inactive") return query.eq(column, false) as T;
  return query;
}
