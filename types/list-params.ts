export type ActiveStatusFilter = "all" | "active" | "inactive";

export type SearchListParams = {
  search?: string;
  status?: ActiveStatusFilter;
};

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type ListResult<T> = {
  items: T[];
  total: number;
};
