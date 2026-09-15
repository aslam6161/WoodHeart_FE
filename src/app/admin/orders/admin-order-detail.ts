import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminOrderService } from '../../_services/admin/admin-order.service';
import { AccountService } from '../../_services/account.service';
import { ToastService } from '../../_services/toast.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { GeneralResponseOf } from '../../_models/generalResponse';
import {
  AdminOrderDetail,
  FULFILMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS
} from '../../_models/admin-order';
import {
  FulfilmentStatus,
  ORDER_STATUS_LABELS,
  OrderStatus,
  PaymentStatus
} from '../../_models/order';

/**
 * One order, and everything staff can do to it.
 *
 * <b>The buttons come from the API.</b> `allowedStatusTransitions` and
 * `allowedPaymentTransitions` are sent from the same tables the API validates
 * against, so the page never decides for itself whether "Shipped" may become
 * "Delivered" — it draws a button for each move it was told is legal, and
 * every response replaces the order with the API's copy, buttons included.
 *
 * <b>Two things are narrower than the rest.</b> Recording a payment and
 * changing the delivery charge are claims about money, and the API restricts
 * them to Admin and Manager. The page hides those controls from Staff rather
 * than showing buttons that answer 403 — but the hiding is a courtesy, and the
 * policy on the API is what actually stands between a request and the till.
 */
