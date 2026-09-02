import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, firstValueFrom, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ChangePasswordDto, LoginDto, RegisterDto, User } from '../_models/user';
import { GeneralResponse, GeneralResponseOf } from '../_models/generalResponse';
import { silentFailure } from '../_interceptors/http-context';

/**
 * Holds who is signed in.
 *
 * <b>The access token is kept in memory and nowhere else.</b> An earlier
 * version of this service wrote the whole user, token included, into
 * `localStorage`. That is the ordinary way to do it and it is the thing
 * PLAN.md §12 rules out: `localStorage` is readable by every script on the
 * page, so one bad dependency or one unescaped review field walks away with a
 * live session. Here the token is a signal that dies with the tab, and the
 * session is carried by an `HttpOnly` cookie no script can read.
 *
 * The cost of that choice is one request: a page refresh loses the token, so
 * {@link restoreSession} asks the API to mint a new one from the cookie during
 * start-up. That is the trade — a single silent call against a class of attack
 * that otherwise ends with somebody else's admin session.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly baseUrl = `${environment.apiUrl}account/`;

  private readonly currentUser = signal<User | null>(null);

  /**
   * The one in-flight session restore, memoised.
   *
   * The guards await this. Without it, a signed-in admin who reloads
   * `/admin/products` is bounced to the storefront — the guard runs before the
   * refresh has answered and correctly sees nobody signed in. Memoised because
   * three guards and a resolver on one navigation must not each fire their own
   * refresh: the token rotates on every use, so the second call would present a
   * token the first had already replaced and trip the reuse alarm, signing the
   * admin out for the crime of loading a page.
   */
  private restored?: Promise<boolean>;

  readonly user = this.currentUser.asReadonly();

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly accessToken = computed(() => this.currentUser()?.accessToken ?? null);
  readonly roles = computed(() => this.currentUser()?.roles ?? []);
  readonly isAdmin = computed(() => this.hasAnyRole('Admin'));
  readonly isStaff = computed(() => this.hasAnyRole('Admin', 'Manager', 'Staff'));

  private readonly anonymous = signal<string | null>(null);
  readonly anonymousId = this.anonymous.asReadonly();

  constructor() {
    // Guarded: this service is constructed during server-side rendering too,
    // where localStorage does not exist. Touching it there throws and takes the
    // whole SSR render down.
    if (isPlatformBrowser(this.platformId)) {
      this.ensureAnonymousId();
    }
  }

  hasAnyRole(...roles: string[]): boolean {
    const current = this.currentUser()?.roles ?? [];

    return roles.some(role => current.includes(role));
  }

  login(dto: LoginDto): Observable<GeneralResponseOf<User>> {
    return this.http
      .post<GeneralResponseOf<User>>(`${this.baseUrl}login`, dto, {
        // Without this the browser neither stores nor returns the refresh
        // cookie, and the session silently lasts exactly fifteen minutes.
        withCredentials: true
      })
      .pipe(tap(response => this.markSignedIn(response.data ?? null)));
  }

  register(dto: RegisterDto): Observable<GeneralResponseOf<User>> {
    return this.http
      .post<GeneralResponseOf<User>>(`${this.baseUrl}register`, dto, { withCredentials: true })
      .pipe(tap(response => this.markSignedIn(response.data ?? null)));
  }

  /**
   * Restores a session from the refresh cookie, at most once per page load.
   *
   * <b>Failure is the normal case and must be invisible.</b> Most visitors have
   * never signed in, so this answers 401 far more often than it returns a
   * session — see `SILENT_FAILURE`. Resolves either way, and never rejects:
   * a guard that throws on a first-time visitor is a broken site, not a
   * security measure.
   */
  ensureRestored(): Promise<boolean> {
    if (this.restored) {
      return this.restored;
    }

    if (!isPlatformBrowser(this.platformId)) {
      // No cookie reaches the server render, and a session restored there would
      // belong to whichever visitor the process happened to serve first.
      this.restored = Promise.resolve(false);

      return this.restored;
    }

    this.restored = firstValueFrom(
      this.http
        .post<GeneralResponseOf<User>>(
          `${this.baseUrl}refresh`,
          {},
          { withCredentials: true, context: silentFailure() }
        )
        .pipe(
          tap(response => this.currentUser.set(response.data ?? null)),
          map(response => response.data != null),
          catchError(() => of(false))
        )
    );

    return this.restored;
  }

  /**
   * Signs out here and on the server.
   *
   * Both halves are needed. Clearing the signal ends this tab's session;
   * the request revokes the refresh token, without which the cookie keeps
   * working for another thirty days on any machine that has it.
   */
  logout(): Observable<GeneralResponse> {
    this.currentUser.set(null);

    // The memoised restore held "yes, signed in". Leaving it would let a guard
    // on the next navigation resolve against a session that has just ended.
    this.restored = Promise.resolve(false);

    return this.http
      .post<GeneralResponse>(
        `${this.baseUrl}logout`,
        {},
        { withCredentials: true, context: silentFailure() }
      )
      .pipe(
        catchError(() =>
          // The local half already happened, and it is the half the person in
          // front of the screen can see. A network failure must not leave them
          // looking at an admin panel they believe they have left.
          of({ id: 0, isSuccess: true, message: 'Signed out.' } as GeneralResponse)
        )
      );
  }

  changePassword(dto: ChangePasswordDto): Observable<GeneralResponse> {
    return this.http
      .post<GeneralResponse>(`${this.baseUrl}change-password`, dto, { withCredentials: true })
      .pipe(
        // The server revokes every session on success, including this one, so
        // staying signed in here would mean a UI that works until the next
        // refresh and then fails without explanation.
        tap(response => {
          if (response.isSuccess) {
            this.currentUser.set(null);
            this.restored = Promise.resolve(false);
          }
        })
      );
  }

  /** Re-reads the current user, so a role change lands without signing out. */
  loadCurrentUser(): Observable<User | null> {
    return this.http.get<GeneralResponseOf<User>>(`${this.baseUrl}me`).pipe(
      map(response => response.data ?? null),
      tap(user => {
        // `/me` deliberately returns no token. Merging keeps the one in memory.
        if (user) {
          this.currentUser.update(current =>
            current ? { ...user, accessToken: current.accessToken } : user
          );
        }
      }),
      catchError(() => of(null))
    );
  }

  /** Records a fresh sign-in, and settles the memoised restore to match. */
  private markSignedIn(user: User | null): void {
    this.currentUser.set(user);
    this.restored = Promise.resolve(user !== null);
  }

  private ensureAnonymousId(): void {
    let id = localStorage.getItem(environment.anonymousIdKey);

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(environment.anonymousIdKey, id);
    }

    this.anonymous.set(id);
  }
}
