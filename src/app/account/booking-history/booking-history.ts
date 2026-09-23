import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConsultationApiService } from '../../_services/consultation.service';
import { SeoService } from '../../_services/seo.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import {
  BOOKING_STATUS_CLASS,
  BOOKING_STATUS_LABELS,
  Booking,
  MODE_LABELS
} from '../../_models/consultations';

/**
 * "Your consultations" — everything the signed-in customer has booked.
 *
 * The API answers soonest first, which is the right order here and the
 * opposite of the orders page: what somebody opens this for is the
 * appointment they have to be at, not the one they have already had.
 *
 * Times are rendered in Dhaka rather than the browser's zone — see the
 * booking wizard for why that matters to somebody abroad furnishing a flat
 * here.
 */
@Component({
  selector: 'app-booking-history',
  imports: [RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="d-flex flex-wrap align-items-baseline gap-2 mb-4">
        <h1 class="h3 mb-0">Your consultations</h1>
        @if (total() > 0) {
          <span class="text-muted small">
            {{ total() }} {{ total() === 1 ? 'booking' : 'bookings' }}
          </span>
        }
      </div>

      @if (loading()) {
        <p class="text-muted small">Loading…</p>
      } @else if (bookings().length === 0) {
        <div class="border rounded p-5 text-center">
          <p class="mb-3">You have not booked a consultation with us yet.</p>
          <a class="btn btn-dark" routerLink="/consultation">Talk to a designer</a>
        </div>
      } @else {
        <ul class="list-unstyled border-top mb-0">
          @for (booking of bookings(); track booking.id) {
            <li class="border-bottom">
              <a
                class="d-flex gap-3 py-3 text-decoration-none text-dark align-items-center"
                [routerLink]="['/consultation/bookings', booking.bookingNumber]">
                <div class="flex-grow-1 min-w-0">
                  <div class="fw-semibold text-truncate">{{ booking.serviceName }}</div>
                  <div class="small text-muted">
                    {{ booking.scheduledAtUtc | date: 'EEE d MMM yyyy, h:mm a' : '+0600' }}
                    &middot; {{ modeLabel(booking) }}
                    @if (booking.consultantName) {
                      &middot; {{ booking.consultantName }}
                    }
                  </div>
                  <div class="small text-muted font-monospace">{{ booking.bookingNumber }}</div>
                  <span class="badge mt-1 fw-normal" [class]="statusClass(booking)">
                    {{ statusLabel(booking) }}
                  </span>
                </div>

                <div class="text-end flex-shrink-0">
                  <div class="fw-semibold">
                    @if (booking.fee > 0) {
                      {{ booking.fee | taka }}
                    } @else {
                      <span class="text-success">Free</span>
                    }
                  </div>
                  <div class="small text-muted d-none d-sm-block">View &rsaquo;</div>
                </div>
              </a>
            </li>
          }
        </ul>

        @if (totalPages() > 1) {
          <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Booking pages">
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
export class BookingHistory {
  private readonly api = inject(ConsultationApiService);
  private readonly seo = inject(SeoService);

  private static readonly PageSize = 10;

  protected readonly bookings = signal<Booking[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / BookingHistory.PageSize))
  );

  constructor() {
    this.seo.apply({
      title: 'Your consultations',
      canonicalPath: '/account/bookings',
      noIndex: true
    });

    this.load();
  }

  protected modeLabel(booking: Booking): string {
    return MODE_LABELS[booking.mode] ?? booking.mode;
  }

  protected statusLabel(booking: Booking): string {
    return BOOKING_STATUS_LABELS[booking.status] ?? booking.status;
  }

  protected statusClass(booking: Booking): string {
    return BOOKING_STATUS_CLASS[booking.status] ?? 'text-bg-secondary';
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

    this.api.getMine(this.page(), BookingHistory.PageSize).subscribe({
      next: result => {
        this.bookings.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
