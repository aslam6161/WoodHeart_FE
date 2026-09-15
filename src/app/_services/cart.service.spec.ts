import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { CartService } from './cart.service';
import { Cart, EMPTY_CART } from '../_models/cart';
import { environment } from '../../environments/environment';

const base = `${environment.apiUrl}cart`;

/** A basket with one line, as the API would answer. */
function basketWith(itemCount: number): Cart {
  return {
    ...EMPTY_CART,
    id: 12,
    lines: [
      {
        id: 1,
        variantId: 1,
        productId: 1,
        productNameEn: 'Segun King Bed',
        productSlug: 'segun-king-bed',
        sku: 'WH-0001',
        variantName: 'Segun · 6ft',
        quantity: itemCount,
        unitPrice: 85_000,
        unitPriceAtAdd: 85_000,
        priceChanged: false,
        lineTotal: 85_000 * itemCount,
        isAvailable: true
      }
    ],
    totals: { ...EMPTY_CART.totals, itemCount, subtotal: 85_000 * itemCount }
  };
}

describe('CartService', () => {
  let service: CartService;
  let http: HttpTestingController;

  function configure(platform: 'browser' | 'server'): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platform }
      ]
    });

    service = TestBed.inject(CartService);
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  describe('loading', () => {
    it('asks the API once, however many pages ask for it', () => {
      // The header and the basket page both call this on construction. Two
      // requests for the same basket on one page load is the bug this guards.
      configure('browser');

      service.ensureLoaded();
      service.ensureLoaded();

      http.expectOne(base).flush({ isSuccess: true, data: basketWith(2) });

      service.ensureLoaded();

      http.expectNone(base);
      expect(service.itemCount()).toBe(2);
      expect(service.loaded()).toBe(true);
    });

    it('never loads on the server', () => {
      // A basket is one visitor's. The server render has no cookie and no
      // anonymous id to find it by, and a shared SSR process that did load
      // one would put it into somebody else's HTML.
      configure('server');

      service.ensureLoaded();

      http.expectNone(base);
      expect(service.loaded()).toBe(false);
      expect(service.itemCount()).toBe(0);
    });

    it('treats a failed load as an empty basket rather than an error', () => {
      // A first-time visitor has no basket and must not meet a red toast
      // about it on the home page.
      configure('browser');

      service.ensureLoaded();

      http.expectOne(base).flush({ isSuccess: false }, { status: 500, statusText: 'Boom' });

      expect(service.loaded()).toBe(true);
      expect(service.isEmpty()).toBe(true);
    });
  });

  describe('mutations', () => {
    beforeEach(() => configure('browser'));

    it('replaces the whole basket with whatever the API answers', () => {
      // The client never adds a line to a subtotal itself. Every mutation
      // takes the API's priced basket verbatim, so the VAT rate and the
      // delivery rate card live in exactly one place.
      service.add(1, 2).subscribe();

      const request = http.expectOne(`${base}/items`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ variantId: 1, quantity: 2 });

      request.flush({ isSuccess: true, data: basketWith(2) });

      expect(service.itemCount()).toBe(2);
      expect(service.cart().totals.subtotal).toBe(170_000);
    });

    it('sends a quantity change to the line, not the basket', () => {
      service.updateLine(7, 3).subscribe();

      const request = http.expectOne(`${base}/items/7`);

      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ quantity: 3 });

      request.flush({ isSuccess: true, data: basketWith(3) });
    });

    it('tells the API where the basket is going, by zone name', () => {
      // The enum crosses the wire as its name. A number here would be
      // accepted by the API and mean the wrong zone.
      service.setDeliveryZone('OutsideDhaka').subscribe();

      const request = http.expectOne(`${base}/delivery-zone`);

      expect(request.request.body).toEqual({ zone: 'OutsideDhaka' });

      request.flush({ isSuccess: true, data: { ...basketWith(1), deliveryZone: 'OutsideDhaka' } });

      expect(service.cart().deliveryZone).toBe('OutsideDhaka');
    });

    it('forgets the basket locally without asking the API', () => {
      // After an order is placed the API has already retired the cart; a
      // header still showing "2" is what makes a customer place it twice.
      service.add(1, 2).subscribe();
      http.expectOne(`${base}/items`).flush({ isSuccess: true, data: basketWith(2) });

      service.forget();

      http.expectNone(base);
      expect(service.itemCount()).toBe(0);
      expect(service.isEmpty()).toBe(true);
    });
  });
});
