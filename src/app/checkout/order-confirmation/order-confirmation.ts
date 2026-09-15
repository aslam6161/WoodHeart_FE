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
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AccountService } from '../../_services/account.service';
import { OrderService } from '../../_services/order.service';
import { SeoService } from '../../_services/seo.service';
import { ORDER_STATUS_LABELS, OrderDetail } from '../../_models/order';
import { TakaPipe } from '../../_pipes/taka.pipe';

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
  imports: [RouterLink, TakaPipe, DatePipe],
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
            <div class="row g-4 mb-4">
              <div class="col-12 col-md-6">
                <h2 class="h6 text-uppercase text-muted">Delivering to</h2>
                <address class="small mb-0">
                  <strong>{{ detail.contactName }}</strong><br />
                  {{ detail.contactPhone }}<br />
                  {{ detail.shippingAddress.addressLine }}<br />
                  @if (detail.shippingAddress.landmark; as landmark) {
                    {{ landmark }}<br />
                  }
                  @if (detail.shippingAddress.area; as area) {
                    {{ area }},
                  }
                  {{ detail.shippingAddress.district }}, {{ detail.shippingAddress.division }}
                </address>
              </div>

              <div class="col-12 col-md-6">
                <h2 class="h6 text-uppercase text-muted">Payment</h2>
                <p class="small mb-1">
                  {{ detail.paymentMethodCode === 'cod' ? 'Cash on delivery' : detail.paymentMethodCode }}
                </p>
                <p class="small text-muted mb-0">
                  Status: {{ statusLabel(detail) }} &middot; placed
                  {{ detail.placedAt | date: 'd MMM yyyy, h:mm a' }}
                </p>
              </div>
            </div>

            <h2 class="h6 text-uppercase text-muted">Items</h2>
            <ul class="list-unstyled border-top mb-3">
              @for (line of detail.lines; track line.id) {
                <li class="d-flex justify-content-between gap-3 py-2 border-bottom small">
                  <span>
                    {{ line.quantity }} &times; {{ line.productName }}
                    <span class="text-muted">{{ line.variantName }}</span>
                  </span>
                  <span class="flex-shrink-0">{{ line.lineTotal | taka }}</span>
                </li>
              }
            </ul>

            <dl class="row small mb-0 justify-content-end">
              <dt class="col-8 col-md-9 fw-normal text-md-end">Subtotal</dt>
              <dd class="col-4 col-md-3 text-end">{{ detail.totals.subtotal | taka }}</dd>

              @if (detail.totals.discountTotal > 0) {
                <dt class="col-8 col-md-9 fw-normal text-md-end">Discount</dt>
                <dd class="col-4 col-md-3 text-end">&minus;{{ detail.totals.discountTotal | taka }}</dd>
              }

              <dt class="col-8 col-md-9 fw-normal text-md-end">Delivery</dt>
              <dd class="col-4 col-md-3 text-end">
                @if (detail.totals.deliveryWaived && detail.totals.deliveryFee === 0) {
                  Free
                } @else {
                  {{ detail.totals.deliveryFee | taka }}
                }
              </dd>

              @if (detail.totals.paymentSurcharge > 0) {
                <dt class="col-8 col-md-9 fw-normal text-md-end">Payment charge</dt>
                <dd class="col-4 col-md-3 text-end">{{ detail.totals.paymentSurcharge | taka }}</dd>
              }

              <dt class="col-8 col-md-9 text-md-end">Total</dt>
              <dd class="col-4 col-md-3 text-end fw-semibold">{{ detail.totals.grandTotal | taka }}</dd>

              @if (detail.totals.pricesIncludeVat && detail.totals.vatAmount > 0) {
                <dd class="col-12 text-md-end text-muted mb-0">
                  Includes VAT at {{ detail.totals.vatRatePercent }}%:
                  {{ detail.totals.vatAmount | taka }}
                </dd>
              }
            </dl>
          } @else if (loading()) {
            <p class="text-muted small text-center">Loading your order…</p>
          } @else {
            <p class="text-muted small text-center">
              The full details are in your SMS confirmation.
            </p>
          }

          <div class="d-grid d-sm-flex justify-content-sm-center gap-2 mt-4">
            <a class="btn btn-dark" routerLink="/products">Continue shopping</a>
            <a class="btn btn-outline-dark" routerLink="/">Back to home</a>
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
  private readonly account = inject(AccountService);
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

  protected statusLabel(detail: OrderDetail): string {
    return ORDER_STATUS_LABELS[detail.status] ?? detail.status;
  }
}
