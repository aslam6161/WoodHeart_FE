import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AccountService } from './account.service';
import { SILENT_FAILURE } from '../_interceptors/http-context';
import { environment } from '../../environments/environment';
import { User } from '../_models/user';

const base = `${environment.apiUrl}account/`;

function aUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    fullName: 'Ayesha Rahman',
    phoneNumber: '+8801712345678',
    roles: ['Admin'],
    accessToken: 'the-access-token',
    accessTokenExpiresAt: new Date().toISOString(),
    preferredLanguage: 'en',
    ...overrides
  };
}

describe('AccountService', () => {
  let account: AccountService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    account = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('never writes the access token to localStorage', () => {
    account.login({ phoneNumber: '01712345678', password: 'secret' }).subscribe();

    http.expectOne(`${base}login`).flush({ isSuccess: true, data: aUser() });

    expect(account.accessToken()).toBe('the-access-token');

    // The whole reason this service was rewritten. localStorage is readable by
    // every script on the page, so a token there is a session one bad
    // dependency can walk off with. A snapshot of the entire store is checked
    // rather than one key, because the mistake is usually a stray `setItem`.
    const stored = Object.keys(localStorage).map(key => localStorage.getItem(key) ?? '');

    expect(stored.some(value => value.includes('the-access-token'))).toBe(false);
  });

  it('sends credentials on every call that needs the refresh cookie', () => {
    account.login({ phoneNumber: '01712345678', password: 'secret' }).subscribe();

    // Without withCredentials the browser neither stores the Set-Cookie nor
    // returns it, and the session silently lasts exactly one access token.
    const login = http.expectOne(`${base}login`);

    expect(login.request.withCredentials).toBe(true);
    login.flush({ isSuccess: true, data: aUser() });

    account.logout().subscribe();
    expect(http.expectOne(`${base}logout`).request.withCredentials).toBe(true);
  });

  it('restores a session from the cookie exactly once, however many callers ask', async () => {
    const first = account.ensureRestored();
    const second = account.ensureRestored();

    // Three guards on one navigation must not each rotate the refresh token.
    // The second call would present a token the first had already replaced,
    // which the server reads as theft — and signs the admin out for loading a
    // page.
    http.expectOne(`${base}refresh`).flush({ isSuccess: true, data: aUser() });

    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(account.isAuthenticated()).toBe(true);
  });

  it('marks the restore silent, because 401 is the normal answer', () => {
    account.ensureRestored();

    const request = http.expectOne(`${base}refresh`).request;

    // Most visitors have never signed in. Without this the home page of a
    // furniture shop greets them with "Please sign in to continue."
    expect(request.context.get(SILENT_FAILURE)).toBe(true);
    expect(request.withCredentials).toBe(true);
  });

  it('resolves false rather than rejecting when there is no session', async () => {
    const restored = account.ensureRestored();

    http.expectOne(`${base}refresh`).flush(
      { isSuccess: false, errorCode: 'identity.invalid_refresh_token.unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    // A guard that throws on a first-time visitor is a broken site, not a
    // security measure.
    expect(await restored).toBe(false);
    expect(account.isAuthenticated()).toBe(false);
  });

  it('clears the session locally before the sign-out request is answered', () => {
    account.login({ phoneNumber: '01712345678', password: 'secret' }).subscribe();
    http.expectOne(`${base}login`).flush({ isSuccess: true, data: aUser() });

    account.logout().subscribe();

    // The person has pressed Sign out. They must not still be signed in while
    // a request is in flight on a connection that may never answer.
    expect(account.isAuthenticated()).toBe(false);

    http.expectOne(`${base}logout`).flush({ isSuccess: true });
  });

  it('still signs out locally when the network fails', async () => {
    account.login({ phoneNumber: '01712345678', password: 'secret' }).subscribe();
    http.expectOne(`${base}login`).flush({ isSuccess: true, data: aUser() });

    let completed = false;
    account.logout().subscribe(() => (completed = true));

    http.expectOne(`${base}logout`).error(new ProgressEvent('offline'));

    // The local half already happened and it is the half the person can see.
    // An error here would leave them looking at an admin panel they believe
    // they have left.
    expect(completed).toBe(true);
    expect(account.isAuthenticated()).toBe(false);
    expect(await account.ensureRestored()).toBe(false);
  });

  it('does not restore a stale session after signing out', async () => {
    account.login({ phoneNumber: '01712345678', password: 'secret' }).subscribe();
    http.expectOne(`${base}login`).flush({ isSuccess: true, data: aUser() });

    account.logout().subscribe();
    http.expectOne(`${base}logout`).flush({ isSuccess: true });

    // The memoised restore held "yes, signed in". A guard on the next
    // navigation must not resolve against a session that has just ended.
    expect(await account.ensureRestored()).toBe(false);
    http.expectNone(`${base}refresh`);
  });

  it('ends the session when the password changes', () => {
    account.login({ phoneNumber: '01712345678', password: 'secret' }).subscribe();
    http.expectOne(`${base}login`).flush({ isSuccess: true, data: aUser() });

    account.changePassword({ currentPassword: 'secret', newPassword: 'a-longer-one' }).subscribe();
    http.expectOne(`${base}change-password`).flush({ isSuccess: true });

    // The server revokes every session including this one, so staying signed in
    // here means a UI that works until the next refresh and then fails without
    // explanation.
    expect(account.isAuthenticated()).toBe(false);
  });

  it('keeps the in-memory token when /me refreshes the roles', () => {
    account.login({ phoneNumber: '01712345678', password: 'secret' }).subscribe();
    http.expectOne(`${base}login`).flush({ isSuccess: true, data: aUser() });

    account.loadCurrentUser().subscribe();

    // /me deliberately mints no token — it answers "who am I" without extending
    // the session. Overwriting the token with its empty string would sign the
    // admin out on the next request.
    http.expectOne(`${base}me`).flush({
      isSuccess: true,
      data: aUser({ accessToken: '', roles: ['Manager'] })
    });

    expect(account.accessToken()).toBe('the-access-token');
    expect(account.roles()).toEqual(['Manager']);
    expect(account.isAdmin()).toBe(false);
    expect(account.isStaff()).toBe(true);
  });
});
