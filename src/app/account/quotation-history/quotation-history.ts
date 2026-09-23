import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QuotationApiService } from '../../_services/quotation.service';
import { SeoService } from '../../_services/seo.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import {
  QUOTATION_STATUS_CLASS,
  QUOTATION_STATUS_LABELS,
  Quotation
} from '../../_models/quotations';

/**
 * "Your quotations" — every price the shop has written this customer.
 *
 * <b>The one waiting on an answer comes first to the eye.</b> The API answers
 * newest first, which is right: a quotation is a thing with a date on it, and
 * the one written last week is the one somebody is deciding about. The date it
 * stands until is on every row, because that is the fact that decides whether
 * there is anything to decide.
 *
 * A quotation whose date has gone still lists — it is what the customer was
 * told, and hiding it would look like the shop had forgotten — but it says so
 * of itself rather than sitting there looking live.
 */
@Component({
  selector: 'app-quotation-history',
  imports: [RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="d-flex flex-wrap align-items-baseline gap-2 mb-4">
        <h1 class="h3 mb-0">Your quotations</h1>
        @if (total() > 0) {
          <span class="text-muted small">
            {{ total() }} {{ total() === 1 ? 'quotation' : 'quotations' }}
          </span>
        }
      </div>

      @if (loading()) {
        <p class="text-muted small">Loading…</p>
      } @else if (quotations().length === 0) {
        <div class="border rounded p-5 text-center">
          <p class="mb-1">We have not written you a quotation yet.</p>
          <p class="small text-muted mb-3">
            They come out of a consultation — a designer looks at your place and prices
            the work.
          </p>
          <a class="btn btn-dark" routerLink="/consultation">Talk to a designer</a>
        </div>
      } @else {
        <ul class="list-unstyled border-top mb-0">
          @for (quotation of quotations(); track quotation.id) {
            <li class="border-bottom">
              <a
                class="d-flex gap-3 py-3 text-decoration-none text-dark align-items-center"
                [routerLink]="['/quotation', quotation.quotationNumber]">
                <div class="flex-grow-1 min-w-0">
                  <div class="fw-semibold text-truncate">{{ headline(quotation) }}</div>
                  <div class="small text-muted font-monospace">
                    {{ quotation.quotationNumber }}
                  </div>
                  <div class="small text-muted">
                    @if (quotation.hasLapsed && quotation.status !== 'Converted') {
                      Stood until
                      {{ quotation.validUntil | date: 'd MMM yyyy' : '+0600' }} — please
                      ring us to have it priced again
                    } @else {
                      Valid until {{ quotation.validUntil | date: 'd MMM yyyy' : '+0600' }}
                    }
                  </div>
                  <span class="badge mt-1 fw-normal" [class]="statusClass(quotation)">
                    {{ statusLabel(quotation) }}
                  </span>
                </div>

                <div class="text-end flex-shrink-0">
                  <div class="fw-semibold">{{ quotation.grandTotal | taka }}</div>
                  <div class="small text-muted d-none d-sm-block">View &rsaquo;</div>
                </div>
              </a>
            </li>
          }
        </ul>

        @if (totalPages() > 1) {
          <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Quotation pages">
            <button
              class="btn btn-sm btn-outline-dark"
              type="button"
              [disabled]="page() <= 1"
              (click)="goTo(page() - 1)">
              Previous
            </button>
            <span class="small text-muted">Page {{ page() }} of {{ totalPages() }}</span>
            <button
              class="btn btn-sm btn-outline-dark"
              type="button"
              [disabled]="page() >= totalPages()"
              (click)="goTo(page() + 1)">
              Next
            </button>
          </nav>
        }
      }
    </div>
  `
})
export class QuotationHistory {
  private readonly api = inject(QuotationApiService);
  private readonly seo = inject(SeoService);

  private static readonly PageSize = 10;

  protected readonly quotations = signal<Quotation[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / QuotationHistory.PageSize))
  );

  constructor() {
    this.seo.apply({
      title: 'Your quotations',
      canonicalPath: '/account/quotations',
      noIndex: true
    });

    this.load();
  }

  /**
   * The first line, plus what else is on it.
   *
   * A quotation has no name of its own, and "WHQ-2609-00042" tells a customer
   * nothing about which room it was for. The first line usually does.
   */
  protected headline(quotation: Quotation): string {
    const first = quotation.lines[0];

    if (!first) {
      return 'Quotation';
    }

    const rest = quotation.lines.length - 1;

    return rest > 0
      ? `${first.description} and ${rest} more`
      : first.description;
  }

  protected statusLabel(quotation: Quotation): string {
    return QUOTATION_STATUS_LABELS[quotation.status] ?? quotation.status;
  }

  protected statusClass(quotation: Quotation): string {
    return QUOTATION_STATUS_CLASS[quotation.status] ?? 'text-bg-secondary';
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

    this.api.getMine(this.page(), QuotationHistory.PageSize).subscribe({
      next: result => {
        this.quotations.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
