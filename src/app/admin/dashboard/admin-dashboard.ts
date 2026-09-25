import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { AdminStockService } from '../../_services/admin/admin-stock.service';
import { AdminOrderService } from '../../_services/admin/admin-order.service';
import { AccountService } from '../../_services/account.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { AdminProductListItem } from '../../_models/admin-catalog';
import { StockLevel } from '../../_models/inventory';
import { AdminOrderSummary, OrderStatusCount } from '../../_models/admin-order';
import { ORDER_STATUS_LABELS, OrderStatus } from '../../_models/order';

/**
 * What needs attention today.
 *
 * <b>Counts only, and only the ones that mean something now.</b> A dashboard
 * of revenue tiles would be four zeroes pretending to be information. Every
 * number here is real and each one is a thing somebody can go and do.
 *
 * <b>Orders come first because they are the only figures on the screen that
 * cost money to ignore.</b> An order nobody has confirmed has reserved no
 * stock and told the customer nothing, and the shop finds out when they
 * telephone. Below that, the catalogue: drafts nobody can buy, live products
 * with no photograph — which render a blank tile in every listing and are the
 * single most likely reason a product is not selling — and the stock lines at
 * or below their reorder level, which are the next most likely.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="h4 mb-1">Welcome{{ name() ? ', ' + name() : '' }}</h1>
    <p class="text-muted small mb-4">What needs doing today.</p>

    <div class="border rounded p-3 p-lg-4 mb-4">
      <div class="d-flex align-items-center mb-3">
        <h2 class="h6 mb-0">Orders</h2>
        <a class="small text-decoration-none ms-auto" routerLink="/admin/orders">Open the board</a>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-sm-4">
          <!-- Filtered to Confirmed rather than Pending even though the tile
               counts both: the board takes one status, and Pending is the half
               that is always empty until a payment gateway is live. A tile
               reading 1 that opens a list of nothing is worse than a filter
               that is slightly narrower than its tile. -->
          <a class="wh-stat wh-stat--rose h-100" routerLink="/admin/orders" [queryParams]="{ status: 'Confirmed' }">
            <span class="wh-stat__chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2zm3 5h6v2H9V7zm0 4h6v2H9v-2z" />
              </svg>
            </span>
            <span class="wh-stat__value d-block">{{ waitingCount() ?? '—' }}</span>
            <span class="wh-stat__label d-block">Waiting to start</span>
            <!-- The morning's list, and the one number here that costs money to
                 ignore: a sale nobody has begun making. -->
            <span class="wh-stat__note">Nobody has started these</span>
          </a>
        </div>

        <div class="col-12 col-sm-4">
          <a class="wh-stat wh-stat--amber h-100" routerLink="/admin/orders" [queryParams]="{ status: 'Processing' }">
            <span class="wh-stat__chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2l9 5v10l-9 5-9-5V7l9-5zm0 2.3L5.2 8 12 11.7 18.8 8 12 4.3z" />
              </svg>
            </span>
            <span class="wh-stat__value d-block">{{ beingMadeCount() ?? '—' }}</span>
            <span class="wh-stat__label d-block">Being made</span>
            <span class="wh-stat__note">In the workshop or awaiting a rider</span>
          </a>
        </div>

        <div class="col-12 col-sm-4">
          <a class="wh-stat wh-stat--lilac h-100" routerLink="/admin/orders" [queryParams]="{ status: 'Shipped' }">
            <span class="wh-stat__chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h11v9H3V6zm12 3h3.5L21 12v3h-6V9zM6.5 16.5a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5zm11 0a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5z" />
              </svg>
            </span>
            <span class="wh-stat__value d-block">{{ onTheWayCount() ?? '—' }}</span>
            <span class="wh-stat__label d-block">On its way</span>
            <span class="wh-stat__note">Out with a rider</span>
          </a>
        </div>
      </div>

      @if (recentOrders().length > 0) {
        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Customer</th>
                <th>Status</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (order of recentOrders(); track order.id) {
                <tr>
                  <td>
                    <a class="text-decoration-none fw-semibold"
                       [routerLink]="['/admin/orders', order.orderNumber]">
                      {{ order.orderNumber }}
                    </a>
                  </td>
                  <td class="text-muted small">{{ order.placedAt | date: 'd MMM, h:mm a' }}</td>
                  <td>
                    {{ order.contactName }}
                    <div class="text-muted small">{{ order.contactPhone }}</div>
                  </td>
                  <td>
                    <span class="badge" [class]="statusClass(order.status)">
                      {{ statusLabel(order.status) }}
                    </span>
                  </td>
                  <td class="text-end">{{ order.grandTotal | taka }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loadingOrders()) {
        <p class="small text-muted mb-0">No orders yet.</p>
      }
    </div>

    <div class="border rounded p-3 p-lg-4 mb-4">
      <h2 class="h6 mb-3">Catalogue</h2>

      <div class="row g-3">
        <div class="col-12 col-sm-6 col-lg-3">
          <a class="wh-stat wh-stat--lilac h-100" routerLink="/admin/products">
            <span class="wh-stat__chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2l9 5v10l-9 5-9-5V7l9-5zm0 2.3L5.2 8 12 11.7 18.8 8 12 4.3z" />
              </svg>
            </span>
            <span class="wh-stat__value d-block">{{ liveCount() ?? '—' }}</span>
            <span class="wh-stat__label d-block">Live products</span>
            <span class="wh-stat__note">Open the catalogue</span>
          </a>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <div class="wh-stat wh-stat--amber h-100">
            <span class="wh-stat__chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 2h8l4 4v16H6V2zm7 1.6V7h3.4L13 3.6z" />
              </svg>
            </span>
            <span class="wh-stat__value d-block">{{ draftCount() ?? '—' }}</span>
            <span class="wh-stat__label d-block">Drafts</span>
            <!-- A draft is invisible to customers. That is the point of the
                 status, and also the most common "why can nobody see this?". -->
            <span class="wh-stat__note">Not visible to customers</span>
          </div>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <a
            class="wh-stat wh-stat--rose h-100"
            routerLink="/admin/inventory/stock"
            [queryParams]="{ low: 'true' }">
            <span class="wh-stat__chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16v4H4V5zm0 5.5h16v4H4v-4zM4 16h16v4H4v-4z" />
              </svg>
            </span>
            <span class="wh-stat__value d-block">{{ lowStockCount() ?? '—' }}</span>
            <span class="wh-stat__label d-block">Low stock</span>
            <span class="wh-stat__note">
              {{ lowStockCount() === 0 ? 'Nothing needs reordering' : 'At or below reorder level' }}
            </span>
          </a>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <div class="wh-stat wh-stat--mint h-100">
            <span class="wh-stat__chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16v14H4V5zm2.5 11.5h11l-3.5-4.5-2.5 3-2-2.2-3 3.7zM9 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
              </svg>
            </span>
            <span class="wh-stat__value d-block">{{ missingPhotos().length }}</span>
            <span class="wh-stat__label d-block">No photograph</span>
            <span class="wh-stat__note">
              {{ missingPhotos().length === 0 ? 'Every live product has one' : 'Blank tile in every listing' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12 col-lg-6">
        <div class="border rounded p-3 p-lg-4 h-100">
          <h2 class="h6 mb-3">Needs reordering</h2>

          @if (lowStock().length > 0) {
            <div class="small">
              @for (line of lowStock().slice(0, 4); track line.variantId) {
                <a class="d-block text-decoration-none mb-1"
                   [routerLink]="['/admin/inventory/stock', line.variantId]">
                  {{ line.productName }} · {{ line.variantName }}
                  <span class="text-muted">({{ line.available }} left)</span>
                </a>
              }
              @if ((lowStockCount() ?? 0) > 4) {
                <a class="text-muted text-decoration-none" routerLink="/admin/inventory/stock" [queryParams]="{ low: 'true' }">
                  and {{ (lowStockCount() ?? 0) - 4 }} more
                </a>
              }
            </div>
          } @else if (lowStockCount() === 0) {
            <span class="small text-muted">Nothing needs reordering.</span>
          }
        </div>
      </div>

      <div class="col-12 col-lg-6">
        <div class="border rounded p-3 p-lg-4 h-100">
          <h2 class="h6 mb-3">Live products with no photograph</h2>

          @if (missingPhotos().length > 0) {
            <div class="small">
              @for (product of missingPhotos().slice(0, 4); track product.id) {
                <a class="d-block text-decoration-none mb-1"
                   [routerLink]="['/admin/products', product.id, 'media']">
                  {{ product.nameEn }}
                </a>
              }
              @if (missingPhotos().length > 4) {
                <span class="text-muted">and {{ missingPhotos().length - 4 }} more</span>
              }
            </div>
          } @else if (!loading()) {
            <span class="small text-muted">Every live product has a hero image.</span>
          }
        </div>
      </div>
    </div>

    @if (!mediaConfigured) {
      <div class="alert alert-warning">
        <strong>Cloudinary is not configured</strong>, so uploads will be refused and every product
        shows a placeholder tile. Set the credentials on the API and the cloud name on the web app.
      </div>
    }

    <div class="border rounded p-3 p-lg-4">
      <h2 class="h6 mb-3">Get started</h2>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-dark btn-sm" routerLink="/admin/products/new">Add a product</a>
        <a class="btn btn-outline-secondary btn-sm" routerLink="/admin/categories">Categories</a>
        <a class="btn btn-outline-secondary btn-sm" routerLink="/admin/brands">Brands</a>
        <a class="btn btn-outline-secondary btn-sm" routerLink="/">View the storefront</a>
      </div>
    </div>
  `
})
export class AdminDashboard {
  private readonly catalog = inject(AdminCatalogService);
  private readonly stock = inject(AdminStockService);
  private readonly orders = inject(AdminOrderService);
  private readonly account = inject(AccountService);
  private readonly media = inject(MediaUrlService);

  protected readonly liveCount = signal<number | null>(null);
  protected readonly draftCount = signal<number | null>(null);
  protected readonly missingPhotos = signal<AdminProductListItem[]>([]);
  protected readonly lowStock = signal<StockLevel[]>([]);
  protected readonly lowStockCount = signal<number | null>(null);
  protected readonly loading = signal(true);

  private readonly statusCounts = signal<OrderStatusCount[] | null>(null);
  protected readonly recentOrders = signal<AdminOrderSummary[]>([]);
  protected readonly loadingOrders = signal(true);

  /**
   * Orders nobody has begun.
   *
   * <b><c>Pending</c> is folded in here rather than given a tile of its own,
   * because today it is always zero.</b> Checkout confirms a cash-on-delivery
   * order the moment it is placed — <c>ApplyPaymentOutcome</c>, "Cash to be
   * collected on delivery" — and every order this shop takes is currently cash
   * on delivery. <c>Pending</c> means a customer is still at a payment gateway,
   * which cannot happen until bKash is live.
   *
   * A tile that will read 0 for ever is the "four zeroes pretending to be
   * information" this screen exists not to be. Counted with Confirmed, it says
   * the true thing now and keeps saying it the day bKash lands, because both
   * states mean the same thing to the shop: nobody has started this order.
   */
  protected readonly waitingCount = computed(() => this.countOf('Pending', 'Confirmed'));

  /**
   * Being made, or made and waiting for a rider.
   *
   * Two statuses behind one number because the question asked in the morning
   * is "how much work is in the building", not which of two stages each piece
   * happens to sit at. The board answers that.
   */
  protected readonly beingMadeCount = computed(() =>
    this.countOf('Processing', 'ReadyToShip')
  );

  protected readonly onTheWayCount = computed(() => this.countOf('Shipped'));

  protected readonly mediaConfigured = this.media.isConfigured;

  protected readonly name = () => this.account.user()?.fullName ?? '';

  protected statusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  /** The same tints the order board uses, so a status reads alike on both. */
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
      default:
        return 'text-bg-secondary';
    }
  }

  /**
   * Adds up the statuses asked for, or null while the counts are in flight.
   *
   * Null rather than zero on purpose: a tile reading 0 says "there is no work
   * waiting", and saying that before the answer has arrived is the one wrong
   * thing this screen could do.
   */
  private countOf(...statuses: OrderStatus[]): number | null {
    const counts = this.statusCounts();

    if (counts === null) {
      return null;
    }

    return counts
      .filter(row => statuses.includes(row.status))
      .reduce((total, row) => total + row.count, 0);
  }

  constructor() {
    // One call covers all three order tiles — the endpoint returns every
    // status, including the empty ones, which is why a status missing from the
    // response and a status with no orders do not need telling apart here.
    this.orders.statusCounts().subscribe({
      next: counts => this.statusCounts.set(counts),
      error: () => this.statusCounts.set([])
    });

    this.orders.search({ page: 1, pageSize: 5 }).subscribe({
      next: result => {
        this.recentOrders.set(result.items ?? []);
        this.loadingOrders.set(false);
      },
      error: () => this.loadingOrders.set(false)
    });

    // Page size 1: the count comes from the X-Pagination header, so asking for
    // one row is enough and avoids pulling the whole catalogue twice.
    this.catalog
      .searchProducts({ status: 'Active', pageSize: 1 })
      .subscribe(result => this.liveCount.set(result.pagination?.totalItems ?? 0));

    this.catalog
      .searchProducts({ status: 'Draft', pageSize: 1 })
      .subscribe(result => this.draftCount.set(result.pagination?.totalItems ?? 0));

    // The API has no "missing media" filter, so this reads a page of live
    // products and checks locally. Fine at this size; when the catalogue
    // outgrows one page it becomes a query rather than a bigger page.
    this.catalog.searchProducts({ status: 'Active', pageSize: 100 }).subscribe({
      next: result => {
        this.missingPhotos.set((result.result ?? []).filter(product => !product.primaryImagePath));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    // The first few low lines, and the total for "and N more". Unstocked
    // variants count as low too — they are sold out on the storefront.
    this.stock.search({ lowOnly: true, pageSize: 5 }).subscribe(result => {
      this.lowStock.set(result.items);
      this.lowStockCount.set(result.total);
    });
  }
}
