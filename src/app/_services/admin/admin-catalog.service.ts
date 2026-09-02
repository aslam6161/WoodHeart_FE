import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponse, GeneralResponseOf } from '../../_models/generalResponse';
import { PaginatedResult } from '../../_models/pagination';
import {
  AdminBrand,
  AdminCategoryTree,
  AdminProductDetail,
  AdminProductListItem,
  AdminProductQuery,
  AdminProductVariant,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateProductVariantDto,
  MoveCategoryDto,
  ProductStatus,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateProductVariantDto
} from '../../_models/admin-catalog';
import { appendIfPresent, getPaginatedResult, getPaginationHeaders } from '../paginationHelper';

/**
 * Products, variants, categories and brands, as the admin panel sees them.
 *
 * <b>Separate from `CatalogService` even though some routes look alike.</b>
 * That one reads `/api/catalog` and is anonymous; this one writes to
 * `/api/admin` and needs a staff token. Sharing a class would mean one object
 * whose methods have different auth requirements, and the first person to reuse
 * the wrong one gets a 401 in front of a customer.
 */
@Injectable({ providedIn: 'root' })
export class AdminCatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/`;

  // --- Products ------------------------------------------------------------

  searchProducts(query: AdminProductQuery): Observable<PaginatedResult<AdminProductListItem[]>> {
    return getPaginatedResult<AdminProductListItem>(
      `${this.baseUrl}products`,
      this.toParams(query),
      this.http
    );
  }

  getProduct(id: number): Observable<AdminProductDetail | null> {
    return this.http
      .get<GeneralResponseOf<AdminProductDetail>>(`${this.baseUrl}products/${id}`)
      .pipe(map(response => response.data ?? null));
  }

  createProduct(dto: CreateProductDto): Observable<GeneralResponseOf<AdminProductDetail>> {
    return this.http.post<GeneralResponseOf<AdminProductDetail>>(`${this.baseUrl}products`, dto);
  }

  updateProduct(
    id: number,
    dto: UpdateProductDto
  ): Observable<GeneralResponseOf<AdminProductDetail>> {
    return this.http.put<GeneralResponseOf<AdminProductDetail>>(
      `${this.baseUrl}products/${id}`,
      dto
    );
  }

  /**
   * Publishes or withdraws a product.
   *
   * Its own endpoint rather than a field on the save, so going live is a
   * deliberate act rather than a side effect of correcting a typo in a draft.
   */
  changeProductStatus(
    id: number,
    status: ProductStatus
  ): Observable<GeneralResponseOf<AdminProductDetail>> {
    return this.http.post<GeneralResponseOf<AdminProductDetail>>(
      `${this.baseUrl}products/${id}/status`,
      { status }
    );
  }

  deleteProduct(id: number): Observable<GeneralResponse> {
    return this.http.delete<GeneralResponse>(`${this.baseUrl}products/${id}`);
  }

  // --- Variants ------------------------------------------------------------

  addVariant(
    productId: number,
    dto: CreateProductVariantDto
  ): Observable<GeneralResponseOf<AdminProductVariant>> {
    return this.http.post<GeneralResponseOf<AdminProductVariant>>(
      `${this.baseUrl}products/${productId}/variants`,
      dto
    );
  }

  /**
   * Variants are addressed by their own id rather than nested under a product.
   *
   * A variant id is globally unique, so `/variants/{id}` needs no product to
   * resolve. Nesting it would invite a route where the two ids disagree, and
   * then a decision about which one wins.
   */
  updateVariant(
    variantId: number,
    dto: UpdateProductVariantDto
  ): Observable<GeneralResponseOf<AdminProductVariant>> {
    return this.http.put<GeneralResponseOf<AdminProductVariant>>(
      `${this.baseUrl}products/variants/${variantId}`,
      dto
    );
  }

  deleteVariant(variantId: number): Observable<GeneralResponse> {
    return this.http.delete<GeneralResponse>(`${this.baseUrl}products/variants/${variantId}`);
  }

  // --- Categories ----------------------------------------------------------

  /** The full tree, inactive categories included. */
  getCategoryTree(): Observable<AdminCategoryTree[]> {
    return this.http
      .get<GeneralResponseOf<AdminCategoryTree[]>>(`${this.baseUrl}categories`)
      .pipe(map(response => response.data ?? []));
  }

  createCategory(dto: CreateCategoryDto): Observable<GeneralResponseOf<AdminCategoryTree>> {
    return this.http.post<GeneralResponseOf<AdminCategoryTree>>(`${this.baseUrl}categories`, dto);
  }

  updateCategory(
    id: number,
    dto: UpdateCategoryDto
  ): Observable<GeneralResponseOf<AdminCategoryTree>> {
    return this.http.put<GeneralResponseOf<AdminCategoryTree>>(
      `${this.baseUrl}categories/${id}`,
      dto
    );
  }

  moveCategory(id: number, dto: MoveCategoryDto): Observable<GeneralResponse> {
    return this.http.post<GeneralResponse>(`${this.baseUrl}categories/${id}/move`, dto);
  }

  deleteCategory(id: number): Observable<GeneralResponse> {
    return this.http.delete<GeneralResponse>(`${this.baseUrl}categories/${id}`);
  }

  // --- Brands --------------------------------------------------------------

  getBrands(): Observable<AdminBrand[]> {
    return this.http
      .get<GeneralResponseOf<AdminBrand[]>>(`${this.baseUrl}brands`)
      .pipe(map(response => response.data ?? []));
  }

  createBrand(dto: CreateBrandDto): Observable<GeneralResponseOf<AdminBrand>> {
    return this.http.post<GeneralResponseOf<AdminBrand>>(`${this.baseUrl}brands`, dto);
  }

  updateBrand(id: number, dto: UpdateBrandDto): Observable<GeneralResponseOf<AdminBrand>> {
    return this.http.put<GeneralResponseOf<AdminBrand>>(`${this.baseUrl}brands/${id}`, dto);
  }

  deleteBrand(id: number): Observable<GeneralResponse> {
    return this.http.delete<GeneralResponse>(`${this.baseUrl}brands/${id}`);
  }

  // -------------------------------------------------------------------------

  /**
   * Turns a query object into query-string parameters.
   *
   * Every optional filter goes through `appendIfPresent`, so an unset control
   * is omitted rather than sent empty — `?status=` binds to nothing and returns
   * an empty grid from a filter nobody applied.
   */
  private toParams(query: AdminProductQuery): HttpParams {
    let params = getPaginationHeaders(query.pageNumber ?? 1, query.pageSize ?? 20);

    params = appendIfPresent(params, 'categoryId', query.categoryId);
    params = appendIfPresent(params, 'brandId', query.brandId);
    params = appendIfPresent(params, 'productType', query.productType);
    params = appendIfPresent(params, 'status', query.status);
    params = appendIfPresent(params, 'isFeatured', query.isFeatured);
    params = appendIfPresent(params, 'search', query.search);
    params = appendIfPresent(params, 'minPrice', query.minPrice);
    params = appendIfPresent(params, 'maxPrice', query.maxPrice);

    if (query.categoryId && query.includeDescendantCategories) {
      params = params.append('includeDescendantCategories', 'true');
    }

    // The admin grid defaults to newest-first, not the storefront's
    // recently-published: a draft has never been published, and sorting by that
    // buries the thing the admin just created at the bottom of the list.
    params = params.append('sortBy', query.sortBy ?? 'Newest');

    return params;
  }
}
