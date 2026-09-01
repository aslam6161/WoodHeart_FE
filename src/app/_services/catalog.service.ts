import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { PaginatedResult } from '../_models/pagination';
import {
  CategoryTree,
  ProductQuery,
  StorefrontCollection,
  StorefrontProduct,
  StorefrontProductDetail
} from '../_models/catalog';
import { appendIfPresent, getPaginatedResult, getPaginationHeaders } from './paginationHelper';
import { handlesNotFound } from '../_interceptors/http-context';

/**
 * The public catalog — reads only.
 *
 * Nothing here sends a `status`. The backend overwrites it to `Active` on
 * every storefront request, so a draft is unreachable no matter what this
 * client asks for. That guarantee lives on the server on purpose: a filter the
 * client applies is a filter the client can drop.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}catalog/`;

  /**
   * The visible category tree, nested, with product counts.
   *
   * Not cached here. Under SSR each request gets a fresh injector, so a cache
   * on this service would either be useless (one request long) or, if hoisted
   * to module scope, shared across every visitor on the server — which is how
   * one customer's data ends up on another's page. Caching belongs in
   * `HybridCache` on the API, where it is one implementation for every client.
   */
  getCategories(): Observable<CategoryTree[]> {
    return this.http
      .get<GeneralResponseOf<CategoryTree[]>>(`${this.baseUrl}categories`)
      .pipe(map(response => response.data ?? []));
  }

  search(query: ProductQuery): Observable<PaginatedResult<StorefrontProduct[]>> {
    return getPaginatedResult<StorefrontProduct>(
      `${this.baseUrl}products`,
      this.toParams(query),
      this.http
    );
  }

  getProduct(slug: string): Observable<StorefrontProductDetail | null> {
    return this.http
      .get<GeneralResponseOf<StorefrontProductDetail>>(`${this.baseUrl}products/${encodeURIComponent(slug)}`, {
        context: handlesNotFound()
      })
      .pipe(map(response => response.data ?? null));
  }

  getRelated(slug: string): Observable<StorefrontProduct[]> {
    return this.http
      .get<GeneralResponseOf<StorefrontProduct[]>>(
        `${this.baseUrl}products/${encodeURIComponent(slug)}/related`,
        { context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? []));
  }

  getCollection(slug: string): Observable<StorefrontCollection | null> {
    return this.http
      .get<GeneralResponseOf<StorefrontCollection>>(
        `${this.baseUrl}collections/${encodeURIComponent(slug)}`,
        { context: handlesNotFound() }
      )
      .pipe(map(response => response.data ?? null));
  }

  getCollectionProducts(
    slug: string,
    query: ProductQuery
  ): Observable<PaginatedResult<StorefrontProduct[]>> {
    return getPaginatedResult<StorefrontProduct>(
      `${this.baseUrl}collections/${encodeURIComponent(slug)}/products`,
      this.toParams(query),
      this.http
    );
  }

  /**
   * Turns a query object into query-string parameters.
   *
   * Every optional filter goes through `appendIfPresent`, so an unset control
   * is omitted rather than sent empty. `sortBy` is always sent — the backend
   * defaults to `Newest`, which is not the storefront's default.
   */
  private toParams(query: ProductQuery): HttpParams {
    let params = getPaginationHeaders(query.pageNumber ?? 1, query.pageSize ?? 24);

    params = appendIfPresent(params, 'categoryId', query.categoryId);
    params = appendIfPresent(params, 'brandId', query.brandId);
    params = appendIfPresent(params, 'productType', query.productType);
    params = appendIfPresent(params, 'isFeatured', query.isFeatured);
    params = appendIfPresent(params, 'search', query.search);
    params = appendIfPresent(params, 'minPrice', query.minPrice);
    params = appendIfPresent(params, 'maxPrice', query.maxPrice);

    // Only meaningful alongside a category, and only worth sending when true —
    // it is the backend's default-off, and "Living Room" meaning the whole room
    // rather than the handful filed directly against it is a choice this page
    // makes, not one the API assumes.
    if (query.categoryId && query.includeDescendantCategories) {
      params = params.append('includeDescendantCategories', 'true');
    }

    params = params.append('sortBy', query.sortBy ?? 'RecentlyPublished');

    return params;
  }
}
