import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { ActiveStatusFilter, PaginationParams } from "@/types/list-params";
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

/**
 * Callers that omit both `page` and `pageSize` get every row back, so form and
 * dropdown lookups keep working against the same repository functions.
 */
export function resolvePaginationRange(params: PaginationParams): {
  paginate: boolean;
  from: number;
  to: number;
  pageSize: number;
} {
  const paginate = params.page != null || params.pageSize != null;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  return { paginate, from, to: from + pageSize - 1, pageSize };
}
