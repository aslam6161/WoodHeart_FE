import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminOrderService } from '../../_services/admin/admin-order.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import {
  AdminOrderSummary,
  ORDER_STATUSES,
  OrderStatusCount,
  PAYMENT_STATUS_LABELS
} from '../../_models/admin-order';
import { ORDER_STATUS_LABELS, OrderStatus, PaymentStatus } from '../../_models/order';

/**
 * The order board: what needs doing, and where each order is.
 *
 * <b>The tabs are the board.</b> The shop works orders through in order —
 * confirm the new ones, pack the confirmed ones, ship the packed ones — so
 * the first thing on the screen is a count per status, and a click on one
 * is the day's to-do list. Every status is shown, including the empty ones:
 * a tab that vanishes when it reaches zero and reappears later is a worse
 * board than one with a quiet zero on it.
 *
 * The status filter lives in the URL, so "Pending" can be bookmarked, opened
 * from the dashboard, or sent to a colleague.
 */
@Component({
  selector: 'app-admin-order-list',
  imports: [FormsModule, RouterLink, TakaPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Orders</h1>
      <span class="badge text-bg-light">{{ total() }}</span>
    </div>

    <ul class="nav nav-pills flex-nowrap overflow-auto mb-3 wh-tabs" role="tablist">
      <li class="nav-item">
        <button
          class="nav-link btn-sm"
          type="button"
          [class.active]="status() === null"
          (click)="onStatus(null)">
          All
          <span class="badge rounded-pill ms-1" [class]="status() === null ? 'text-bg-light' : 'text-bg-secondary'">
            {{ allCount() }}
          </span>
        </button>
      </li>
      @for (tab of tabs(); track tab.status) {
        <li class="nav-item">
          <button
            class="nav-link btn-sm text-nowrap"
            type="button"
            [class.active]="status() === tab.status"
            (click)="onStatus(tab.status)">
            {{ label(tab.status) }}
            <span
              class="badge rounded-pill ms-1"
              [class]="status() === tab.status ? 'text-bg-light' : 'text-bg-secondary'">
              {{ tab.count }}
            </span>
          </button>
        </li>
      }
    </ul>

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-6">
        <input
          class="form-control"
          type="search"
          placeholder="Search order number, phone or name"
          aria-label="Search orders"
          [ngModel]="term()"
          (ngModelChange)="onSearch($event)" />
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (orders().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-0">
          @if (term()) {
            No orders match "{{ term() }}".
          } @else if (status(); as current) {
            Nothing is {{ label(current).toLowerCase() }} right now.
          } @else {
            No orders yet.
          }
        </p>
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Placed</th>
              <th scope="col">Customer</th>
              <th scope="col">Area</th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
              <th scope="col" class="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (order of orders(); track order.id) {
              <tr>
                <td>
                  <a
                    class="fw-semibold text-decoration-none font-monospace"
                    [routerLink]="['/admin/orders', order.orderNumber]">
                    {{ order.orderNumber }}
                  </a>
                  <div class="small text-muted">
                    {{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'items' }}
                  </div>
                </td>

                <td class="small text-nowrap">{{ order.placedAt | date: 'd MMM, h:mm a' }}</td>

                <td>
                  {{ order.contactName }}
                  @if (order.hasAccount) {
                    <span class="badge text-bg-light ms-1" title="Has an account">member</span>
                  }
                  <!-- Unmasked and clickable: ringing the customer is the
                       first thing anybody does with a new order. -->
                  <div class="small">
                    <a class="text-muted text-decoration-none" [href]="'tel:' + order.contactPhone">
                      {{ order.contactPhone }}
                    </a>
                  </div>
                </td>

                <td class="small">
                  {{ order.shippingArea }}
                  <div class="text-muted">
                    {{ order.deliveryZone === 'InsideDhaka' ? 'Inside Dhaka' : 'Outside Dhaka' }}
                  </div>
                </td>

                <td>
                  <span class="badge" [class]="statusClass(order.status)">
                    {{ label(order.status) }}
                  </span>
                </td>

                <td class="small">
                  <span class="badge" [class]="paymentClass(order.paymentStatus)">
                    {{ paymentLabel(order.paymentStatus) }}
                  </span>
                  <div class="text-muted text-uppercase">{{ order.paymentMethodCode }}</div>
                </td>

                <td class="text-end text-nowrap">
                  {{ order.grandTotal | taka }}
                  @if (order.deliveryOverridden) {
                    <div class="small text-muted" title="Delivery charge set by hand">
                      delivery adjusted
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Order pages">
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            [disabled]="page() <= 1"
            (click)="goTo(page() - 1)">
            Previous
          </button>
          <span class="small text-muted">Page {{ page() }} of {{ totalPages() }}</span>
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            [disabled]="page() >= totalPages()"
            (click)="goTo(page() + 1)">
            Next
          </button>
        </nav>
      }
    }
  `,
  styles: `
    .wh-tabs {
      scrollbar-width: thin;
    }
  `
})
export class AdminOrderList {
  private readonly ordersApi = inject(AdminOrderService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private static readonly PageSize = 20;

  protected readonly orders = signal<AdminOrderSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly term = signal('');
  protected readonly status = signal<OrderStatus | null>(null);

  private readonly counts = signal<OrderStatusCount[]>([]);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminOrderList.PageSize))
  );

  /** The tabs, in working order, whatever order the API listed them in. */
  protected readonly tabs = computed(() => {
    const byStatus = new Map(this.counts().map(c => [c.status, c.count]));

    return ORDER_STATUSES.map(status => ({ status, count: byStatus.get(status) ?? 0 }));
  });

  protected readonly allCount = computed(() =>
    this.counts().reduce((sum, c) => sum + c.count, 0)
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('status') as OrderStatus | null;

    if (requested && ORDER_STATUSES.includes(requested)) {
      this.status.set(requested);
    }

    this.load();
    this.loadCounts();
  }

  protected label(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  protected paymentLabel(status: PaymentStatus): string {
    return PAYMENT_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: OrderStatus): string {
    switch (status) {
      case 'Pending':
        return 'text-bg-warning';
      case 'Confirmed':
      case 'Processing':
      case 'ReadyToShip':
        return 'text-bg-info';
      case 'Shipped':
        return 'text-bg-primary';
      case 'Delivered':
      case 'Completed':
        return 'text-bg-success';
      case 'Cancelled':
      case 'Returned':
      case 'Refunded':
        return 'text-bg-secondary';
      default:
        return 'text-bg-light';
    }
  }

  protected paymentClass(status: PaymentStatus): string {
    switch (status) {
      case 'Paid':
        return 'text-bg-success';
      case 'AdvancePaid':
        return 'text-bg-info';
      case 'Failed':
        return 'text-bg-danger';
      case 'Unpaid':
        return 'text-bg-light border';
      default:
        return 'text-bg-secondary';
    }
  }

  protected onStatus(status: OrderStatus | null): void {
    this.status.set(status);
    this.page.set(1);

    // In the URL, so the tab survives a refresh and can be linked to.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: status ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    this.load();
  }

  protected onSearch(value: string): void {
    this.term.set(value);

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    this.ordersApi
      .search({
        status: this.status(),
        term: this.term() || null,
        page: this.page(),
        pageSize: AdminOrderList.PageSize
      })
      .subscribe({
        next: result => {
          this.orders.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  private loadCounts(): void {
    this.ordersApi.statusCounts().subscribe(counts => this.counts.set(counts));
  }
}
