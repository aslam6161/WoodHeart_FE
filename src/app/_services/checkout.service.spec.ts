import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CheckoutService } from './checkout.service';
import { PlaceOrder, PlacedOrder } from '../_models/order';
import { environment } from '../../environments/environment';

const base = `${environment.apiUrl}checkout/`;

const order: PlaceOrder = {
  contactName: 'Rakib Hasan',
  contactPhone: '01712349999',
  shippingAddress: {
    division: 'Dhaka',
    district: 'Dhaka',
    area: 'Dhanmondi',
    addressLine: 'House 12, Road 3'
  },
  paymentMethodCode: 'cod'
};

describe('CheckoutService', () => {
  let service: CheckoutService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(CheckoutService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('placeOrder', () => {
    it('sends the idempotency key as the header the API reads', () => {
      // This is what stops a double-tap becoming two sofas. The API keys the
      // order on this header; a retry with the same key gets the same order
      // back rather than a second one. Wrong header name, no protection.
      service.placeOrder(order, 'attempt-1').subscribe();

      const request = http.expectOne(`${base}place-order`);

      expect(request.request.headers.get('Idempotency-Key')).toBe('attempt-1');

      request.flush({ isSuccess: true, data: placed() });
    });

    it('hands back the placed order', () => {
      let received: PlacedOrder | undefined;

      service.placeOrder(order, 'attempt-1').subscribe(result => (received = result));

      http.expectOne(`${base}place-order`).flush({ isSuccess: true, data: placed() });

      expect(received?.orderNumber).toBe('WH-2609-00042');
      expect(received?.alreadyPlaced).toBe(false);
    });

    it('refuses a success with no order in it', () => {
      // A 200 with an empty body is a contract violation, and the page must
      // not tell somebody their order is placed on the strength of it.
      let failed = false;

      service.placeOrder(order, 'attempt-1').subscribe({ error: () => (failed = true) });

      http.expectOne(`${base}place-order`).flush({ isSuccess: true, data: null });

      expect(failed).toBe(true);
    });
  });

  describe('getPaymentMethods', () => {
    it('posts the address so the API can filter by zone', () => {
      service.getPaymentMethods(order.shippingAddress).subscribe();

      const request = http.expectOne(`${base}payment-methods`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(order.shippingAddress);

      request.flush({ isSuccess: true, data: [] });
    });

    it('unwraps the envelope into the list', () => {
      let codes: string[] = [];

      service.getPaymentMethods(null).subscribe(methods => (codes = methods.map(m => m.code)));

      http.expectOne(`${base}payment-methods`).flush({
        isSuccess: true,
        data: [{ code: 'cod', displayName: 'Cash on delivery', surcharge: 0 }]
      });

      expect(codes).toEqual(['cod']);
    });
  });

  it('mints a different key each time', () => {
    // A second, deliberate order from the same session must get a second
    // order — not the first one back.
    expect(service.newIdempotencyKey()).not.toBe(service.newIdempotencyKey());
  });
});

function placed(): PlacedOrder {
  return {
    id: 1,
    orderNumber: 'WH-2609-00042',
    status: 'Confirmed',
    grandTotal: 89_500,
    alreadyPlaced: false
  };
}
