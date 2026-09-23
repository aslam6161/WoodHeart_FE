import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminQuotationService } from './admin-quotation.service';
import { environment } from '../../../environments/environment';
import { SaveQuotation } from '../../_models/admin-quotations';

const base = `${environment.apiUrl}admin/quotations`;

function draft(): SaveQuotation {
  return {
    contactName: 'Ayesha Rahman',
    contactPhone: '01712345678',
    discount: 0,
    lines: [
      { productVariantId: 12, quantity: 2, unitPrice: null, leadTimeDays: null },
      {
        productVariantId: null,
        description: 'Wardrobe built to the alcove, 7ft, segun',
        quantity: 1,
        unitPrice: 185000,
        leadTimeDays: 30
      }
    ]
  };
}

describe('AdminQuotationService', () => {
  let service: AdminQuotationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminQuotationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('search', () => {
    it('sends nothing it was not given', () => {
      service.search({}).subscribe();

      const request = http.expectOne(r => r.url === base);

      expect(request.request.params.has('term')).toBe(false);
      expect(request.request.params.has('status')).toBe(false);
      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('pageSize')).toBe('20');

      request.flush({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 20 } });
    });

    it('passes every filter the board offers', () => {
      service.search({ term: 'ayesha', status: 'Sent', bookingId: 7, page: 3, pageSize: 50 })
        .subscribe();

      const request = http.expectOne(r => r.url === base);
      const params = request.request.params;

      expect(params.get('term')).toBe('ayesha');
      expect(params.get('status')).toBe('Sent');
      expect(params.get('bookingId')).toBe('7');
      expect(params.get('page')).toBe('3');
      expect(params.get('pageSize')).toBe('50');

      request.flush({ isSuccess: true, data: { items: [], total: 0, page: 3, pageSize: 50 } });
    });

    it('treats a reply with no data as an empty board rather than a crash', () => {
      let answered: { items: unknown[]; total: number } | undefined;

      service.search({}).subscribe(result => (answered = result));

      http.expectOne(r => r.url === base).flush({ isSuccess: true });

      expect(answered?.items).toEqual([]);
      expect(answered?.total).toBe(0);
    });
  });

  describe('get', () => {
    it('reads one by its number, escaped', () => {
      service.get('WHQ 2609/42').subscribe();

      http.expectOne(`${base}/WHQ%202609%2F42`).flush({ isSuccess: true, data: null });
    });

    it('answers null for a number nobody has', () => {
      let answered: unknown = 'untouched';

      service.get('WHQ-2609-99999').subscribe(quotation => (answered = quotation));

      http
        .expectOne(`${base}/WHQ-2609-99999`)
        .flush({ isSuccess: false }, { status: 404, statusText: 'Not Found' });

      expect(answered).toBeNull();
    });
  });

  describe('create', () => {
    it('sends the whole document in one call', () => {
      // The discount only means something beside the lines it comes off, and a
      // partial save is a quotation whose total disagrees with itself.
      service.create(draft()).subscribe();

      const request = http.expectOne(base);

      expect(request.request.method).toBe('POST');
      expect(request.request.body.lines.length).toBe(2);

      request.flush({ isSuccess: true, data: null });
    });

    it('carries a made-to-measure line with its own words and its own price', () => {
      // The line the whole feature exists for: no variant, nothing on a shelf,
      // and an invoice that will read exactly what the designer typed.
      service.create(draft()).subscribe();

      const request = http.expectOne(base);
      const line = request.request.body.lines[1];

      expect(line.productVariantId).toBeNull();
      expect(line.description).toBe('Wardrobe built to the alcove, 7ft, segun');
      expect(line.unitPrice).toBe(185000);

      request.flush({ isSuccess: true, data: null });
    });

    it('hands a refusal back as the envelope the API sent', () => {
      // "The discount is larger than the goods it comes off" is about
      // something on the form and belongs on it.
      let answered: { isSuccess?: boolean; message?: string } | undefined;

      service.create(draft()).subscribe(response => (answered = response));

      http.expectOne(base).flush(
        {
          isSuccess: false,
          errorCode: 'quotation.discount_too_large',
          message: 'The discount is larger than the goods it comes off.'
        },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(answered?.isSuccess).toBe(false);
      expect(answered?.message).toContain('larger than the goods');
    });
  });

  describe('update', () => {
    it('writes by id, because that is what the API takes', () => {
      // The screens speak in quotation numbers; the update endpoint takes the
      // id it was loaded with, and this is the one place the two meet.
      service.update(42, draft()).subscribe();

      const request = http.expectOne(`${base}/42`);

      expect(request.request.method).toBe('PUT');
      request.flush({ isSuccess: true, data: null });
    });
  });

  describe('setStatus', () => {
    it('sends the status and the note', () => {
      service.setStatus('WHQ-2609-00042', { status: 'Sent', reason: 'Rung them first' })
        .subscribe();

      const request = http.expectOne(`${base}/WHQ-2609-00042/status`);

      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ status: 'Sent', reason: 'Rung them first' });

      request.flush({ isSuccess: true, data: null });
    });
  });

  describe('paymentMethods', () => {
    it('asks the quotation, not the checkout', () => {
      // The checkout's list is priced against the caller's basket, and whoever
      // is converting a quotation has none. The ceiling that matters is about
      // this quotation's total.
      service.paymentMethods('WHQ-2609-00042').subscribe();

      const request = http.expectOne(`${base}/WHQ-2609-00042/payment-methods`);

      expect(request.request.method).toBe('GET');
      request.flush({ isSuccess: true, data: [{ code: 'cod', surcharge: 100 }] });
    });
  });

  describe('convert', () => {
    it('asks for an order, naming how the customer is paying', () => {
      service.convert('WHQ-2609-00042', { paymentMethodCode: 'cod', deliveryNote: null })
        .subscribe();

      const request = http.expectOne(`${base}/WHQ-2609-00042/convert`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body.paymentMethodCode).toBe('cod');

      request.flush({ isSuccess: true, data: { orderNumber: 'WHO-2609-00007' } });
    });

    it('hands back "already converted" with the order number in it', () => {
      // A second press must not read as a failure: there is an order, and the
      // screen needs to say which one.
      let answered: { isSuccess?: boolean; message?: string } | undefined;

      service.convert('WHQ-2609-00042', {}).subscribe(response => (answered = response));

      http.expectOne(`${base}/WHQ-2609-00042/convert`).flush(
        {
          isSuccess: false,
          errorCode: 'quotation.already_converted.conflict',
          message: 'This quotation is already order WHO-2609-00007.'
        },
        { status: 409, statusText: 'Conflict' }
      );

      expect(answered?.isSuccess).toBe(false);
      expect(answered?.message).toContain('WHO-2609-00007');
    });
  });
});
