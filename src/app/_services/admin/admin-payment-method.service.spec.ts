import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminPaymentMethodService } from './admin-payment-method.service';
import { environment } from '../../../environments/environment';
import { UpdatePaymentMethod } from '../../_models/payment-methods';
import { HANDLES_NOT_FOUND, SILENT_FAILURE } from '../../_interceptors/http-context';

const base = `${environment.apiUrl}admin/payment-methods`;

function update(overrides: Partial<UpdatePaymentMethod> = {}): UpdatePaymentMethod {
  return {
    displayNameEn: 'Cash on delivery',
    isEnabled: true,
    sortOrder: 10,
    mode: 'Live',
    availableInsideDhaka: true,
    availableOutsideDhaka: true,
    chargeType: 'None',
    chargeValue: 0,
    ...overrides
  };
}

describe('AdminPaymentMethodService', () => {
  let service: AdminPaymentMethodService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminPaymentMethodService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getAll', () => {
    it('treats a reply with no data as nothing configured rather than a crash', () => {
      let answered: unknown[] | undefined;

      service.getAll().subscribe(methods => (answered = methods));

      http.expectOne(base).flush({ isSuccess: true });

      expect(answered).toEqual([]);
    });
  });

  describe('get', () => {
    it('reads one by its code, escaped', () => {
      service.get('a code/with a slash').subscribe();

      http.expectOne(`${base}/a%20code%2Fwith%20a%20slash`).flush({ isSuccess: true, data: null });
    });

    it('answers null for a code nobody has', () => {
      // There is no create, so a code that does not exist is simply absent —
      // not the start of a new method.
      let answered: unknown = 'untouched';

      service.get('nagad').subscribe(method => (answered = method));

      const request = http.expectOne(`${base}/nagad`);

      expect(request.request.context.get(HANDLES_NOT_FOUND)).toBe(true);
      request.flush({ isSuccess: false }, { status: 404, statusText: 'Not Found' });

      expect(answered).toBeNull();
    });
  });

  describe('update', () => {
    it('leaves the credential out when the screen has nothing to say about it', () => {
      // The ordinary save. The screen was never given the secret, so it has
      // nothing to send back — and an absent field is what tells the API to
      // keep what is stored. Sending an empty string here would wipe a
      // merchant key on a spelling correction.
      service.update('bkash', update()).subscribe();

      const request = http.expectOne(`${base}/bkash`);

      expect(request.request.method).toBe('PUT');
      expect('credentials' in request.request.body).toBe(false);

      request.flush({ isSuccess: true, data: null });
    });

    it('sends an empty string only when the credential is being cleared', () => {
      service.update('bkash', update({ credentials: '' })).subscribe();

      const request = http.expectOne(`${base}/bkash`);

      expect(request.request.body.credentials).toBe('');
      request.flush({ isSuccess: true, data: null });
    });

    it('sends a new credential as typed, once', () => {
      service.update('bkash', update({ credentials: '{"appKey":"k"}' })).subscribe();

      const request = http.expectOne(`${base}/bkash`);

      expect(request.request.body.credentials).toBe('{"appKey":"k"}');
      request.flush({ isSuccess: true, data: null });
    });

    it('hands a refusal back as the envelope the API sent', () => {
      // "Nothing in the shop can take money this way yet" is about the switch
      // the admin just pressed, and belongs beside it rather than in a toast.
      let answered: { isSuccess?: boolean; errorCode?: string | null } | undefined;

      service.update('bkash', update()).subscribe(response => (answered = response));

      const request = http.expectOne(`${base}/bkash`);

      expect(request.request.context.get(SILENT_FAILURE)).toBe(true);

      request.flush(
        {
          isSuccess: false,
          errorCode: 'payments.not_implemented.conflict',
          message: 'Nothing in the shop can take money this way yet.'
        },
        { status: 409, statusText: 'Conflict' }
      );

      expect(answered?.isSuccess).toBe(false);
      expect(answered?.errorCode).toBe('payments.not_implemented.conflict');
    });
  });
});
