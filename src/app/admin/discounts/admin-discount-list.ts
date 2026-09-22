import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminDiscountService } from '../../_services/admin/admin-discount.service';
import { AccountService } from '../../_services/account.service';
import { ToastService } from '../../_services/toast.service';
import {
  DISCOUNT_STATUSES,
  DISCOUNT_STATUS_CLASS,
  DISCOUNT_STATUS_LABELS,
  DISCOUNT_TYPE_LABELS,
  DiscountListItem,
  DiscountStatus
} from '../../_models/promotions';

/**
 * The discounts list: automatic promotions and coupon codes, together.
 *
 * <b>"Live" is a separate column from the status, and it is the one to read.</b>
 * Active and inside its window are two different facts: a campaign marked
 * Active that starts next month is not running today, and a list showing only
 * the status would leave the shop guessing which of its promotions are
 * actually costing it money this morning.
 *
 * Pausing is one click from here rather than a trip through the form. Stopping
 * a discount that is going wrong is the urgent operation on this screen —
 * every minute it stays on is money — and it must not require filling in a
 * form first.
 */
@Component({
  selector: 'app-admin-discount-list',
  imports: [FormsModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div class="d-flex align-items-center gap-2">
        <h1 class="h4 mb-0">Discounts</h1>
        <span class="badge text-bg-light">{{ total() }}</span>
      </div>

      @if (canWrite()) {
        <a class="btn btn-dark" routerLink="/admin/discounts/new">New discount</a>
      }
    </div>

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-6">
        <input
          class="form-control"
          type="search"
          placeholder="Search name or code"
          aria-label="Search discounts"
          [ngModel]="term()"
          (ngModelChange)="onSearch($event)" />
      </div>
      <div class="col-12 col-md-4">
        <select
          class="form-select"
          aria-label="Filter by status"
          [ngModel]="status()"
          (ngModelChange)="onStatus($event)">
          <option [ngValue]="null">Every status</option>
          @for (option of statuses; track option) {
            <option [ngValue]="option">{{ statusLabel(option) }}</option>
          }
        </select>
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (rows().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        @if (term() || status()) {
          <p class="mb-0">Nothing matches that.</p>
        } @else {
          <p class="mb-1">No discounts yet.</p>
          <p class="mb-0 small">
            A discount with a code has to be typed in; one without applies to every basket
            that qualifies.
          </p>
        }
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">Discount</th>
              <th scope="col">Worth</th>
              <th scope="col">Runs</th>
              <th scope="col" class="text-end">Used</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-end">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td>
                  <a
                    class="fw-semibold text-decoration-none"
                    [routerLink]="['/admin/discounts', row.id]">
                    {{ row.name }}
                  </a>
                  <div class="small text-muted">
                    @if (row.code) {
                      <span class="font-monospace">{{ row.code }}</span>
                    } @else {
                      Automatic &mdash; no code needed
                    }
                  </div>
                </td>

                <td class="small">
                  {{ typeLabel(row) }}
                  <div class="text-muted">{{ worth(row) }}</div>
                </td>

                <td class="small text-nowrap">
                  @if (row.startsAt || row.endsAt) {
                    <div>
                      {{ row.startsAt ? (row.startsAt | date: 'd MMM') : 'now' }} &ndash;
                      {{ row.endsAt ? (row.endsAt | date: 'd MMM') : 'open' }}
                    </div>
                  } @else {
                    <span class="text-muted">Always</span>
                  }
                </td>

                <td class="text-end">
                  <a class="text-decoration-none" [routerLink]="['/admin/discounts', row.id, 'usage']">
                    {{ row.timesUsed }}
                  </a>
                  @if (row.usageLimitTotal) {
                    <span class="text-muted small"> / {{ row.usageLimitTotal }}</span>
                  }
                </td>

                <td>
                  <span class="badge" [class]="statusClass(row.status)">
                    {{ statusLabel(row.status) }}
                  </span>
                  @if (row.status === 'Active' && !row.isLive) {
                    <!-- The distinction that matters: switched on, not running. -->
                    <div class="small text-muted">Not running today</div>
                  } @else if (row.isLive) {
                    <div class="small text-success">Running</div>
                  }
                </td>

                <td class="text-end">
                  @if (canWrite()) {
                    @if (row.status === 'Active') {
                      <button
                        class="btn btn-sm btn-outline-secondary"
                        type="button"
                        [disabled]="busyId() === row.id"
                        (click)="setStatus(row, 'Paused')">
                        Pause
                      </button>
                    } @else if (row.status === 'Paused' || row.status === 'Draft') {
                      <button
                        class="btn btn-sm btn-outline-dark"
                        type="button"
                        [disabled]="busyId() === row.id"
                        (click)="setStatus(row, 'Active')">
                        Switch on
                      </button>
                    }
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Discount pages">
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
export class AdminDiscountList {
  private readonly discountsApi = inject(AdminDiscountService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private static readonly PageSize = 20;

  protected readonly statuses = DISCOUNT_STATUSES;

  protected readonly rows = signal<DiscountListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly term = signal('');
  protected readonly status = signal<DiscountStatus | null>(null);
  protected readonly busyId = signal<number | null>(null);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminDiscountList.PageSize))
  );

  /** Writing is admin or manager; the API says the same, so this only saves a 403. */
  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin', 'Manager'));

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const params = this.route.snapshot.queryParamMap;

    this.term.set(params.get('q') ?? '');
    this.status.set((params.get('status') as DiscountStatus | null) ?? null);

    this.load();
  }

  protected statusLabel(status: DiscountStatus): string {
    return DISCOUNT_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: DiscountStatus): string {
    return DISCOUNT_STATUS_CLASS[status] ?? 'text-bg-light';
  }

  protected typeLabel(row: DiscountListItem): string {
    return DISCOUNT_TYPE_LABELS[row.type] ?? row.type;
  }

  /** "20% off", "৳500 off", or nothing to say for free delivery. */
  protected worth(row: DiscountListItem): string {
    switch (row.type) {
      case 'Percentage':
        return `${row.value}% off`;
      case 'FixedAmount':
        return `৳${row.value.toLocaleString('en-BD')} off`;
      default:
        return 'delivery waived';
    }
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

  protected onStatus(value: DiscountStatus | null): void {
    this.status.set(value);
    this.page.set(1);
    this.syncUrl();
    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected setStatus(row: DiscountListItem, status: DiscountStatus): void {
    this.busyId.set(row.id);

    this.discountsApi.setStatus(row.id, status).subscribe({
      next: response => {
        this.busyId.set(null);
        this.toast.success(`${row.name} is now ${this.statusLabel(status).toLowerCase()}.`);

        // Replaced from the API's answer rather than patched locally: "live"
        // is the API's judgement about the window, not a flag this screen can
        // work out from a status.
        const updated = response.data;

        if (updated) {
          this.rows.update(rows =>
            rows.map(existing => (existing.id === row.id ? { ...existing, ...updated } : existing))
          );
        }
      },
      error: () => this.busyId.set(null)
    });
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.term() || null, status: this.status() },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private load(): void {
    this.loading.set(true);

    this.discountsApi
      .search({
        term: this.term() || null,
        status: this.status(),
        page: this.page(),
        pageSize: AdminDiscountList.PageSize
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
