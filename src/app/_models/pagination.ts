/**
 * Paging metadata. Arrives in the `X-Pagination` response header rather than
 * the body, so the body stays a clean array.
 *
 * Mirrors `PaginationHeader` on the backend.
 */
export interface Pagination {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

export class PaginatedResult<T> {
  result?: T;
  pagination?: Pagination;
}

/**
 * Base query parameters for any paged endpoint.
 *
 * The backend caps `pageSize` at 100 regardless of what is sent, so a larger
 * value here is silently clamped rather than honoured.
 */
export class PaginationParams {
  pageNumber = 1;
  pageSize = 20;
}

/**
 * The other paging shape: in the body, not the header.
 *
 * The order endpoints answer this way — `GeneralResponse<PagedResult<T>>` —
 * and the catalogue answers with the array-plus-header above. Mirrors
 * `PagedResult<T>` on the backend.
 */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