@Component({
  selector: 'app-admin-order-detail',
  imports: [FormsModule, RouterLink, TakaPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Breadcrumb" class="mb-2">
      <a class="small text-decoration-none" routerLink="/admin/orders">&larr; Orders</a>
    </nav>

    @if (order(); as item) {
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 class="h4 mb-0 font-monospace">{{ item.orderNumber }}</h1>
        <span class="badge text-bg-dark">{{ statusLabel(item.status) }}</span>
        <span class="badge text-bg-light border">{{ paymentLabel(item.paymentStatus) }}</span>
        <span class="badge text-bg-light border">{{ fulfilmentLabel(item.fulfilmentStatus) }}</span>
        <span class="small text-muted">placed {{ item.placedAt | date: 'd MMM yyyy, h:mm a' }}</span>

        <button
          class="btn btn-outline-dark btn-sm ms-auto"
          type="button"
          [disabled]="printing()"
          (click)="openInvoice()">
          {{ printing() ? 'Preparing…' : 'Invoice' }}
        </button>
      </div>

      <div class="row g-3">
        <!-- ==================== Left: what to do ==================== -->
        <div class="col-12 col-lg-7">
          <div class="card mb-3">
            <div class="card-header fw-semibold">Move this order</div>
            <div class="card-body">
              @if (item.allowedStatusTransitions.length === 0) {
                <p class="text-muted small mb-0">Nothing more can be done with this order.</p>
              } @else {
                <div class="d-flex flex-wrap gap-2">
                  @for (next of item.allowedStatusTransitions; track next) {
                    <button
                      class="btn btn-sm"
                      type="button"
                      [class.btn-dark]="next !== 'Cancelled'"
                      [class.btn-outline-danger]="next === 'Cancelled'"
                      [disabled]="busy()"
                      (click)="beginMove(next)">
                      {{ moveLabel(next) }}
                    </button>
                  }
                </div>

                @if (pendingMove(); as move) {
                  <!-- A cancellation must say why. The API refuses one
                       without a note, because "who cancelled this and why"
                       is a question that gets asked. -->
                  <div class="border rounded p-3 mt-3">
                    <label class="form-label small fw-semibold" for="moveNote">
                      {{ move === 'Cancelled' ? 'Why is this being cancelled?' : 'Note (optional)' }}
                    </label>
                    <textarea
                      id="moveNote"
                      class="form-control form-control-sm"
                      rows="2"
                      maxlength="500"
                      [(ngModel)]="moveNote"
                      [class.is-invalid]="move === 'Cancelled' && moveNoteMissing()"></textarea>
                    @if (move === 'Cancelled' && moveNoteMissing()) {
                      <div class="invalid-feedback">A reason is required to cancel.</div>
                    }
                    <div class="d-flex gap-2 mt-2">
                      <button
                        class="btn btn-sm"
                        type="button"
                        [class.btn-dark]="move !== 'Cancelled'"
                        [class.btn-danger]="move === 'Cancelled'"
                        [disabled]="busy()"
                        (click)="confirmMove()">
                        {{ move === 'Cancelled' ? 'Cancel this order' : 'Confirm: ' + moveLabel(move) }}
                      </button>
                      <button
                        class="btn btn-sm btn-link text-muted"
                        type="button"
                        (click)="pendingMove.set(null)">
                        Back
                      </button>
                    </div>
                  </div>
                }
              }
            </div>
          </div>

          @if (canHandleMoney()) {
            <div class="card mb-3">
              <div class="card-header fw-semibold">Payment</div>
              <div class="card-body">
                <p class="small text-muted mb-2">
                  Currently <strong>{{ paymentLabel(item.paymentStatus) }}</strong> by
                  <span class="text-uppercase">{{ item.paymentMethodCode }}</span>.
                  @if (item.paymentMethodCode === 'cod') {
                    Marking a cash order delivered records it as paid automatically.
                  }
                </p>

                @if (item.allowedPaymentTransitions.length === 0) {
                  <p class="text-muted small mb-0">No further payment change is possible.</p>
                } @else {
                  <div class="d-flex flex-wrap gap-2">
                    @for (next of item.allowedPaymentTransitions; track next) {
                      <button
                        class="btn btn-sm btn-outline-dark"
                        type="button"
                        [disabled]="busy()"
                        (click)="recordPayment(next)">
                        Mark {{ paymentLabel(next).toLowerCase() }}
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <div class="card mb-3">
            <div class="card-header fw-semibold">Goods</div>
            <div class="card-body">
              <div class="row g-2 align-items-end">
                <div class="col-8 col-md-6">
                  <label class="form-label small mb-1" for="fulfilment">Where the goods are</label>
                  <select
                    id="fulfilment"
                    class="form-select form-select-sm"
                    [(ngModel)]="fulfilment">
                    @for (status of fulfilmentStatuses; track status) {
                      <option [value]="status">{{ fulfilmentLabel(status) }}</option>
                    }
                  </select>
                </div>
                <div class="col-4 col-md-3">
                  <button
                    class="btn btn-sm btn-outline-dark w-100"
                    type="button"
                    [disabled]="busy() || fulfilment === item.fulfilmentStatus"
                    (click)="recordFulfilment()">
                    Record
                  </button>
                </div>
              </div>
              <p class="small text-muted mt-2 mb-0">
                For a part-shipped order. Marking the order Delivered above records this too.
              </p>
            </div>
          </div>

          @if (canHandleMoney() && item.canEditDeliveryFee) {
            <div class="card mb-3">
              <div class="card-header fw-semibold">Delivery charge</div>
              <div class="card-body">
                <p class="small text-muted mb-2">
                  The rate card priced these items at
                  <strong>{{ item.deliveryChargeFromLines | taka }}</strong>; the order is charged
                  <strong>{{ item.totals.deliveryFee | taka }}</strong>.
                  @if (item.totals.deliveryOverridden) {
                    Already set by hand.
                  } @else {
                    Correct it here if two items fit on one van.
                  }
                </p>

                <div class="row g-2">
                  <div class="col-12 col-md-4">
                    <label class="form-label small mb-1" for="deliveryFee">New charge (৳)</label>
                    <input
                      id="deliveryFee"
                      class="form-control form-control-sm"
                      type="number"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      [(ngModel)]="deliveryFee" />
                  </div>
                  <div class="col-12 col-md-8">
                    <label class="form-label small mb-1" for="deliveryReason">Reason</label>
                    <input
                      id="deliveryReason"
                      class="form-control form-control-sm"
                      type="text"
                      maxlength="300"
                      placeholder="Bed and tables go on one van"
                      [(ngModel)]="deliveryReason"
                      [class.is-invalid]="deliveryReasonMissing()" />
                    @if (deliveryReasonMissing()) {
                      <div class="invalid-feedback">Say why — it goes on the order's record.</div>
                    }
                  </div>
                </div>
                <button
                  class="btn btn-sm btn-outline-dark mt-2"
                  type="button"
                  [disabled]="busy()"
                  (click)="overrideDelivery()">
                  Change delivery charge
                </button>
              </div>
            </div>
          }

          <div class="card mb-3">
            <div class="card-header fw-semibold">Items</div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" class="text-end">Qty</th>
                    <th scope="col" class="text-end">Unit</th>
                    <th scope="col" class="text-end">Delivery</th>
                    <th scope="col" class="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of item.lines; track line.id) {
                    <tr>
                      <td>
                        {{ line.productName }}
                        <div class="small text-muted">
                          {{ line.variantName }} &middot; SKU {{ line.sku }}
                          @if (line.leadTimeDays) {
                            &middot; made to order, {{ line.leadTimeDays }} days
                          }
                        </div>
                      </td>
                      <td class="text-end">{{ line.quantity }}</td>
                      <td class="text-end">{{ line.unitPrice | taka }}</td>
                      <td class="text-end text-muted">{{ line.deliveryChargeApplied | taka }}</td>
                      <td class="text-end">{{ line.lineTotal | taka }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="card-body">
              <dl class="row small mb-0 justify-content-end">
                <dt class="col-7 col-md-9 fw-normal text-md-end">
                  Subtotal{{ item.totals.pricesIncludeVat ? ' (incl. VAT)' : '' }}
                </dt>
                <dd class="col-5 col-md-3 text-end">{{ item.totals.subtotal | taka }}</dd>

                @if (item.totals.discountTotal > 0) {
                  <dt class="col-7 col-md-9 fw-normal text-md-end">Discount</dt>
                  <dd class="col-5 col-md-3 text-end">&minus;{{ item.totals.discountTotal | taka }}</dd>
                }

                @if (!item.totals.pricesIncludeVat) {
                  <dt class="col-7 col-md-9 fw-normal text-md-end">VAT {{ item.totals.vatRatePercent }}%</dt>
                  <dd class="col-5 col-md-3 text-end">{{ item.totals.vatAmount | taka }}</dd>
                }

                <dt class="col-7 col-md-9 fw-normal text-md-end">
                  Delivery
                  @if (item.totals.deliveryOverridden) {
                    <span class="badge text-bg-warning ms-1">adjusted</span>
                  } @else if (item.totals.deliveryWaived) {
                    <span class="badge text-bg-success ms-1">free</span>
                  }
                </dt>
                <dd class="col-5 col-md-3 text-end">{{ item.totals.deliveryFee | taka }}</dd>

                @if (item.totals.paymentSurcharge > 0) {
                  <dt class="col-7 col-md-9 fw-normal text-md-end">Payment charge</dt>
                  <dd class="col-5 col-md-3 text-end">{{ item.totals.paymentSurcharge | taka }}</dd>
                }

                <dt class="col-7 col-md-9 text-md-end">Total</dt>
                <dd class="col-5 col-md-3 text-end fw-semibold">{{ item.totals.grandTotal | taka }}</dd>

                @if (item.totals.pricesIncludeVat) {
                  <dd class="col-12 text-md-end text-muted mb-0">
                    Includes VAT at {{ item.totals.vatRatePercent }}%: {{ item.totals.vatAmount | taka }}
                  </dd>
                }
              </dl>
            </div>
          </div>
        </div>

        <!-- ==================== Right: who and where ==================== -->
        <div class="col-12 col-lg-5">
          <div class="card mb-3">
            <div class="card-header fw-semibold">Customer</div>
            <div class="card-body small">
              <div class="fw-semibold">{{ item.contactName }}</div>
              <div>
                <a class="text-decoration-none" [href]="'tel:' + item.contactPhone">{{ item.contactPhone }}</a>
              </div>
              @if (item.contactEmail; as email) {
                <div><a class="text-decoration-none" [href]="'mailto:' + email">{{ email }}</a></div>
              }
              <div class="text-muted mt-1">
                {{ item.customerId ? 'Has an account' : 'Guest order' }}
              </div>

              <hr />

              <div class="fw-semibold">Deliver to</div>
              <address class="mb-1">
                {{ item.shippingAddress.addressLine }}<br />
                @if (item.shippingAddress.landmark; as landmark) {
                  {{ landmark }}<br />
                }
                @if (areaLine(item); as area) {
                  {{ area }}<br />
                }
                {{ item.shippingAddress.district }}, {{ item.shippingAddress.division }}
                @if (item.shippingAddress.postcode; as postcode) {
                  &ndash; {{ postcode }}
                }
              </address>
              <div class="text-muted">
                {{ item.deliveryZone === 'InsideDhaka' ? 'Inside Dhaka' : 'Outside Dhaka' }}
              </div>

              @if (item.deliveryNote; as note) {
                <div class="mt-2">
                  <span class="fw-semibold">Customer's note:</span> {{ note }}
                </div>
              }
            </div>
          </div>

          <div class="card mb-3">
            <div class="card-header fw-semibold">Internal notes</div>
            <div class="card-body">
              <!-- Staff-only. Never on a customer-facing DTO, and the API
                   enforces that — this box is simply where they are typed. -->
              <textarea
                class="form-control form-control-sm"
                rows="3"
                maxlength="2000"
                placeholder="Ring before the van leaves. Gate closes at 9."
                [(ngModel)]="notes"></textarea>
              <button
                class="btn btn-sm btn-outline-dark mt-2"
                type="button"
                [disabled]="busy() || notes === (item.internalNotes ?? '')"
                (click)="saveNotes()">
                Save notes
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-header fw-semibold">History</div>
            <ul class="list-group list-group-flush small">
              @for (entry of timeline(); track entry.occurredAt + entry.toStatus) {
                <li class="list-group-item">
                  <div class="d-flex justify-content-between gap-2">
                    <span>
                      @if (entry.fromStatus && entry.fromStatus !== entry.toStatus) {
                        {{ statusLabel(entry.fromStatus) }} &rarr;
                      }
                      <strong>{{ statusLabel(entry.toStatus) }}</strong>
                    </span>
                    <span class="text-muted text-nowrap">{{ entry.occurredAt | date: 'd MMM, h:mm a' }}</span>
                  </div>
                  <div class="text-muted">
                    {{ entry.actorName }}
                    @if (entry.note; as note) {
                      &middot; {{ note }}
                    }
                  </div>
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    } @else if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-2">That order could not be found.</p>
        <a class="btn btn-outline-dark btn-sm" routerLink="/admin/orders">Back to orders</a>
      </div>
    }
  `
})
export class AdminOrderDetailPage implements OnInit {
  private readonly ordersApi = inject(AdminOrderService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the route. */
  readonly orderNumber = input.required<string>();

  protected readonly order = signal<AdminOrderDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly printing = signal(false);

  /** The move awaiting a note, or confirmation in the case of a cancellation. */
  protected readonly pendingMove = signal<OrderStatus | null>(null);
  protected readonly moveNoteMissing = signal(false);
  protected readonly deliveryReasonMissing = signal(false);

  protected moveNote = '';
  protected fulfilment: FulfilmentStatus = 'Unfulfilled';
  protected deliveryFee = 0;
  protected deliveryReason = '';
  protected notes = '';

  protected readonly fulfilmentStatuses: FulfilmentStatus[] = [
    'Unfulfilled',
    'PartiallyFulfilled',
    'Fulfilled',
    'Returned'
  ];

  /** Payment and the delivery charge belong to whoever is accountable for the till. */
  protected readonly canHandleMoney = computed(() => this.account.hasAnyRole('Admin', 'Manager'));

  /** Newest first. The last thing that happened is the thing staff are looking for. */
  protected readonly timeline = computed(() => [...(this.order()?.timeline ?? [])].reverse());

  ngOnInit(): void {
    this.ordersApi
      .get(this.orderNumber())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: item => {
          this.apply(item);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  protected statusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  protected paymentLabel(status: PaymentStatus): string {
    return PAYMENT_STATUS_LABELS[status] ?? status;
  }

  protected fulfilmentLabel(status: FulfilmentStatus): string {
    return FULFILMENT_STATUS_LABELS[status] ?? status;
  }

  /** Area and upazila on one line, whichever of them the customer gave. */
  protected areaLine(item: AdminOrderDetail): string {
    return [item.shippingAddress.area, item.shippingAddress.upazila]
      .filter(part => !!part)
      .join(', ');
  }

  /** The button's verb, which is not always the state's name. */
  protected moveLabel(status: OrderStatus): string {
    switch (status) {
      case 'Confirmed':
        return 'Confirm';
      case 'Processing':
        return 'Start preparing';
      case 'ReadyToShip':
        return 'Ready to ship';
      case 'Shipped':
        return 'Mark shipped';
      case 'Delivered':
        return 'Mark delivered';
      case 'Completed':
        return 'Complete';
      case 'Cancelled':
        return 'Cancel order';
      case 'Returned':
        return 'Mark returned';
      case 'Refunded':
        return 'Mark refunded';
      default:
        return status;
    }
  }

  // --- The work axis ---------------------------------------------------------

  protected beginMove(status: OrderStatus): void {
    this.moveNote = '';
    this.moveNoteMissing.set(false);
    this.pendingMove.set(status);
  }

  protected confirmMove(): void {
    const status = this.pendingMove();

    if (!status) {
      return;
    }

    const note = this.moveNote.trim();

    if (status === 'Cancelled' && !note) {
      this.moveNoteMissing.set(true);
      return;
    }

    this.run(
      this.ordersApi.changeStatus(this.orderNumber(), { status, note: note || null }),
      `Order ${status === 'Cancelled' ? 'cancelled' : 'moved to ' + this.statusLabel(status).toLowerCase()}.`
    );
  }

  // --- The money axis --------------------------------------------------------

  protected recordPayment(status: PaymentStatus): void {
    this.run(
      this.ordersApi.recordPayment(this.orderNumber(), { status }),
      `Payment recorded as ${this.paymentLabel(status).toLowerCase()}.`
    );
  }

  protected overrideDelivery(): void {
    const reason = this.deliveryReason.trim();

    if (reason.length < 3) {
      this.deliveryReasonMissing.set(true);
      return;
    }

    this.deliveryReasonMissing.set(false);

    this.run(
      this.ordersApi.overrideDeliveryFee(this.orderNumber(), {
        deliveryFee: Number(this.deliveryFee) || 0,
        reason
      }),
      'Delivery charge changed and the total recalculated.'
    );
  }

  // --- The goods axis --------------------------------------------------------

  protected recordFulfilment(): void {
    this.run(
      this.ordersApi.recordFulfilment(this.orderNumber(), { status: this.fulfilment }),
      `Goods recorded as ${this.fulfilmentLabel(this.fulfilment).toLowerCase()}.`
    );
  }

  // --- Notes and paper -------------------------------------------------------

  protected saveNotes(): void {
    this.busy.set(true);

    this.ordersApi
      .updateNotes(this.orderNumber(), { internalNotes: this.notes.trim() || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.order.update(item => (item ? { ...item, internalNotes: this.notes.trim() || null } : item));
          this.toast.success('Notes saved.');
        },
        error: () => this.busy.set(false)
      });
  }

  /**
   * Opens the invoice in a new tab.
   *
   * Fetched as a blob because the endpoint needs the bearer token, which a
   * plain link cannot carry. The tab is opened before the fetch resolves:
   * browsers block a `window.open` that does not happen inside the click
   * handler's own turn, and the PDF arrives a moment later.
   */
  protected openInvoice(): void {
    const tab = window.open('', '_blank');

    this.printing.set(true);

    this.ordersApi
      .invoice(this.orderNumber())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.printing.set(false);
          const url = URL.createObjectURL(blob);

          if (tab) {
            tab.location.href = url;
          } else {
            window.open(url, '_blank');
          }
        },
        error: () => {
          this.printing.set(false);
          tab?.close();
        }
      });
  }

  /** Runs a mutation, replaces the order with the API's copy, says what happened. */
  private run(request: ReturnType<AdminOrderService['changeStatus']>, success: string): void {
    this.busy.set(true);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: GeneralResponseOf<AdminOrderDetail>) => {
        this.busy.set(false);

        if (response.isSuccess && response.data) {
          this.apply(response.data);
          this.pendingMove.set(null);
          this.toast.success(success);
        }
      },
      // A refused move (409) has already been toasted by the interceptor
      // with the API's own reason.
      error: () => this.busy.set(false)
    });
  }

  private apply(item: AdminOrderDetail | null): void {
    this.order.set(item);

    if (item) {
      this.fulfilment = item.fulfilmentStatus;
      this.deliveryFee = item.totals.deliveryFee;
      this.notes = item.internalNotes ?? '';
    }
  }
}
