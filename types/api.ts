export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};
