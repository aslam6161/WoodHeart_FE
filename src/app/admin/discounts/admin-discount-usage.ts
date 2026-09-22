import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  numberAttribute,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminDiscountService } from '../../_services/admin/admin-discount.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { Discount, PromotionUsage } from '../../_models/promotions';

/**
 * What one discount has cost, and who used it.
 *
 * <b>The question this page answers is "was it worth running".</b> A campaign
 * is a decision to give money away, and the only way to judge the next one is
 * to see what the last one cost and how many orders it brought. So the total
 * is at the top, not buried under the list.
 *
 * Each row is one order. A guest is identified by the number they gave, which
 * is also the identity a per-customer limit is counted on — so "one per
 * customer" being honoured is visible here rather than taken on trust.
 */
@Component({
  selector: 'app-admin-discount-usage',
  imports: [RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h1 class="h4 mb-0">{{ discount()?.name ?? 'Usage' }}</h1>
        @if (discount(); as detail) {
          <p class="small text-muted mb-0">
            @if (detail.code) {
              <span class="font-monospace">{{ detail.code }}</span>
            } @else {
              Automatic promotion
            }
          </p>
        }
      </div>
      <a class="btn btn-outline-secondary" [routerLink]="['/admin/discounts', discountId()]">
        Back to the discount
      </a>
    </div>

    @if (discount(); as detail) {
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-4">
          <div class="border rounded p-2 px-3 h-100">
            <div class="text-uppercase text-muted small">Orders</div>
            <div class="fs-4">{{ detail.timesUsed }}</div>
            @if (detail.usageLimitTotal) {
              <div class="small text-muted">of {{ detail.usageLimitTotal }} allowed</div>
            }
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="border rounded p-2 px-3 h-100">
            <div class="text-uppercase text-muted small">Given away</div>
            <div class="fs-4">{{ detail.totalGiven | taka }}</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="border rounded p-2 px-3 h-100">
            <div class="text-uppercase text-muted small">Average per order</div>
            <div class="fs-4">{{ average() | taka }}</div>
          </div>
        </div>
      </div>
    }

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (rows().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-0">Nobody has used this yet.</p>
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Customer</th>
              <th scope="col">Code</th>
              <th scope="col" class="text-end">Given</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.orderId) {
              <tr>
                <td>
                  <a
                    class="fw-semibold text-decoration-none"
                    [routerLink]="['/admin/orders', row.orderNumber]">
                    {{ row.orderNumber }}
                  </a>
                </td>
                <td class="small">
                  <span class="font-monospace">{{ row.contactPhone }}</span>
                  <div class="text-muted">{{ row.isMember ? 'Has an account' : 'Guest' }}</div>
                </td>
                <td class="small font-monospace">{{ row.code ?? '—' }}</td>
                <td class="text-end">{{ row.amount | taka }}</td>
                <td class="small text-nowrap text-muted">
                  {{ row.usedAt | date: 'd MMM yyyy, h:mm a' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Usage pages">
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
  `
})
export class AdminDiscountUsage implements OnInit {
  private readonly discountsApi = inject(AdminDiscountService);

  private static readonly PageSize = 20;

  /** From the route. `numberAttribute` because a route parameter is a string. */
  readonly discountId = input.required<number, string>({ transform: numberAttribute, alias: 'id' });

  protected readonly discount = signal<Discount | null>(null);
  protected readonly rows = signal<PromotionUsage[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminDiscountUsage.PageSize))
  );

  /**
   * What the average order took off. Zero orders reads as zero rather than as
   * a division by nothing.
   */
  protected readonly average = computed(() => {
    const detail = this.discount();

    return detail && detail.timesUsed > 0 ? detail.totalGiven / detail.timesUsed : 0;
  });

  // Not the constructor: a routed input is bound after construction, so the
  // id is not there yet.
  ngOnInit(): void {
    this.discountsApi.get(this.discountId()).subscribe(detail => this.discount.set(detail));
    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    this.discountsApi.usage(this.discountId(), this.page(), AdminDiscountUsage.PageSize).subscribe({
      next: result => {
        this.rows.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
