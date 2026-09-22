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
        isAvailable: true,
        isSoldOut: false
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

  /**
   * Lets the session restore settle. `ensureLoaded` asks for the basket only
   * after `AccountService.ensureRestored()` resolves, which is a promise
   * around the refresh request — so the test answers that request, then
   * yields for the promise chain before the basket request can exist.
   */
  async function settleRestore(signedIn = false): Promise<void> {
    const refresh = http.expectOne(`${environment.apiUrl}account/refresh`);

    if (signedIn) {
      refresh.flush({ isSuccess: true, data: { id: 3, roles: [], accessToken: 't' } });
    } else {
      refresh.flush({ isSuccess: false }, { status: 401, statusText: 'Unauthorized' });
    }

    await new Promise(resolve => setTimeout(resolve));
  }

  describe('loading', () => {
    it('asks the API once, however many pages ask for it', async () => {
      // The header and the basket page both call this on construction. Two
      // requests for the same basket on one page load is the bug this guards.
      configure('browser');

      service.ensureLoaded();
      service.ensureLoaded();

      await settleRestore();

      http.expectOne(base).flush({ isSuccess: true, data: basketWith(2) });

      service.ensureLoaded();

      http.expectNone(base);
      expect(service.itemCount()).toBe(2);
      expect(service.loaded()).toBe(true);
    });

    it('waits for the session restore before asking, so a member gets their own basket', async () => {
      // On a full page load the token is in memory and gone; it comes back
      // from the refresh cookie. A basket fetched before that arrives is
      // fetched as a guest — an empty badge for a customer with a wardrobe
      // in their basket. This is what the browser showed the day members
      // first used the storefront.
      configure('browser');

      service.ensureLoaded();

      http.expectNone(base);

      await settleRestore(true);

      http.expectOne(base).flush({ isSuccess: true, data: basketWith(1) });

      expect(service.itemCount()).toBe(1);
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

    it('treats a failed load as an empty basket rather than an error', async () => {
      // A first-time visitor has no basket and must not meet a red toast
      // about it on the home page.
      configure('browser');

      service.ensureLoaded();

      await settleRestore();

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

    it('sends a coupon code and replaces the basket with what came back', () => {
      service.applyCoupon('eid25').subscribe();

      const request = http.expectOne(`${base}/coupons`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ code: 'eid25' });

      request.flush({
        isSuccess: true,
        data: {
          ...basketWith(1),
          discounts: [
            { discountId: 4, name: 'Eid sale', code: 'EID25', type: 'Percentage', amount: 2000 }
          ],
          coupons: [{ code: 'EID25', isApplied: true }],
          totals: { ...EMPTY_CART.totals, itemCount: 1, subtotal: 85_000, discountTotal: 2000 }
        }
      });

      expect(service.cart().discounts[0].name).toBe('Eid sale');
      expect(service.cart().totals.discountTotal).toBe(2000);
    });

    it('lets a refused code through to the caller rather than swallowing it', async () => {
      // The refusal is the answer to what the customer asked, and the box
      // beside the field words it. A toast would be the wrong place and
      // `/not-found` — where a 404 would otherwise send them — is worse.
      let failure: unknown;

      service.applyCoupon('EXPIRED').subscribe({ error: error => (failure = error) });

      http
        .expectOne(`${base}/coupons`)
        .flush(
          { isSuccess: false, errorCode: 'promotions.coupon_expired', message: 'Expired.' },
          { status: 400, statusText: 'Bad Request' }
        );

      expect(failure).toBeDefined();
    });

    it('escapes a code on its way into the URL', () => {
      // Codes are letters, digits, dots, dashes and underscores — but a
      // customer can type anything into the box, and an unescaped one would
      // be a request to a different path.
      service.removeCoupon('EID/25').subscribe();

      const request = http.expectOne(`${base}/coupons/EID%2F25`);

      expect(request.request.method).toBe('DELETE');

      request.flush({ isSuccess: true, data: basketWith(1) });
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
