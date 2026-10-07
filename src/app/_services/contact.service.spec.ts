import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { SILENT_FAILURE } from '../_interceptors/http-context';
import { ContactService } from './contact.service';
import { ContactDetails } from '../_models/contact';

describe('ContactService', () => {
  let service: ContactService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}contact`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(ContactService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('details', () => {
    it('hands back what the shop has filled in', () => {
      let details: ContactDetails | undefined;

      service.details().subscribe(value => (details = value));

      http.expectOne(`${base}/details`).flush({
        isSuccess: true,
        data: { phone: '01712345678', phoneE164: '+8801712345678' }
      });

      expect(details?.phone).toBe('01712345678');
      expect(details?.address).toBeUndefined();
    });

    it('falls back to an empty shop rather than failing the page', () => {
      let details: ContactDetails | undefined;

      // The other half of this page is a form that works regardless. A page
      // that refuses to render because an address line could not be fetched
      // helps nobody.
      service.details().subscribe(value => (details = value));

      http.expectOne(`${base}/details`).error(new ProgressEvent('network'));

      expect(details).toEqual({});
    });

    it('fails silently, because nobody asked for it', () => {
      service.details().subscribe();

      const request = http.expectOne(`${base}/details`);

      expect(request.request.context.get(SILENT_FAILURE)).toBe(true);

      request.flush({ isSuccess: true, data: {} });
    });
  });

  describe('send', () => {
    it('posts the message', () => {
      service
        .send({ name: 'Rafiq', phone: '01712345678', topic: 'Product', message: 'A wardrobe?' })
        .subscribe();

      const request = http.expectOne(base);

      expect(request.request.method).toBe('POST');
      expect(request.request.body.name).toBe('Rafiq');
      expect(request.request.body.topic).toBe('Product');

      request.flush({ isSuccess: true, data: { replyTo: '01712345678' } });
    });

    it('hands back the envelope so the refusal can be shown against a field', () => {
      let received: { isSuccess: boolean; errorCode?: string | null } | undefined;

      service
        .send({ name: 'Rafiq', topic: 'General', message: 'A wardrobe?' })
        .subscribe(response => (received = response));

      // "Leave a number or an email" and "that mobile number is not valid" are
      // different sentences belonging under different inputs, and only the
      // errorCode says which.
      http.expectOne(base).flush(
        {
          isSuccess: false,
          errorCode: 'support.contact.no_reply_route',
          message: 'Leave a mobile number or an email address so we can reply.'
        },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(received?.isSuccess).toBe(false);
      expect(received?.errorCode).toBe('support.contact.no_reply_route');
    });
  });
});
