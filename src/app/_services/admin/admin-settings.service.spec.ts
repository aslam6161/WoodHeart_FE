import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminSettingsService } from './admin-settings.service';
import { StoreSetting } from '../../_models/settings';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}admin/settings`;

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the table out of the envelope', () => {
    let settings: StoreSetting[] = [];

    service.getAll().subscribe(s => (settings = s));

    http.expectOne(base).flush({
      isSuccess: true,
      data: [{ key: 'tax.vat_rate', value: '7.5', valueType: 'Decimal', category: 'Tax' }]
    });

    expect(settings.length).toBe(1);
    expect(settings[0].valueType).toBe('Decimal');
  });

  it('sends the values as strings under "values", in one PUT', () => {
    // One request for the whole screen, so the API can refuse all of it or
    // save all of it. Booleans and numbers travel as strings; the API parses
    // them against each setting's declared type.
    service.update({ values: { 'tax.vat_rate': '15', 'tax.prices_include_vat': 'true' } }).subscribe();

    const request = http.expectOne(base);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      values: { 'tax.vat_rate': '15', 'tax.prices_include_vat': 'true' }
    });

    request.flush({ isSuccess: true, data: [] });
  });
});
