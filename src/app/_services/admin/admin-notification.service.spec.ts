import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminNotificationService } from './admin-notification.service';
import { environment } from '../../../environments/environment';
import { HANDLES_NOT_FOUND, SILENT_FAILURE } from '../../_interceptors/http-context';

const base = `${environment.apiUrl}admin/notifications`;

describe('AdminNotificationService', () => {
  let service: AdminNotificationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminNotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getTemplates', () => {
    it('treats a reply with no data as nothing configured rather than a crash', () => {
      let answered:
        | { templates: unknown[]; smsGatewayConfigured: boolean; shopPhoneConfigured: boolean }
        | undefined;

      service.getTemplates().subscribe(result => (answered = result));

      http.expectOne(`${base}/templates`).flush({ isSuccess: true });

      expect(answered?.templates).toEqual([]);
      // Claiming any of these is configured when the reply did not say so
      // would hide the warnings this screen exists to show.
      expect(answered?.smsGatewayConfigured).toBe(false);
      expect(answered?.shopPhoneConfigured).toBe(false);
    });
  });

  describe('getTemplate', () => {
    it('reads one by its code, escaped', () => {
      service.getTemplate('a code/with a slash').subscribe();

      http
        .expectOne(`${base}/templates/a%20code%2Fwith%20a%20slash`)
        .flush({ isSuccess: true, data: null });
    });

    it('answers null for a kind of message nothing sends', () => {
      // There is no create: a code nothing renders is simply absent, not the
      // start of a new template.
      let answered: unknown = 'untouched';

      service.getTemplate('payment.refunded').subscribe(result => (answered = result));

      const request = http.expectOne(`${base}/templates/payment.refunded`);

      expect(request.request.context.get(HANDLES_NOT_FOUND)).toBe(true);
      request.flush({ isSuccess: false }, { status: 404, statusText: 'Not Found' });

      expect(answered).toBeNull();
    });
  });

  describe('updateTemplate', () => {
    it('sends only the two decisions the shop gets to make', () => {
      // Not the wording. Every message is written to fit the fewest billed
      // parts that still says the thing, in two languages.
      service.updateTemplate('order.placed', { smsEnabled: false, emailEnabled: true }).subscribe();

      const request = http.expectOne(`${base}/templates/order.placed`);

      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ smsEnabled: false, emailEnabled: true });

      request.flush({ isSuccess: true, data: null });
    });

    it('hands a refusal back as the envelope the API sent', () => {
      let answered: { isSuccess?: boolean; errorCode?: string | null } | undefined;

      service
        .updateTemplate('payment.refunded', { smsEnabled: true, emailEnabled: true })
        .subscribe(response => (answered = response));

      const request = http.expectOne(`${base}/templates/payment.refunded`);

      expect(request.request.context.get(SILENT_FAILURE)).toBe(true);

      request.flush(
        {
          isSuccess: false,
          errorCode: 'notifications.template.not_found',
          message: 'Nothing in the shop sends a message of that kind.'
        },
        { status: 404, statusText: 'Not Found' }
      );

      expect(answered?.isSuccess).toBe(false);
      expect(answered?.errorCode).toBe('notifications.template.not_found');
    });
  });

  describe('searchMessages', () => {
    it('leaves an empty filter out of the query rather than sending a blank', () => {
      service.searchMessages({ term: '', status: null, type: null, page: 2 }).subscribe();

      const request = http.expectOne(
        r => r.url === `${base}/messages` && r.params.get('page') === '2'
      );

      expect(request.request.params.has('term')).toBe(false);
      expect(request.request.params.has('status')).toBe(false);
      expect(request.request.params.has('type')).toBe(false);

      request.flush({ isSuccess: true, data: null });
    });

    it('passes the order number and what happened', () => {
      service.searchMessages({ term: 'WH-2609-00042', status: 'Failed' }).subscribe();

      const request = http.expectOne(
        r => r.url === `${base}/messages` && r.params.get('term') === 'WH-2609-00042'
      );

      expect(request.request.params.get('status')).toBe('Failed');

      request.flush({ isSuccess: true, data: null });
    });

    it('answers an empty page rather than undefined when the reply has no data', () => {
      let answered: { items: unknown[]; total: number } | undefined;

      service.searchMessages({}).subscribe(result => (answered = result));

      http.expectOne(r => r.url === `${base}/messages`).flush({ isSuccess: true });

      expect(answered).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('resend', () => {
    it('posts an empty body to the message it names', () => {
      service.resend(42).subscribe();

      const request = http.expectOne(`${base}/messages/42/resend`);

      expect(request.request.method).toBe('POST');
      request.flush({ isSuccess: true, data: null });
    });

    it('hands back the refusal for one that is already on its way', () => {
      // "This one is still queued" belongs beside the row somebody pressed,
      // not in a toast floating over a table of forty.
      let answered: { errorCode?: string | null; message?: string | null } | undefined;

      service.resend(42).subscribe(response => (answered = response));

      const request = http.expectOne(`${base}/messages/42/resend`);

      expect(request.request.context.get(SILENT_FAILURE)).toBe(true);

      request.flush(
        {
          isSuccess: false,
          errorCode: 'notifications.not_resendable.conflict',
          message: 'This one is still queued — it is already on its way.'
        },
        { status: 409, statusText: 'Conflict' }
      );

      expect(answered?.errorCode).toBe('notifications.not_resendable.conflict');
      expect(answered?.message).toContain('already on its way');
    });
  });
});
