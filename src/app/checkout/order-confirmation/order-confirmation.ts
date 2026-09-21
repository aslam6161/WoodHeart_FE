import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AccountService } from '../../_services/account.service';
import { OrderService } from '../../_services/order.service';
import { SeoService } from '../../_services/seo.service';
import { OrderDetail } from '../../_models/order';
import { OrderDetailCard } from '../../orders/order-detail-card/order-detail-card';

/**
 * "Thank you — your order is placed."
 *
 * Reached from checkout with the order number in the URL and, for a guest,
 * the phone number in router state. That state is what lets the page read
 * the order back: a guest has no account for the order to be "theirs"
 * against, so the API is asked with number and phone together, the same way
 * the tracking page will ask later.
 *
 * <b>Arriving without the state is not an error.</b> A customer who refreshes,
 * or opens the link from the SMS, lands here with only the number. They still
 * get the confirmation — number, next steps, what to expect — without the
 * line-by-line detail, and a way to look it up.
 */
@Component({
  selector: 'app-order-confirmation',
  imports: [RouterLink, OrderDetailCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-8">
          <div class="text-center mb-4">
            <div class="wh-tick mx-auto mb-3" aria-hidden="true">&#10003;</div>
            <h1 class="h3 mb-1">
              {{ alreadyPlaced() ? 'Your order was already placed' : 'Thank you for your order' }}
            </h1>
            <p class="text-muted mb-0">
              Order number
              <strong class="text-dark">{{ orderNumber() }}</strong>
            </p>
          </div>

          <div class="border rounded p-3 p-md-4 mb-4">
            <h2 class="h6 text-uppercase text-muted">What happens next</h2>
            <ol class="mb-0 small">
              <li class="mb-1">
                We send a confirmation by SMS to the number you gave. Keep the order
                number — it is how we find your order when you call.
              </li>
              <li class="mb-1">We confirm the order and prepare it for delivery.</li>
              <li>
                Our rider calls before setting out.
                @if (order()?.paymentStatus === 'Unpaid') {
                  Please have the amount ready in cash.
                }
              </li>
            </ol>
          </div>

          @if (order(); as detail) {
            <app-order-detail-card [order]="detail" [showStatus]="false" [showTimeline]="false" />
          } @else if (loading()) {
            <p class="text-muted small text-center">Loading your order…</p>
          } @else {
            <p class="text-muted small text-center">
              The full details are in your SMS confirmation. You can also
              <a routerLink="/track" [queryParams]="{ order: orderNumber() }">look the order up</a>
              with the number and your mobile number.
            </p>
          }

          <div class="d-grid d-sm-flex justify-content-sm-center gap-2 mt-4">
            <a class="btn btn-dark" routerLink="/products">Continue shopping</a>
            @if (account.isAuthenticated()) {
              <a class="btn btn-outline-dark" [routerLink]="['/account/orders', orderNumber()]">
                View this order
              </a>
            } @else {
              <a class="btn btn-outline-dark" routerLink="/track" [queryParams]="{ order: orderNumber() }">
                Track this order
              </a>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .wh-tick {
      width: 3.5rem;
      height: 3.5rem;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #1f1a17;
      color: #fff;
      font-size: 1.75rem;
    }
  `
})
export class OrderConfirmation implements OnInit {
  private readonly orders = inject(OrderService);
  protected readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the route. */
  readonly orderNumber = input.required<string>();

  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly alreadyPlaced = signal(false);

  /**
   * The phone number checkout handed over, if this is the navigation that
   * followed placing the order. Read once, here, because router state exists
   * only on that navigation and is gone on refresh.
   */
  private readonly contactPhone: string | null;

  constructor() {
    // Router state during the navigation from checkout; the session history
    // entry after a refresh of the same page. Neither exists on the server.
    const state = (this.router.getCurrentNavigation()?.extras.state ??
      (typeof history === 'undefined' ? undefined : history.state)) as
      | { contactPhone?: string; alreadyPlaced?: boolean }
      | undefined;

    this.contactPhone = state?.contactPhone ?? null;
    this.alreadyPlaced.set(state?.alreadyPlaced === true);

    this.seo.apply({ title: 'Order placed', canonicalPath: '/checkout/confirmation', noIndex: true });
  }

  ngOnInit(): void {
    const number = this.orderNumber();

    // A signed-in customer's own order can be read directly. A guest's needs
    // the phone that checkout handed over, and with neither the page settles
    // for the number and the next steps.
    const source = this.account.isAuthenticated()
      ? this.orders.getMineByNumber(number)
      : this.contactPhone
        ? this.orders.lookup({ orderNumber: number, contactPhone: this.contactPhone })
        : null;

    if (!source) {
      return;
    }

    this.loading.set(true);

    source
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(detail => {
        this.loading.set(false);
        this.order.set(detail);
      });
  }
}
