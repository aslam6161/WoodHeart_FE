import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { FeaturesService } from './features.service';

/**
 * What the storefront may show.
 *
 * The decisions worth pinning are both about what happens before the answer
 * arrives, or when it never does: the header is on every page, and a link that
 * appears or disappears a moment late moves what the reader was about to click.
 */
describe('FeaturesService', () => {
  let service: FeaturesService;
  let http: HttpTestingController;

  const url = `${environment.apiUrl}features`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(FeaturesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('offers consultations before the answer arrives', () => {
    // Optimistic on purpose. The shop offers them far more often than not, so
    // starting hidden would flicker the header on every page load for
    // everybody to spare a rare case.
    expect(service.features().consultations).toBe(true);
  });

  it('takes the answer the shop gives', () => {
    service.ensureLoaded();

    http.expectOne(url).flush({ isSuccess: true, data: { consultations: false } });

    expect(service.features().consultations).toBe(false);
  });

  it('asks once however many pages are drawn', () => {
    service.ensureLoaded();
    service.ensureLoaded();
    service.ensureLoaded();

    http.expectOne(url).flush({ isSuccess: true, data: { consultations: true } });
  });

  it('leaves the header alone when the API cannot be reached', () => {
    service.ensureLoaded();

    http.expectOne(url).error(new ProgressEvent('network'));

    // The pages themselves say what is wrong, in their own words. Emptying the
    // header because one request failed would be a worse page than one link
    // that turns out to be unavailable.
    expect(service.features().consultations).toBe(true);
  });

  it('ignores an envelope with nothing in it', () => {
    service.ensureLoaded();

    http.expectOne(url).flush({ isSuccess: true, data: null });

    expect(service.features().consultations).toBe(true);
  });
});
