import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { AdminQuotationService } from '../../_services/admin/admin-quotation.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { QuotationListItem } from '../../_models/admin-quotations';
import {
  ADMIN_QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_CLASS,
  QuotationStatus
} from '../../_models/quotations';

/**
 * Quotations: what the shop offered to do, and what became of the offer.
 *
 * <b>Sent is the row that matters.</b> A draft is somebody's unfinished work
 * and an accepted one is waiting on the shop to convert it, but a sent
 * quotation is money on the table that nobody has chased. It is coloured for
 * that, and the date it stands until is on the row beside it.
 *
 * <b>Lapsed is shown even where the status does not say so.</b> A quotation
 * whose date has passed is still recorded as Sent until somebody moves it, and
 * the API says as much with `hasLapsed`. Drawing only the status would have
 * the board quietly claim a dead price is live.
 */
@Component({
  selector: 'app-admin-quotation-list',
  imports: [FormsModule, RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Quotations</h1>
      <span class="badge text-bg-light">{{ total() }}</span>

      @if (canWrite()) {
        <a class="btn btn-sm btn-dark ms-auto" routerLink="/admin/quotations/new">
          Write a quotation
        </a>
      }
    </div>

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-5">
        <input
          class="form-control"
          type="search"
          placeholder="Search quotation number, name or phone"
          aria-label="Search quotations"
          [ngModel]="term()"
          (ngModelChange)="onSearch($event)" />
      </div>

      <div class="col-12 col-md-3">
        <select
          class="form-select"
          aria-label="Status"
          [ngModel]="status()"
          (ngModelChange)="onStatus($event)">
          <option [ngValue]="null">Any status</option>
          @for (option of statuses; track option) {
            <option [ngValue]="option">{{ statusLabel(option) }}</option>
          }
        </select>
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (quotations().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-1">
          @if (term()) {
            Nothing matches "{{ term() }}".
          } @else if (status()) {
            Nothing at that status.
          } @else {
            No quotations yet.
          }
        </p>
        @if (!term() && !status() && canWrite()) {
          <p class="small mb-0">
            A quotation is what a consultation is for — write the first one after the
            next site visit.
          </p>
        }
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">Quotation</th>
              <th scope="col">Customer</th>
              <th scope="col">Status</th>
              <th scope="col">Stands until</th>
              <th scope="col" class="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (quotation of quotations(); track quotation.id) {
              <tr [class.table-warning]="chaseable(quotation)">
                <td>
                  <a
                    class="fw-semibold text-decoration-none font-monospace"
                    [routerLink]="['/admin/quotations', quotation.quotationNumber]">
                    {{ quotation.quotationNumber }}
                  </a>
                  <div class="small text-muted">
                    {{ quotation.lineCount }}
                    {{ quotation.lineCount === 1 ? 'line' : 'lines' }}
                    &middot; written {{ quotation.createdAt | date: 'd MMM' : '+0600' }}
                  </div>
                  @if (quotation.bookingNumber) {
                    <!-- Where it came from. A quotation with no consultation
                         behind it is unusual and worth being able to see. -->
                    <div class="small">
                      <a
                        class="text-muted text-decoration-none font-monospace"
                        [routerLink]="[
                          '/admin/consultations/bookings',
                          quotation.bookingNumber
                        ]">
                        {{ quotation.bookingNumber }}
                      </a>
                    </div>
                  }
                </td>

                <td>
                  {{ quotation.contactName }}
                  <!-- Unmasked and clickable: chasing a sent quotation is a
                       telephone call, and it is the whole job of this board. -->
                  <div class="small">
                    <a
                      class="text-muted text-decoration-none"
                      [href]="'tel:' + quotation.contactPhone">
                      {{ quotation.contactPhone }}
                    </a>
                  </div>
                </td>

                <td>
                  <span class="badge fw-normal" [class]="statusClass(quotation.status)">
                    {{ statusLabel(quotation.status) }}
                  </span>
                  @if (quotation.orderNumber) {
                    <div class="small">
                      <a
                        class="text-decoration-none font-monospace"
                        [routerLink]="['/admin/orders', quotation.orderNumber]">
                        {{ quotation.orderNumber }}
                      </a>
                    </div>
                  }
                </td>

                <td class="text-nowrap small">
                  {{ quotation.validUntil | date: 'd MMM yyyy' : '+0600' }}
                  @if (quotation.hasLapsed && quotation.status !== 'Converted') {
                    <div class="text-danger">Out of date</div>
                  }
                </td>

                <td class="text-end text-nowrap">{{ quotation.grandTotal | taka }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Quotation pages">
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
export class AdminQuotationList {
  private readonly api = inject(AdminQuotationService);
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private static readonly PageSize = 20;

  protected readonly statuses: readonly QuotationStatus[] = [
    'Draft',
    'Sent',
    'Accepted',
    'Declined',
    'Expired',
    'Converted'
  ];

  protected readonly quotations = signal<QuotationListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly term = signal('');
  protected readonly status = signal<QuotationStatus | null>(null);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminQuotationList.PageSize))
  );

  /** Writing one is a manager's; reading it is anybody's who answers the phone. */
  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin', 'Manager'));

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const status = this.route.snapshot.queryParamMap.get('status') as QuotationStatus | null;

    if (status && this.statuses.includes(status)) {
      this.status.set(status);
    }

    this.load();
  }

  protected statusLabel(status: QuotationStatus): string {
    return ADMIN_QUOTATION_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: QuotationStatus): string {
    return QUOTATION_STATUS_CLASS[status] ?? 'text-bg-secondary';
  }

  /**
   * A sent quotation nobody has answered: the row somebody should be ringing
   * about. A lapsed one is past chasing and wants re-quoting instead, so it is
   * left plain and marked out of date on the column that says so.
   */
  protected chaseable(quotation: QuotationListItem): boolean {
    return quotation.status === 'Sent' && !quotation.hasLapsed;
  }

  protected onSearch(value: string): void {
    this.term.set(value);

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  protected onStatus(status: QuotationStatus | null): void {
    this.status.set(status);
    this.page.set(1);

    // In the URL, so "everything still out there" can be bookmarked or sent on.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    this.api
      .search({
        term: this.term() || null,
        status: this.status(),
        page: this.page(),
        pageSize: AdminQuotationList.PageSize
      })
      .subscribe({
        next: result => {
          this.quotations.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }
}
