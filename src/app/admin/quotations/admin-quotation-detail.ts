import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { AdminQuotationService } from '../../_services/admin/admin-quotation.service';
import { ToastService } from '../../_services/toast.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import {
  ADMIN_QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_CLASS,
  Quotation,
  QuotationStatus
} from '../../_models/quotations';
import { PaymentMethod } from '../../_models/order';

/**
 * One quotation, and what the shop does with it.
 *
 * <b>The buttons come from the API.</b> `allowedStatusTransitions` is sent
 * from the same table the API refuses with, exactly as an order's and a
 * booking's are, so a button that renders is a button that works.
 *
 * <b>Converting is not one of them.</b> It does not move the quotation along
 * a graph; it makes an order, and the order is the thing that matters
 * afterwards. So it has its own panel, it asks how the customer is paying, and
 * it says in as many words that the quoted figure is not touched — only the
 * payment charge is added on top. That promise is the reason the whole of
 * Phase 4 exists, and it is worth reading on the screen that keeps it.
 *
 * <b>Lapsed is shown even where the status does not say so.</b> A quotation
 * whose date has gone is still recorded as Sent until somebody moves it, and
 * the API says as much with `hasLapsed`. Drawing only the status would have
 * this page claim a dead price is live.
 */
@Component({
  selector: 'app-admin-quotation-detail',
  imports: [FormsModule, RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/quotations">
      &lsaquo; All quotations
    </a>

    @if (loading()) {
      <p class="text-muted small mt-3">Loading…</p>
    } @else if (quotation(); as item) {
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mb-3">
        <h1 class="h4 mb-0 font-monospace">{{ item.quotationNumber }}</h1>
        <span class="badge fw-normal" [class]="statusClass(item.status)">
          {{ statusLabel(item.status) }}
        </span>
        @if (item.hasLapsed && item.status !== 'Converted') {
          <span class="badge text-bg-danger fw-normal">Out of date</span>
        }

        @if (canWrite() && item.status === 'Draft') {
          <a
            class="btn btn-sm btn-outline-dark ms-auto"
            [routerLink]="['/admin/quotations', item.quotationNumber, 'edit']">
            Edit
          </a>
        }
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-7">
          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">What was quoted</h2>

            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr class="small text-muted">
                    <th scope="col">Item</th>
                    <th scope="col" class="text-end">Qty</th>
                    <th scope="col" class="text-end">Unit</th>
                    <th scope="col" class="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of item.lines; track line.id) {
                    <tr>
                      <td>
                        <div class="small">{{ line.description }}</div>
                        @if (line.sku) {
                          <div class="small text-muted font-monospace">{{ line.sku }}</div>
                        } @else {
                          <!-- Nothing behind it: no SKU, no shelf, and the
                               invoice will read exactly these words. -->
                          <div class="small text-muted">Made to measure</div>
                        }
                        @if (line.leadTimeDays) {
                          <div class="small text-muted">
                            Ready in about {{ line.leadTimeDays }} days
                          </div>
                        }
                      </td>
                      <td class="text-end">{{ line.quantity }}</td>
                      <td class="text-end text-nowrap">{{ line.unitPrice | taka }}</td>
                      <td class="text-end text-nowrap">{{ line.lineTotal | taka }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">The money</h2>

            <dl class="row mb-0 gy-1 small">
              <dt class="col-7 fw-normal text-muted">Goods</dt>
              <dd class="col-5 text-end mb-0">{{ item.subtotal | taka }}</dd>

              @if (item.discountTotal > 0) {
                <dt class="col-7 fw-normal text-muted">Discount</dt>
                <dd class="col-5 text-end mb-0 text-success">
                  &minus;{{ item.discountTotal | taka }}
                </dd>
              }

              <dt class="col-7 fw-normal text-muted">
                VAT at {{ item.vatRatePercent }}%
                @if (item.pricesIncludeVat) {
                  <span class="text-muted">(included)</span>
                }
              </dt>
              <dd class="col-5 text-end mb-0">{{ item.vatAmount | taka }}</dd>

              <dt class="col-7 fw-normal text-muted">
                Delivery
                @if (item.deliveryOverridden) {
                  <span class="text-muted">(priced by hand)</span>
                }
              </dt>
              <dd class="col-5 text-end mb-0">{{ item.deliveryFee | taka }}</dd>

              <dt class="col-7 fw-semibold border-top pt-2">Total</dt>
              <dd class="col-5 text-end fw-semibold border-top pt-2 mb-0">
                {{ item.grandTotal | taka }}
              </dd>
            </dl>

            <!-- The rate is frozen on the quotation, not read at conversion.
                 One given last month at 5% must not become an order at
                 today's 7.5%. -->
            <p class="form-text mb-0">
              These figures were worked out when the quotation was written, at the VAT
              rate above. Converting it carries them across unchanged.
            </p>
          </div>

          <div class="border rounded p-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">Who it is for</h2>

            <dl class="row mb-0 gy-2 small">
              <dt class="col-4 text-muted fw-normal">Name</dt>
              <dd class="col-8 mb-0">{{ item.contactName }}</dd>

              <dt class="col-4 text-muted fw-normal">Phone</dt>
              <dd class="col-8 mb-0">
                <a class="text-decoration-none" [href]="'tel:' + item.contactPhone">
                  {{ item.contactPhone }}
                </a>
              </dd>

              @if (item.contactEmail) {
                <dt class="col-4 text-muted fw-normal">Email</dt>
                <dd class="col-8 mb-0">{{ item.contactEmail }}</dd>
              }

              @if (item.shippingAddress; as address) {
                <dt class="col-4 text-muted fw-normal">Address</dt>
                <dd class="col-8 mb-0">
                  <div>{{ address.addressLine }}</div>
                  <div class="text-muted">
                    @if (address.area) {
                      {{ address.area }},
                    }
                    {{ address.district }}
                    <!-- "Dhanmondi, Dhaka, Dhaka" is the district and the
                         division agreeing, which reads as a mistake. -->
                    @if (address.division !== address.district) {
                      , {{ address.division }}
                    }
                  </div>
                  @if (address.landmark) {
                    <div class="text-muted">{{ address.landmark }}</div>
                  }
                </dd>
              } @else {
                <dt class="col-4 text-muted fw-normal">Address</dt>
                <dd class="col-8 mb-0 text-muted">
                  None yet — delivery cannot be priced, and it cannot be sent.
                </dd>
              }

              @if (item.bookingNumber) {
                <dt class="col-4 text-muted fw-normal">Consultation</dt>
                <dd class="col-8 mb-0">
                  <a
                    class="text-decoration-none font-monospace"
                    [routerLink]="['/admin/consultations/bookings', item.bookingNumber]">
                    {{ item.bookingNumber }}
                  </a>
                </dd>
              }

              @if (item.notes) {
                <dt class="col-4 text-muted fw-normal">Notes</dt>
                <dd class="col-8 mb-0">{{ item.notes }}</dd>
              }

              @if (item.internalNotes) {
                <dt class="col-4 text-muted fw-normal">For us</dt>
                <dd class="col-8 mb-0 text-muted">{{ item.internalNotes }}</dd>
              }

              @if (item.declineReason) {
                <dt class="col-4 text-muted fw-normal">Turned down</dt>
                <dd class="col-8 mb-0">{{ item.declineReason }}</dd>
              }
            </dl>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">Where it stands</h2>

            <dl class="row mb-0 gy-1 small">
              <dt class="col-5 text-muted fw-normal">Stands until</dt>
              <dd class="col-7 mb-0">
                {{ item.validUntil | date: 'd MMMM yyyy' : '+0600' }}
              </dd>

              @if (item.sentAt) {
                <dt class="col-5 text-muted fw-normal">Sent</dt>
                <dd class="col-7 mb-0">
                  {{ item.sentAt | date: 'd MMM yyyy, h:mm a' : '+0600' }}
                </dd>
              }

              @if (item.respondedAt) {
                <dt class="col-5 text-muted fw-normal">Answered</dt>
                <dd class="col-7 mb-0">
                  {{ item.respondedAt | date: 'd MMM yyyy, h:mm a' : '+0600' }}
                </dd>
              }

              @if (item.orderNumber) {
                <dt class="col-5 text-muted fw-normal">Order</dt>
                <dd class="col-7 mb-0">
                  <a
                    class="text-decoration-none font-monospace"
                    [routerLink]="['/admin/orders', item.orderNumber]">
                    {{ item.orderNumber }}
                  </a>
                </dd>
              }
            </dl>
          </div>

          @if (canWrite()) {
            @if (refusal(); as message) {
              <div class="alert alert-warning small" role="alert">{{ message }}</div>
            }

            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">Move it along</h2>

              @if (item.allowedStatusTransitions.length === 0) {
                <p class="small text-muted mb-0">
                  This quotation is finished. Nothing more can be done to it here.
                </p>
              } @else if (buttons().length === 0) {
                <p class="small text-muted mb-0">
                  The only thing left for this one is the order below.
                </p>
              } @else {
                <label class="form-label small" for="reason">Note (optional)</label>
                <input
                  id="reason"
                  class="form-control form-control-sm mb-2"
                  type="text"
                  maxlength="500"
                  placeholder="Customer asked for a cheaper wood."
                  [(ngModel)]="reason" />

                <div class="d-flex flex-wrap gap-2 wh-quotation-actions">
                  @for (next of buttons(); track next) {
                    <button
                      class="btn btn-sm"
                      type="button"
                      [class]="actionClass(next)"
                      [disabled]="busy()"
                      (click)="setStatus(next)">
                      {{ actionLabel(next) }}
                    </button>
                  }
                </div>

                @if (item.status === 'Draft') {
                  <div class="form-text">
                    Until it is sent, the customer cannot see it at all — a figure nobody
                    has checked is not a price the shop wants held to it.
                  </div>
                }
              }
            </div>

            @if (item.status === 'Accepted') {
              <div class="border rounded p-3">
                <h2 class="h6 text-uppercase text-muted small mb-3">Turn it into an order</h2>

                @if (item.hasLapsed) {
                  <!-- The customer accepted, but the date has since gone. The
                       API refuses, and saying so here saves the press. -->
                  <p class="small text-muted mb-0">
                    This quotation has run out of date. Put it back to draft, price it
                    again and send it afresh.
                  </p>
                } @else {
                  <label class="form-label small" for="method">How they are paying</label>
                  <select
                    id="method"
                    class="form-select form-select-sm mb-2"
                    [(ngModel)]="paymentMethodCode">
                    @for (method of methods(); track method.code) {
                      <option [value]="method.code">
                        {{ method.displayName }}
                        @if (method.surcharge) {
                          (+{{ method.surcharge | taka }})
                        }
                      </option>
                    }
                  </select>

                  <label class="form-label small" for="deliveryNote">
                    Note for delivery (optional)
                  </label>
                  <input
                    id="deliveryNote"
                    class="form-control form-control-sm mb-2"
                    type="text"
                    maxlength="500"
                    [(ngModel)]="deliveryNote" />

                  <button
                    class="btn btn-sm btn-dark"
                    type="button"
                    [disabled]="busy()"
                    (click)="convert()">
                    {{ busy() ? 'Making the order…' : 'Make the order' }}
                  </button>

                  <!-- The whole promise, in one sentence, on the screen that
                       keeps it. -->
                  <div class="form-text">
                    The order carries {{ item.grandTotal | taka }} exactly as quoted.
                    Nothing is priced again; only the charge for the way they pay is
                    added.
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    } @else {
      <div class="border rounded p-5 text-center text-muted mt-3">
        <p class="mb-0">No quotation with that number.</p>
      </div>
    }
  `
})
export class AdminQuotationDetail {
  private readonly api = inject(AdminQuotationService);
  private readonly account = inject(AccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly quotation = signal<Quotation | null>(null);
  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected reason = '';
  protected deliveryNote = '';
  protected paymentMethodCode = '';

  /** Writing one is a manager's; reading it is anybody's who answers the phone. */
  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin', 'Manager'));

  /**
   * The moves that are one press.
   *
   * Converted is legal from Accepted and is deliberately not among them. It is
   * not a status somebody sets; it is what happens when an order is made, and
   * a button that marked a quotation Converted on its own would leave one
   * recorded as sold with no order anywhere behind it. The panel below is the
   * only way there.
   */
  protected readonly buttons = computed(() =>
    (this.quotation()?.allowedStatusTransitions ?? []).filter(next => next !== 'Converted')
  );

  private readonly quotationNumber = this.route.snapshot.paramMap.get('quotationNumber') ?? '';

  constructor() {
    this.load();
  }

  protected statusLabel(status: QuotationStatus): string {
    return ADMIN_QUOTATION_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: QuotationStatus): string {
    return QUOTATION_STATUS_CLASS[status] ?? 'text-bg-secondary';
  }

  /** The verb, not the status. "Send", not "Sent" — it is a button. */
  protected actionLabel(status: QuotationStatus): string {
    switch (status) {
      case 'Sent':
        return 'Send it';
      case 'Draft':
        return 'Back to draft';
      case 'Accepted':
        return 'They accepted';
      case 'Declined':
        return 'They declined';
      case 'Expired':
        return 'Write it off';
      case 'Converted':
        return 'Ordered';
      default:
        return status;
    }
  }

  protected actionClass(status: QuotationStatus): string {
    switch (status) {
      case 'Sent':
      case 'Accepted':
        return 'btn-dark';
      case 'Declined':
      case 'Expired':
        return 'btn-outline-danger';
      default:
        return 'btn-outline-secondary';
    }
  }

  protected setStatus(status: QuotationStatus): void {
    this.busy.set(true);
    this.refusal.set(null);

    this.api
      .setStatus(this.quotationNumber, { status, reason: this.reason.trim() || null })
      .subscribe({
        next: response => {
          this.busy.set(false);

          if (response.isSuccess && response.data) {
            this.quotation.set(response.data);
            this.reason = '';
            this.toast.success(`Quotation ${this.statusLabel(status).toLowerCase()}.`);

            return;
          }

          this.refusal.set(response.message || 'That move was refused.');
        },
        error: () => this.busy.set(false)
      });
  }

  protected convert(): void {
    this.busy.set(true);
    this.refusal.set(null);

    this.api
      .convert(this.quotationNumber, {
        paymentMethodCode: this.paymentMethodCode || null,
        deliveryNote: this.deliveryNote.trim() || null
      })
      .subscribe({
        next: response => {
          this.busy.set(false);

          if (response.isSuccess && response.data) {
            this.toast.success(`Order ${response.data.orderNumber} made.`);

            // Reloaded rather than patched: the quotation is now Converted, it
            // carries the order number, and its buttons have all gone.
            this.load();

            return;
          }

          // "This one has already become an order" is an answer with an order
          // number in it, and belongs on the page rather than in a toast.
          this.refusal.set(response.message || 'That quotation could not be converted.');
        },
        error: () => {
          this.busy.set(false);
          this.refusal.set('We could not reach the shop. Please try again.');
        }
      });
  }

  private load(): void {
    this.loading.set(true);

    this.api.get(this.quotationNumber).subscribe({
      next: quotation => {
        this.loading.set(false);
        this.quotation.set(quotation);

        if (quotation?.status === 'Accepted') {
          this.loadMethods(quotation);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  /**
   * The ways to pay, for this quotation.
   *
   * Its own endpoint rather than the checkout's, which prices the methods
   * against the caller's basket — and whoever is converting a quotation has no
   * basket. What decides here is this quotation's total and where it is going:
   * a three-lakh quotation may be over the cash-on-delivery ceiling.
   */
  private loadMethods(quotation: Quotation): void {
    this.api.paymentMethods(quotation.quotationNumber).subscribe(methods => {
      this.methods.set(methods);
      this.paymentMethodCode = methods[0]?.code ?? '';
    });
  }
}
