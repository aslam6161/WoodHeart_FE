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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OrderService } from '../../_services/order.service';
import { SeoService } from '../../_services/seo.service';
import { ToastService } from '../../_services/toast.service';
import { OrderDetail } from '../../_models/order';
import { ErrorCodes, GeneralResponse } from '../../_models/generalResponse';
import { OrderDetailCard } from '../../orders/order-detail-card/order-detail-card';

/**
 * One of the customer's own orders, and the one thing they can do to it.
 *
 * <b>Cancelling is offered only while the API says it may be.</b> `canCancel`
 * comes with the order; the button appears when it is true and nowhere else,
 * so the page cannot promise a cancellation the shop will refuse. Once work
 * has started the page says so and gives the phone number instead — a
 * half-built wardrobe is a conversation, not a button.
 *
 * The reason is asked for and not required. "Found it cheaper" and "ordered
 * the wrong size" call for different fixes, and neither is discoverable from
 * a cancellation count.
 */
@Component({
  selector: 'app-order-page',
  imports: [FormsModule, RouterLink, OrderDetailCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-9">
          <nav aria-label="breadcrumb" class="small mb-2">
            <a class="text-muted text-decoration-none" routerLink="/account/orders">&lsaquo; Your orders</a>
          </nav>

          @if (order(); as detail) {
            <h1 class="h3 mb-3">
              Order <span class="font-monospace">{{ detail.orderNumber }}</span>
            </h1>

            <app-order-detail-card [order]="detail" />

            @if (detail.canCancel) {
              <div class="border rounded p-3 mt-4">
                @if (!cancelling()) {
                  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <span class="small">Changed your mind? You can still cancel this order.</span>
                    <button class="btn btn-sm btn-outline-danger" type="button" (click)="cancelling.set(true)">
                      Cancel order
                    </button>
                  </div>
                } @else {
                  <h2 class="h6">Cancel this order?</h2>
                  <label class="form-label small" for="reason">Tell us why, if you like</label>
                  <textarea
                    id="reason"
                    class="form-control form-control-sm mb-2"
                    rows="2"
                    maxlength="500"
                    placeholder="Ordered the wrong size, found it elsewhere…"
                    [(ngModel)]="reason"></textarea>
                  <div class="d-flex flex-wrap gap-2">
                    <button
                      class="btn btn-sm btn-danger"
                      type="button"
                      [disabled]="busy()"
                      (click)="confirmCancel()">
                      {{ busy() ? 'Cancelling…' : 'Yes, cancel it' }}
                    </button>
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      type="button"
                      [disabled]="busy()"
                      (click)="cancelling.set(false)">
                      Keep the order
                    </button>
                  </div>
                }
              </div>
            } @else if (isOpen(detail)) {
              <p class="small text-muted mt-4 mb-0">
                Work on this order has started, so it can no longer be cancelled here.
                Please call us and we will sort it out.
              </p>
            }

            @if (refused(); as message) {
              <div class="alert alert-warning small mt-3 mb-0" role="alert">{{ message }}</div>
            }
          } @else if (loading()) {
            <p class="text-muted small">Loading your order…</p>
          } @else {
            <h1 class="h4">We could not find that order</h1>
            <p class="text-muted">
              It may belong to a different account.
              <a routerLink="/account/orders">See your orders</a>, or
              <a routerLink="/track">track an order by its number</a>.
            </p>
          }
        </div>
      </div>
    </div>
  `
})
export class OrderPage implements OnInit {
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the route. */
  readonly orderNumber = input.required<string>();

  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly cancelling = signal(false);
  protected readonly busy = signal(false);
  protected readonly refused = signal<string | null>(null);

  protected reason = '';

  ngOnInit(): void {
    this.seo.apply({
      title: `Order ${this.orderNumber()}`,
      canonicalPath: `/account/orders/${this.orderNumber()}`,
      noIndex: true
    });

    this.load();
  }

  /** Still in flight — not delivered, cancelled or otherwise finished. */
  protected isOpen(detail: OrderDetail): boolean {
    return !['Delivered', 'Completed', 'Cancelled', 'Returned', 'Refunded'].includes(detail.status);
  }

  protected confirmCancel(): void {
    const detail = this.order();

    if (!detail) {
      return;
    }

    this.busy.set(true);
    this.refused.set(null);

    this.orders
      .cancel(detail.orderNumber, { reason: this.reason.trim() || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.busy.set(false);
          this.cancelling.set(false);
          this.order.set(updated);
          this.toast.success('Your order has been cancelled.');
        },
        error: (error: HttpErrorResponse) => {
          this.busy.set(false);
          this.cancelling.set(false);

          const body = error.error as GeneralResponse | undefined;

          // The shop started work between the page loading and the click.
          // Reload, so the page shows the state that refused, and say why
          // beside where they clicked rather than only in a toast that is
          // gone by the time they look up.
          if (body?.errorCode === ErrorCodes.orderNotCancellable) {
            this.refused.set(body.message);
            this.load();
          }
        }
      });
  }

  private load(): void {
    this.loading.set(true);

    this.orders
      .getMineByNumber(this.orderNumber())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => {
          this.loading.set(false);
          this.order.set(detail);
        },
        // A 5xx has already been sent to the error page by the interceptor;
        // a 404 arrives as null above. Nothing else to do here.
        error: () => this.loading.set(false)
      });
  }
}
