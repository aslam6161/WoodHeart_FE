import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CatalogService } from './catalog.service';
import { HANDLES_NOT_FOUND } from '../_interceptors/http-context';
import { StorefrontProduct } from '../_models/catalog';
import { environment } from '../../environments/environment';

const base = `${environment.apiUrl}catalog/`;

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('search', () => {
    it('unwraps the response envelope into the item list', () => {
      // The one that matters. Every endpoint answers with GeneralResponse, so
      // the body of a listing is `{ isSuccess: true, data: [...] }` and never
      // the array itself. Handing the envelope back as the list type-checks
      // perfectly and renders an empty grid — a bug that looks like an empty
      // catalogue rather than like a bug.
      let received: StorefrontProduct[] | undefined;

      service.search({}).subscribe(page => (received = page.result));

      const request = http.expectOne(r => r.url === `${base}products`);

      request.flush(
        { isSuccess: true, message: '', id: 0, data: [{ id: 7, slug: 'segun-king-bed' }] },
        {
          headers: {
            'X-Pagination': JSON.stringify({
              currentPage: 1,
              itemsPerPage: 24,
              totalItems: 1,
              totalPages: 1
            })
          }
        }
      );

      expect(received?.length).toBe(1);
      expect(received?.[0].slug).toBe('segun-king-bed');
    });

    it('reads the paging counts out of the X-Pagination header', () => {
      let totalPages: number | undefined;

      service.search({}).subscribe(page => (totalPages = page.pagination?.totalPages));

      http.expectOne(r => r.url === `${base}products`).flush(
        { isSuccess: true, data: [] },
        {
          headers: {
            'X-Pagination': JSON.stringify({
              currentPage: 2,
              itemsPerPage: 24,
              totalItems: 30,
              totalPages: 2
            })
          }
        }
      );

      expect(totalPages).toBe(2);
    });

    it('omits filters that are not set', () => {
      service.search({ pageNumber: 1, categoryId: null, search: null }).subscribe();

      const request = http.expectOne(r => r.url === `${base}products`);

      // `?categoryId=` is not the same as omitting it: model binding sees an
      // empty string and the customer gets zero results from a filter they
      // never applied.
      expect(request.request.params.has('categoryId')).toBe(false);
      expect(request.request.params.has('search')).toBe(false);
    });

    it('sends a sort on every request', () => {
      // The API defaults to Newest, which is the admin grid's default and not
      // the storefront's. Leaving it off would silently sort by created date.
      service.search({}).subscribe();

      const request = http.expectOne(r => r.url === `${base}products`);

      expect(request.request.params.get('sortBy')).toBe('RecentlyPublished');
    });

    it('never sends a status', () => {
      // Drafts are excluded by the server on every storefront request. A status
      // parameter here would read like a way to ask for them.
      service.search({}).subscribe();

      const request = http.expectOne(r => r.url === `${base}products`);

      expect(request.request.params.has('status')).toBe(false);
    });

    it('only asks for descendant categories when a category is selected', () => {
      service.search({ includeDescendantCategories: true }).subscribe();
      expect(
        http.expectOne(r => r.url === `${base}products`).request.params.has(
          'includeDescendantCategories'
        )
      ).toBe(false);

      service.search({ categoryId: 3, includeDescendantCategories: true }).subscribe();
      expect(
        http.expectOne(r => r.url === `${base}products`).request.params.get(
          'includeDescendantCategories'
        )
      ).toBe('true');
    });
  });

  describe('getProduct', () => {
    it('marks the request as handling its own 404', () => {
      // Without this the error interceptor redirects to /not-found, which loses
      // the slug and turns a 404 into a redirect. See HANDLES_NOT_FOUND.
      service.getProduct('segun-king-bed').subscribe();

      const request = http.expectOne(`${base}products/segun-king-bed`);

      expect(request.request.context.get(HANDLES_NOT_FOUND)).toBe(true);

      request.flush({ isSuccess: true, data: null });
    });

    it('escapes the slug', () => {
      service.getProduct('a b/c').subscribe();

      // A slug arriving from a URL is not trusted to be path-safe. Left raw,
      // `a b/c` would address a different endpoint entirely.
      http.expectOne(`${base}products/a%20b%2Fc`).flush({ isSuccess: true, data: null });
    });
  });

  describe('getCategories', () => {
    it('returns an empty tree rather than null when the envelope carries no data', () => {
      let received: unknown;

      service.getCategories().subscribe(categories => (received = categories));

      http.expectOne(`${base}categories`).flush({ isSuccess: true, data: null });

      expect(received).toEqual([]);
    });
  });
});
