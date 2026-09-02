import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminCatalogService } from './admin-catalog.service';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}admin/`;

describe('AdminCatalogService', () => {
  let catalog: AdminCatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    catalog = TestBed.inject(AdminCatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('omits filters that were never set', () => {
    catalog.searchProducts({}).subscribe();

    const request = http.expectOne(r => r.url === `${base}products`);
    const params = request.request.params;

    // `?status=` is not the same as omitting it: model binding sees an empty
    // string, the query filters on nothing, and the admin gets an empty grid
    // from a filter they never applied.
    expect(params.has('status')).toBe(false);
    expect(params.has('categoryId')).toBe(false);
    expect(params.has('search')).toBe(false);

    request.flush({ isSuccess: true, data: [] });
  });

  it('defaults to newest first, not the storefront ordering', () => {
    catalog.searchProducts({}).subscribe();

    const request = http.expectOne(r => r.url === `${base}products`);

    // RecentlyPublished is right for customers and wrong here: a draft has
    // never been published, so it would bury the product the admin just
    // created at the bottom of the list.
    expect(request.request.params.get('sortBy')).toBe('Newest');

    request.flush({ isSuccess: true, data: [] });
  });

  it('sends the status filter the storefront does not have', () => {
    catalog.searchProducts({ status: 'Draft', search: 'segun' }).subscribe();

    const request = http.expectOne(r => r.url === `${base}products`);

    expect(request.request.params.get('status')).toBe('Draft');
    expect(request.request.params.get('search')).toBe('segun');

    request.flush({ isSuccess: true, data: [] });
  });

  it('reads the item list out of the envelope, not the envelope itself', () => {
    let count = -1;

    catalog.searchProducts({}).subscribe(result => (count = result.result?.length ?? -1));

    http
      .expectOne(r => r.url === `${base}products`)
      .flush(
        { isSuccess: true, data: [{ id: 1 }, { id: 2 }] },
        { headers: { 'X-Pagination': JSON.stringify({ currentPage: 1, itemsPerPage: 20, totalItems: 2, totalPages: 1 }) } }
      );

    // The failure mode this guards is silent: handing back the envelope
    // type-checks, and `@for` over an object renders nothing — so the screen
    // reads as an empty catalogue rather than a bug.
    expect(count).toBe(2);
  });

  it('addresses a variant by its own id rather than nesting it under a product', () => {
    catalog.deleteVariant(55).subscribe();

    // A variant id is globally unique. Nesting invites a route where the two
    // ids disagree, and then a decision about which one wins.
    http.expectOne(`${base}products/variants/55`).flush({ isSuccess: true });
  });

  it('changes status through its own endpoint', () => {
    catalog.changeProductStatus(7, 'Active').subscribe();

    const request = http.expectOne(`${base}products/7/status`);

    // Publishing is a deliberate act, not a side effect of saving a draft.
    expect(request.request.body).toEqual({ status: 'Active' });

    request.flush({ isSuccess: true });
  });
});
