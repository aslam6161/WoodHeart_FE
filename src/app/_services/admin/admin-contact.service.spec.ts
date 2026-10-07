import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { AdminContactService } from './admin-contact.service';

describe('AdminContactService', () => {
  let service: AdminContactService;
  let http: HttpTestingController;

  const base = `${environment.apiUrl}admin/contact-messages`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AdminContactService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('search', () => {
    it('sends only the filters that are set', () => {
      service.search({ page: 2, status: 'New' }).subscribe();

      const request = http.expectOne(r => r.url === base);

      expect(request.request.params.get('page')).toBe('2');
      expect(request.request.params.get('status')).toBe('New');
      // An empty topic must not become "topic=", which the API would read as a
      // filter nothing matches.
      expect(request.request.params.has('topic')).toBe(false);
      expect(request.request.params.has('term')).toBe(false);

      request.flush({ isSuccess: true, data: { items: [], total: 0, page: 2, pageSize: 20 } });
    });

    it('hands back an empty page rather than nothing when the body is empty', () => {
      let items: unknown[] | undefined;

      service.search({}).subscribe(result => (items = result.items));

      http.expectOne(r => r.url === base).flush({ isSuccess: true });

      expect(items).toEqual([]);
    });
  });

  describe('get', () => {
    it('refreshes the unread count, because opening a message changes it', () => {
      service.get(1).subscribe();

      http.expectOne(`${base}/1`).flush({
        isSuccess: true,
        data: { id: 1, name: 'Rafiq', status: 'Read' }
      });

      // The badge would otherwise sit one ahead of the truth until the next
      // full page load.
      http.expectOne(`${base}/new-count`).flush({ isSuccess: true, data: 3 });

      expect(service.newCount()).toBe(3);
    });

    it('treats a missing message as an answer, not a failure', () => {
      let message: unknown;

      service.get(404).subscribe(value => (message = value));

      http.expectOne(`${base}/404`).flush(
        { isSuccess: false, errorCode: 'support.contact_message.not_found' },
        { status: 404, statusText: 'Not Found' }
      );

      expect(message).toBeNull();

      // And no count is fetched: nothing was opened, so nothing changed.
      http.expectNone(`${base}/new-count`);
    });
  });

  describe('refreshCount', () => {
    it('reads zero rather than breaking the menu when it cannot be fetched', () => {
      service.refreshCount();

      http.expectOne(`${base}/new-count`).error(new ProgressEvent('network'));

      expect(service.newCount()).toBe(0);
    });
  });
});
