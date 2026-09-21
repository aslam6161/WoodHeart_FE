import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MediaUrlService } from '../../_services/media-url.service';
import { OrderService } from '../../_services/order.service';
import { SeoService } from '../../_services/seo.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { ORDER_STATUS_LABELS, OrderStatus, OrderSummary } from '../../_models/order';

/**
 * "Your orders" — everything the signed-in customer has bought, newest first.
 *
 * A list of rows rather than cards: what somebody opens this page for is one
 * particular order, usually the latest, and a row per order with a photo and
 * the status gets them there in one glance. The full detail is a click away.
 */
@Component({
  selector: 'app-order-history',
  imports: [RouterLink, TakaPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="d-flex flex-wrap align-items-baseline gap-2 mb-4">
        <h1 class="h3 mb-0">Your orders</h1>
        @if (total() > 0) {
          <span class="text-muted small">{{ total() }} {{ total() === 1 ? 'order' : 'orders' }}</span>
        }
      </div>

      @if (loading()) {
        <p class="text-muted small">Loading your orders…</p>
      } @else if (orders().length === 0) {
        <div class="border rounded p-5 text-center">
          <p class="mb-3">You have not placed an order with us yet.</p>
          <a class="btn btn-dark" routerLink="/products">Browse the catalogue</a>
        </div>
      } @else {
        <ul class="list-unstyled border-top mb-0">
          @for (order of orders(); track order.id) {
            <li class="border-bottom">
              <a
                class="d-flex gap-3 py-3 text-decoration-none text-dark align-items-center"
                [routerLink]="['/account/orders', order.orderNumber]">
                @if (thumb(order); as src) {
                  <img class="rounded border wh-thumb flex-shrink-0" [src]="src" alt="" width="72" height="72" loading="lazy" />
                } @else {
                  <div class="rounded border wh-thumb wh-thumb-empty flex-shrink-0">
                    {{ order.previewTitle.charAt(0).toUpperCase() }}
                  </div>
                }

                <div class="flex-grow-1 min-w-0">
                  <div class="fw-semibold text-truncate">{{ order.previewTitle }}</div>
                  <div class="small text-muted">
                    <span class="font-monospace">{{ order.orderNumber }}</span>
                    &middot; {{ order.placedAt | date: 'd MMM yyyy' }}
                    &middot; {{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'items' }}
                  </div>
                  <span class="badge mt-1 fw-normal" [class]="statusClass(order.status)">
                    {{ label(order.status) }}
                  </span>
                </div>

                <div class="text-end flex-shrink-0">
                  <div class="fw-semibold">{{ order.grandTotal | taka }}</div>
                  <div class="small text-muted d-none d-sm-block">View &rsaquo;</div>
                </div>
              </a>
            </li>
          }
        </ul>

        @if (totalPages() > 1) {
          <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Order pages">
            <button
              class="btn btn-sm btn-outline-dark"
              type="button"
              [disabled]="page() <= 1"
              (click)="goTo(page() - 1)">
              Newer
            </button>
            <span class="small text-muted">Page {{ page() }} of {{ totalPages() }}</span>
            <button
              class="btn btn-sm btn-outline-dark"
              type="button"
              [disabled]="page() >= totalPages()"
              (click)="goTo(page() + 1)">
              Older
            </button>
          </nav>
        }
      }
    </div>
  `,
  styles: `
    .wh-thumb {
      width: 72px;
      height: 72px;
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
  `
})
export class OrderHistory {
  private readonly ordersApi = inject(OrderService);
  private readonly media = inject(MediaUrlService);
  private readonly seo = inject(SeoService);

  private static readonly PageSize = 10;

  protected readonly orders = signal<OrderSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / OrderHistory.PageSize))
  );

  constructor() {
    this.seo.apply({ title: 'Your orders', canonicalPath: '/account/orders', noIndex: true });
    this.load();
  }

  protected label(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] ?? status;
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

  protected thumb(order: OrderSummary): string | null {
    return this.media.image(order.previewImagePath, { width: 144, height: 144, fit: 'fill' });
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 });
    }
  }

  private load(): void {
    this.loading.set(true);

    this.ordersApi.getMine(this.page(), OrderHistory.PageSize).subscribe({
      next: result => {
        this.orders.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
