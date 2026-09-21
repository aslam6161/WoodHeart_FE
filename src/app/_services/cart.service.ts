import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GeneralResponseOf } from '../_models/generalResponse';
import { Cart, DeliveryZone, EMPTY_CART } from '../_models/cart';
import { silentFailure } from '../_interceptors/http-context';
import { AccountService } from './account.service';

/**
 * The basket, held as state.
 *
 * <b>One copy, owned here.</b> The header badge, the product page's "Add to
 * basket" and the basket page all read the same signal, and every mutation
 * replaces it with whatever the API answered. Nothing in the client adds a
 * line total to a subtotal: the API is the only thing that knows the VAT rate
 * and the delivery rate card, and a client that repeated that arithmetic would
 * be right until the day the rate changed.
 *
 * <b>Never loaded on the server.</b> A basket belongs to one visitor and is
 * found by their cookie or their anonymous id, neither of which the server
 * render has. Loading it there would either fail quietly or — worse, on a
 * shared SSR process — put one customer's basket into another's HTML. So the
 * server renders an empty badge and the browser fills it in after hydration.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = `${environment.apiUrl}cart`;

  private readonly basket = signal<Cart>(EMPTY_CART);

  /** Set once the browser has asked the API, whatever the answer was. */
  private readonly ready = signal(false);

  /**
   * True while the first load is in flight.
   *
   * The header and the basket page both call {@link ensureLoaded} during the
   * same page load, before either has an answer. Without this the second
   * call sees "not ready" and sends a second request for the same basket.
   */
  private loading = false;

  readonly cart = this.basket.asReadonly();
  readonly loaded = this.ready.asReadonly();

  readonly itemCount = computed(() => this.basket().totals.itemCount);
  readonly isEmpty = computed(() => this.basket().lines.length === 0);

  /**
   * Loads the basket if the browser has not yet asked for it.
   *
   * Idempotent, so the header and the basket page can both call it on
   * construction without the second call costing a request. Fails silently:
   * a visitor with no basket is the ordinary case, and a red toast about
   * baskets on the home page is not what a first-time visitor should meet.
   */
  ensureLoaded(): void {
    if (this.ready() || this.loading || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loading = true;

    // After the session restore, not before. On a full page load the access
    // token is gone and comes back from the refresh cookie a round trip
    // later; a basket asked for in that gap is asked for as a guest, and a
    // signed-in customer gets an empty badge for the basket they have. The
    // restore is memoised, so this costs nothing the guards were not already
    // paying, and it resolves at once for a visitor with no session.
    this.account.ensureRestored().then(() => this.refresh().subscribe());
  }

  /** Re-reads the basket from the API, e.g. after signing in merges a guest's lines. */
  refresh(): Observable<Cart> {
    return this.http
      .get<GeneralResponseOf<Cart>>(this.baseUrl, { context: silentFailure() })
      .pipe(
        map(response => response.data ?? EMPTY_CART),
        catchError(() => of(EMPTY_CART)),
        tap(cart => this.replace(cart))
      );
  }

  /** Puts a variant in the basket, or adds to what is already there. */
  add(variantId: number, quantity = 1): Observable<Cart> {
    return this.http
      .post<GeneralResponseOf<Cart>>(`${this.baseUrl}/items`, { variantId, quantity })
      .pipe(this.applyResponse());
  }

  /** Sets one line's quantity. Zero removes the line. */
  updateLine(lineId: number, quantity: number): Observable<Cart> {
    return this.http
      .put<GeneralResponseOf<Cart>>(`${this.baseUrl}/items/${lineId}`, { quantity })
      .pipe(this.applyResponse());
  }

  removeLine(lineId: number): Observable<Cart> {
    return this.http
      .delete<GeneralResponseOf<Cart>>(`${this.baseUrl}/items/${lineId}`)
      .pipe(this.applyResponse());
  }

  clear(): Observable<Cart> {
    return this.http.delete<GeneralResponseOf<Cart>>(this.baseUrl).pipe(this.applyResponse());
  }

  /**
   * Tells the basket where it is going, so delivery can be priced.
   *
   * Until this is set the totals say "calculated at checkout". Quoting a
   * Dhaka rate and then raising it when the address turns out to be Sylhet is
   * the surprise that loses the order, so the basket page asks first.
   */
  setDeliveryZone(zone: DeliveryZone): Observable<Cart> {
    return this.http
      .put<GeneralResponseOf<Cart>>(`${this.baseUrl}/delivery-zone`, { zone })
      .pipe(this.applyResponse());
  }

  /**
   * Forgets the basket without asking the API.
   *
   * Called after an order is placed: the API has already retired the cart, and
   * a header still showing "3" over a basket that no longer exists is the kind
   * of thing that makes a customer press "Place order" a second time.
   */
  forget(): void {
    this.replace(EMPTY_CART);
  }

  private applyResponse() {
    return (source: Observable<GeneralResponseOf<Cart>>): Observable<Cart> =>
      source.pipe(
        map(response => response.data ?? EMPTY_CART),
        tap(cart => this.replace(cart))
      );
  }

  private replace(cart: Cart): void {
    this.basket.set(cart);
    this.ready.set(true);
    this.loading = false;
  }
}
