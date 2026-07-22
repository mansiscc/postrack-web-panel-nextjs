export type ActiveStatusFilter = "all" | "active" | "inactive";

export type SearchListParams = {
  search?: string;
  status?: ActiveStatusFilter;
};

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};
