import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { SILENT_FAILURE } from '../_interceptors/http-context';
import { AssistantService } from './assistant.service';

describe('AssistantService', () => {
  let service: AssistantService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}consultations/assistant`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AssistantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('offered', () => {
    it('says no when the API says no', () => {
      let offered: boolean | undefined;

      service.offered().subscribe(value => (offered = value));

      http.expectOne(`${base}/offered`).flush({ isSuccess: true, data: false });

      expect(offered).toBe(false);
    });

    it('says no when the call fails, rather than showing a window that cannot answer', () => {
      let offered: boolean | undefined;

      service.offered().subscribe(value => (offered = value));

      http.expectOne(`${base}/offered`).error(new ProgressEvent('network'));

      expect(offered).toBe(false);
    });

    it('fails silently, because nothing was asked for yet', () => {
      service.offered().subscribe();

      // This call happens on page load without anybody pressing anything. An
      // error toast for it would be the shop apologising to a customer who had
      // not noticed there was a chat window.
      const request = http.expectOne(`${base}/offered`);

      expect(request.request.context.get(SILENT_FAILURE)).toBe(true);

      request.flush({ isSuccess: true, data: true });
    });
  });

  describe('chat', () => {
    it('sends the question with the conversation so far', () => {
      service.chat('How much is delivery?', [{ fromCustomer: true, text: 'Hello' }]).subscribe();

      const request = http.expectOne(`${base}/chat`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body.message).toBe('How much is delivery?');
      expect(request.request.body.history).toHaveLength(1);

      request.flush({ isSuccess: true, data: { reply: 'At checkout.', products: [], actions: [] } });
    });

    it('hands back the envelope when the assistant refuses', () => {
      let received: { isSuccess: boolean; message?: string } | undefined;

      service.chat('Hello', []).subscribe(response => (received = response));

      // "Busy, try again in a moment" and "switched off" are different
      // sentences, and the API is the one that knows which. Throwing the body
      // away with the status would turn both into a shrug.
      http.expectOne(`${base}/chat`).flush(
        { isSuccess: false, message: 'The assistant is answering someone else.' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(received?.isSuccess).toBe(false);
      expect(received?.message).toContain('answering someone else');
    });
  });
});
