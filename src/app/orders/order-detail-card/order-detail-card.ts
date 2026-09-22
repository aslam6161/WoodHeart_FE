import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MediaUrlService } from '../../_services/media-url.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import {
  ORDER_STATUS_EXPLANATIONS,
  ORDER_STATUS_LABELS,
  OrderDetail,
  OrderDiscount,
  OrderLine,
  OrderStatus,
  PAYMENT_STATUS_LABELS
} from '../../_models/order';

/**
 * One order, as the customer sees it.
 *
 * The confirmation page, the order page in the account and the guest tracking
 * page all show the same thing: where it is going, how it is being paid for,
 * what is in it, and what it came to. One component, so those three cannot
 * drift — a change to how the VAT memo reads happens once.
 *
 * Presentational only. It is handed an `OrderDetail` and renders it; which
 * door the order came in through (own account, or number-plus-phone) is the
 * page's business.
 */
@Component({
  selector: 'app-order-detail-card',
  imports: [RouterLink, TakaPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let detail = order();

    @if (showStatus()) {
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span class="badge fs-6 fw-normal" [class]="statusClass(detail.status)">
          {{ statusLabel(detail.status) }}
        </span>
        <span class="small text-muted">{{ explanation(detail.status) }}</span>
      </div>
    }

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
          @if (detail.shippingAddress.upazila; as upazila) {
            {{ upazila }},
          }
          {{ detail.shippingAddress.district }}, {{ detail.shippingAddress.division }}
          @if (detail.shippingAddress.postcode; as postcode) {
            &ndash; {{ postcode }}
          }
        </address>
        @if (detail.deliveryNote; as note) {
          <p class="small text-muted mb-0 mt-2">Note for the rider: {{ note }}</p>
        }
      </div>

      <div class="col-12 col-md-6">
        <h2 class="h6 text-uppercase text-muted">Payment</h2>
        <p class="small mb-1">
          {{ paymentMethod(detail.paymentMethodCode) }}
          <span class="text-muted">&middot; {{ paymentLabel(detail) }}</span>
        </p>
        <p class="small text-muted mb-0">
          Placed {{ detail.placedAt | date: 'd MMM yyyy, h:mm a' }}
        </p>
      </div>
    </div>

    <h2 class="h6 text-uppercase text-muted">Items</h2>
    <ul class="list-unstyled border-top mb-3">
      @for (line of detail.lines; track line.id) {
        <li class="d-flex gap-3 py-2 border-bottom small align-items-center">
          <a
            class="flex-shrink-0"
            [routerLink]="['/products', line.productSlug]"
            tabindex="-1"
            aria-hidden="true">
            @if (thumb(line); as src) {
              <img class="rounded border wh-thumb" [src]="src" alt="" width="56" height="56" loading="lazy" />
            } @else {
              <div class="rounded border wh-thumb wh-thumb-empty">
                {{ line.productName.charAt(0).toUpperCase() }}
              </div>
            }
          </a>

          <div class="flex-grow-1 min-w-0">
            <a class="text-dark text-decoration-none" [routerLink]="['/products', line.productSlug]">
              {{ line.productName }}
            </a>
            <div class="text-muted">
              {{ line.variantName }} &middot; {{ line.quantity }} &times; {{ line.unitPrice | taka }}
              @if (line.leadTimeDays) {
                &middot; made to order, about {{ line.leadTimeDays }} working days
              }
            </div>
          </div>

          <span class="flex-shrink-0">{{ line.lineTotal | taka }}</span>
        </li>
      }
    </ul>

    <dl class="row small mb-0 justify-content-end">
      <dt class="col-8 col-md-9 fw-normal text-md-end">Subtotal</dt>
      <dd class="col-4 col-md-3 text-end">{{ detail.totals.subtotal | taka }}</dd>

      <!-- Named, as they were at placement. An invoice whose total is 5,000
           less than its own lines, with nothing saying why, is the kind of
           thing a customer telephones about. -->
      @for (discount of goodsDiscounts(detail); track $index) {
        <dt class="col-8 col-md-9 fw-normal text-md-end text-success">
          {{ discount.name }}
          @if (discount.code) {
            <span class="text-muted">({{ discount.code }})</span>
          }
        </dt>
        <dd class="col-4 col-md-3 text-end text-success">&minus;{{ discount.amount | taka }}</dd>
      }

      @if (goodsDiscounts(detail).length === 0 && detail.totals.discountTotal > 0) {
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

      @if (freeDeliveryName(detail); as name) {
        <dd class="col-12 text-md-end text-success mb-0">{{ name }}</dd>
      }

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

    @if (showTimeline() && detail.timeline.length > 0) {
      <h2 class="h6 text-uppercase text-muted mt-4">History</h2>
      <ol class="list-unstyled small mb-0">
        <!-- Newest first: the question is "what happened last", and for a
             three-week wardrobe the answer should not be below the fold. -->
        @for (entry of newestFirst(); track $index) {
          <li class="d-flex gap-3 py-1">
            <span class="text-muted text-nowrap wh-when">
              {{ entry.occurredAt | date: 'd MMM, h:mm a' }}
            </span>
            <span>
              {{ statusLabel(entry.toStatus) }}
              @if (entry.note; as note) {
                <span class="text-muted">&mdash; {{ note }}</span>
              }
            </span>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .wh-thumb {
      width: 56px;
      height: 56px;
      object-fit: cover;
      display: block;
    }

    .wh-thumb-empty {
      display: grid;
      place-items: center;
      background: #f3efe9;
      color: #8a7d70;
      font-weight: 600;
    }

    .wh-when {
      min-width: 7.5rem;
    }
  `
})
export class OrderDetailCard {
  private readonly media = inject(MediaUrlService);

  readonly order = input.required<OrderDetail>();

  /** The status line at the top. Off on the confirmation page, which has its own heading. */
  readonly showStatus = input(true);

  readonly showTimeline = input(true);

  /**
   * Money off the goods. Free delivery is named under the delivery line
   * instead, so a waived charge is not also shown as a deduction from a
   * subtotal it never came out of.
   */
  protected goodsDiscounts(detail: OrderDetail): OrderDiscount[] {
    return (detail.discounts ?? []).filter(discount => discount.type !== 'FreeShipping');
  }

  protected freeDeliveryName(detail: OrderDetail): string | null {
    return (
      (detail.discounts ?? []).find(discount => discount.type === 'FreeShipping')?.name ?? null
    );
  }

  protected statusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  protected explanation(status: OrderStatus): string {
    return ORDER_STATUS_EXPLANATIONS[status] ?? '';
  }

  protected statusClass(status: OrderStatus): string {
    switch (status) {
      case 'Cancelled':
      case 'Returned':
      case 'Refunded':
        return 'text-bg-secondary';
      case 'Delivered':
      case 'Completed':
        return 'text-bg-success';
      default:
        return 'text-bg-dark';
    }
  }

  protected paymentLabel(detail: OrderDetail): string {
    // "Unpaid" is the normal state of a cash-on-delivery order and reads as a
    // reproach; the customer will pay the rider — unless the order is over,
    // in which case nothing was ever charged.
    if (detail.paymentStatus === 'Unpaid') {
      if (detail.status === 'Cancelled') {
        return 'nothing was charged';
      }

      if (detail.paymentMethodCode === 'cod') {
        return 'pay on delivery';
      }
    }

    return (PAYMENT_STATUS_LABELS[detail.paymentStatus] ?? detail.paymentStatus).toLowerCase();
  }

  protected paymentMethod(code: string): string {
    switch (code) {
      case 'cod':
        return 'Cash on delivery';
      case 'bkash':
        return 'bKash';
      default:
        return code;
    }
  }

  protected newestFirst() {
    return [...this.order().timeline].reverse();
  }

  protected thumb(line: OrderLine): string | null {
    return this.media.image(line.imagePath, { width: 112, height: 112, fit: 'fill' });
  }
}
