import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminStockService } from '../../_services/admin/admin-stock.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { StockLevel, StockSummary } from '../../_models/inventory';

/**
 * The stock list: every stocked variant, its count, and which ones need
 * attention.
 *
 * <b>Three numbers at the top, and the one that matters is a filter.</b>
 * The list is long and mostly fine; what the owner opens this page for is
 * the handful of lines at or below their reorder level, so "low" is a
 * button as well as a count, and it lives in the URL so the dashboard can
 * link straight to it.
 *
 * Unstocked variants are listed too, flagged rather than hidden: a live
 * product nobody has stocked in is "sold out" on the storefront, which is
 * the most likely reason a new product is not selling.
 */
@Component({
  selector: 'app-admin-stock-list',
  imports: [FormsModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Stock</h1>
      <span class="badge text-bg-light">{{ total() }}</span>
    </div>

    @if (summary(); as counts) {
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-4">
          <div class="border rounded p-2 px-3 h-100">
            <div class="text-uppercase text-muted small">Stocked</div>
            <div class="fs-4">{{ counts.stockedVariants }}</div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <button
            class="border rounded p-2 px-3 h-100 w-100 text-start bg-white wh-tile"
            type="button"
            [class.border-danger]="counts.lowVariants > 0"
            [class.active]="lowOnly()"
            [attr.aria-pressed]="lowOnly()"
            (click)="toggleLow()">
            <div class="text-uppercase text-muted small">Low</div>
            <div class="fs-4" [class.text-danger]="counts.lowVariants > 0">{{ counts.lowVariants }}</div>
            <div class="small text-muted">{{ lowOnly() ? 'Showing only these' : 'Click to show only these' }}</div>
          </button>
        </div>
        <div class="col-12 col-md-4">
          <div class="border rounded p-2 px-3 h-100" [class.border-warning]="counts.unstockedVariants > 0">
            <div class="text-uppercase text-muted small">Never stocked</div>
            <div class="fs-4">{{ counts.unstockedVariants }}</div>
            @if (counts.unstockedVariants > 0) {
              <div class="small text-muted">Sold out on the storefront until stocked in</div>
            }
          </div>
        </div>
      </div>
    }

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-6">
        <input
          class="form-control"
          type="search"
          placeholder="Search SKU, variant or product"
          aria-label="Search stock"
          [ngModel]="term()"
          (ngModelChange)="onSearch($event)" />
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (rows().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-0">
          @if (term()) {
            Nothing matches "{{ term() }}".
          } @else if (lowOnly()) {
            Nothing is low. Good.
          } @else {
            No stocked products yet. Stock is tracked for products of the Stocked type.
          }
        </p>
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">Variant</th>
              <th scope="col" class="text-end">On hand</th>
              <th scope="col" class="text-end">Held</th>
              <th scope="col" class="text-end">Available</th>
              <th scope="col" class="text-end">Reorder at</th>
              <th scope="col">Last movement</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.variantId) {
              <tr [class.table-warning]="!row.isStocked" [class.table-danger]="row.isStocked && row.isLow">
                <td>
                  <div class="d-flex align-items-center gap-2">
                    @if (thumb(row); as src) {
                      <img class="rounded border flex-shrink-0" [src]="src" alt="" width="40" height="40" loading="lazy" />
                    } @else {
                      <div class="rounded border wh-thumb-empty flex-shrink-0" aria-hidden="true">
                        {{ row.productName.charAt(0).toUpperCase() }}
                      </div>
                    }
                    <div class="min-w-0">
                      <a
                        class="fw-semibold text-decoration-none"
                        [routerLink]="['/admin/inventory/stock', row.variantId]">
                        {{ row.productName }}
                      </a>
                      <div class="small text-muted">
                        {{ row.variantName }} &middot; <span class="font-monospace">{{ row.sku }}</span>
                      </div>
                      @if (!row.isStocked) {
                        <span class="badge text-bg-warning">Never stocked</span>
                      } @else if (row.isLow) {
                        <span class="badge text-bg-danger">Low</span>
                      }
                    </div>
                  </div>
                </td>

                <td class="text-end">{{ row.isStocked ? row.onHand : '—' }}</td>
                <td class="text-end text-muted">{{ row.isStocked ? row.reserved : '—' }}</td>
                <td class="text-end fw-semibold">{{ row.isStocked ? row.available : '—' }}</td>
                <td class="text-end text-muted small">
                  {{ row.reorderLevel ?? 'store default' }}
                </td>
                <td class="small text-nowrap text-muted">
                  {{ row.lastMovementAt ? (row.lastMovementAt | date: 'd MMM, h:mm a') : '—' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Stock pages">
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
    .wh-tile.active {
      background: var(--bs-danger-bg-subtle) !important;
    }

    .wh-thumb-empty {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      background: #f7f4f0;
      color: #b9ada0;
      font-weight: 600;
    }
  `
})
export class AdminStockList {
  private readonly stockApi = inject(AdminStockService);
  private readonly media = inject(MediaUrlService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private static readonly PageSize = 50;

  protected readonly rows = signal<StockLevel[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly term = signal('');
  protected readonly lowOnly = signal(false);
  protected readonly summary = signal<StockSummary | null>(null);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminStockList.PageSize))
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const params = this.route.snapshot.queryParamMap;

    this.lowOnly.set(params.get('low') === 'true');
    this.term.set(params.get('q') ?? '');

    this.load();
    this.stockApi.summary().subscribe(counts => this.summary.set(counts));
  }

  protected thumb(row: StockLevel): string | null {
    return row.imagePath ? this.media.image(row.imagePath, { width: 80, height: 80, fit: 'fill' }) : null;
  }

  protected toggleLow(): void {
    this.lowOnly.update(value => !value);
    this.page.set(1);
    this.syncUrl();
    this.load();
  }

  protected onSearch(value: string): void {
    this.term.set(value);

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.syncUrl();
      this.load();
    }, 300);
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  /** The filter in the URL, so "low" can be bookmarked and linked from the dashboard. */
  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { low: this.lowOnly() ? 'true' : null, q: this.term() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private load(): void {
    this.loading.set(true);

    this.stockApi
      .search({
        term: this.term() || null,
        lowOnly: this.lowOnly(),
        page: this.page(),
        pageSize: AdminStockList.PageSize
      })
      .subscribe({
        next: result => {
          this.rows.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }
}
