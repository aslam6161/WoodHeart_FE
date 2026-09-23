import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { QuotationApiService } from './quotation.service';
import { environment } from '../../environments/environment';
import { HANDLES_NOT_FOUND, SILENT_FAILURE } from '../_interceptors/http-context';

const base = `${environment.apiUrl}quotations`;

describe('QuotationApiService', () => {
  let service: QuotationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(QuotationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('get', () => {
    it('asks with the phone a guest was written for', () => {
      service.get('WHQ-2609-00042', '01712345678').subscribe();

      const request = http.expectOne(r => r.url === `${base}/WHQ-2609-00042`);

      expect(request.request.params.get('phone')).toBe('01712345678');
      request.flush({ isSuccess: true, data: null });
    });

    it('sends no phone for a signed-in customer', () => {
      // The API knows whose it is. Sending an empty one would be a different
      // question — "the quotation for nobody" — and would answer nothing.
      service.get('WHQ-2609-00042').subscribe();

      const request = http.expectOne(r => r.url === `${base}/WHQ-2609-00042`);

      expect(request.request.params.has('phone')).toBe(false);
      request.flush({ isSuccess: true, data: null });
    });

    it('escapes the number rather than pasting it into the path', () => {
      service.get('WHQ 2609/42').subscribe();

      http.expectOne(`${base}/WHQ%202609%2F42`).flush({ isSuccess: true, data: null });
    });

    it('treats a 404 as "no such quotation" rather than a failure', () => {
      let answered: unknown = 'untouched';

      service.get('WHQ-2609-99999', '01712345678').subscribe(quotation => (answered = quotation));

      const request = http.expectOne(r => r.url === `${base}/WHQ-2609-99999`);

      expect(request.request.context.get(HANDLES_NOT_FOUND)).toBe(true);
      request.flush({ isSuccess: false }, { status: 404, statusText: 'Not Found' });

      expect(answered).toBeNull();
    });
  });

  describe('accept', () => {
    it('puts the phone in the body, never the URL', () => {
      // A URL ends up in browser history, in a proxy log and in a referrer
      // header, and the phone is the other half of the credential.
      service.accept('WHQ-2609-00042', { phone: '01712345678' }).subscribe();

      const request = http.expectOne(`${base}/WHQ-2609-00042/accept`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ phone: '01712345678' });
      expect(request.request.urlWithParams).not.toContain('01712345678');

      request.flush({ isSuccess: true, data: null });
    });

    it('hands a refusal back as the envelope the API sent', () => {
      // "This one has run out of date" belongs beside the figures the
      // customer was reading, not in a red toast that says nothing.
      let answered: { isSuccess?: boolean; message?: string } | undefined;

      service
        .accept('WHQ-2609-00042', { phone: '01712345678' })
        .subscribe(response => (answered = response));

      const request = http.expectOne(`${base}/WHQ-2609-00042/accept`);

      // `handledInline()` is both: no red toast, and no redirect to
      // /not-found for what is really an answer.
      expect(request.request.context.get(SILENT_FAILURE)).toBe(true);
      expect(request.request.context.get(HANDLES_NOT_FOUND)).toBe(true);

      request.flush(
        { isSuccess: false, errorCode: 'quotation.expired.conflict', message: 'It has lapsed.' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(answered?.isSuccess).toBe(false);
      expect(answered?.message).toBe('It has lapsed.');
    });
  });

  describe('decline', () => {
    it('carries the reason, because it is worth asking for', () => {
      service
        .decline('WHQ-2609-00042', { phone: '01712345678', reason: 'Too much for now' })
        .subscribe();

      const request = http.expectOne(`${base}/WHQ-2609-00042/decline`);

      expect(request.request.body).toEqual({
        phone: '01712345678',
        reason: 'Too much for now'
      });

      request.flush({ isSuccess: true, data: null });
    });
  });

  describe('getMine', () => {
    it('pages, and treats a reply with no data as an empty list', () => {
      let answered: { items: unknown[]; total: number } | undefined;

      service.getMine(2, 5).subscribe(result => (answered = result));

      const request = http.expectOne(r => r.url === `${base}/my-quotations`);

      expect(request.request.params.get('page')).toBe('2');
      expect(request.request.params.get('pageSize')).toBe('5');

      request.flush({ isSuccess: true });

      expect(answered?.items).toEqual([]);
      expect(answered?.total).toBe(0);
    });
  });
});
