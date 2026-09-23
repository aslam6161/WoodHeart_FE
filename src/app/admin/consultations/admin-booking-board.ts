import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminConsultationService } from '../../_services/admin/admin-consultation.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { ADMIN_MODE_LABELS, BookingListItem } from '../../_models/admin-consultations';
import {
  BOOKING_STATUS_CLASS,
  BOOKING_STATUS_LABELS,
  BookingStatus,
  ConsultationMode,
  Consultant
} from '../../_models/consultations';

/** The windows staff actually read a diary in. */
type Window = 'today' | 'week' | 'upcoming' | 'all';

/**
 * The diary: who is coming, when, and which of them nobody has answered yet.
 *
 * <b>A diary, not a to-do funnel.</b> The order board is a funnel — confirm,
 * pack, ship — and its tabs are statuses. A consultation board is read
 * forwards in time: what is on today, what is on this week. So the first
 * control is the window, and the status is a filter beside it.
 *
 * <b>Requested is the one that matters.</b> Everything else is somebody
 * turning up to an agreed appointment; a Requested booking is a customer
 * waiting on the shop, and the longer it sits the worse it is. It is coloured
 * for that reason, and the day it was asked for is on the row.
 *
 * <b>Times are Dhaka's.</b> The API answers UTC instants, and every one goes
 * through `+0600`. Staff reading this are in Dhaka; a laptop set to another
 * zone must not quietly move the day's appointments.
 */
@Component({
  selector: 'app-admin-booking-board',
  imports: [FormsModule, RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Consultations</h1>
      <span class="badge text-bg-light">{{ total() }}</span>

      <div class="ms-auto d-flex gap-2">
        <a class="btn btn-sm btn-outline-secondary" routerLink="/admin/consultations/services">
          What we offer
        </a>
        <a class="btn btn-sm btn-outline-secondary" routerLink="/admin/consultations/consultants">
          Designers
        </a>
      </div>
    </div>

    <ul class="nav nav-pills flex-nowrap overflow-auto mb-3" role="tablist">
      @for (option of windows; track option.key) {
        <li class="nav-item">
          <button
            class="nav-link btn-sm text-nowrap"
            type="button"
            [class.active]="window() === option.key"
            (click)="onWindow(option.key)">
            {{ option.label }}
          </button>
        </li>
      }
    </ul>

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-4">
        <input
          class="form-control"
          type="search"
          placeholder="Search booking number, name or phone"
          aria-label="Search bookings"
          [ngModel]="term()"
          (ngModelChange)="onSearch($event)" />
        @if (term()) {
          <div class="form-text">Searching looks across the whole diary, not just this window.</div>
        }
      </div>

      <div class="col-6 col-md-3">
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

      <div class="col-6 col-md-3">
        <select
          class="form-select"
          aria-label="Designer"
          [ngModel]="consultantId()"
          (ngModelChange)="onConsultant($event)">
          <option [ngValue]="null">Anybody</option>
          @for (person of consultants(); track person.id) {
            <option [ngValue]="person.id">{{ person.name }}</option>
          }
        </select>
      </div>

      <div class="col-6 col-md-2">
        <select
          class="form-select"
          aria-label="Kind"
          [ngModel]="mode()"
          (ngModelChange)="onMode($event)">
          <option [ngValue]="null">Any kind</option>
          @for (option of modes; track option) {
            <option [ngValue]="option">{{ modeLabel(option) }}</option>
          }
        </select>
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (bookings().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-0">
          @if (term()) {
            Nothing matches "{{ term() }}".
          } @else if (window() === 'today') {
            Nothing is booked for today.
          } @else {
            Nothing booked in this window.
          }
        </p>
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">When</th>
              <th scope="col">Booking</th>
              <th scope="col">Customer</th>
              <th scope="col">Designer</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-end">Fee</th>
            </tr>
          </thead>
          <tbody>
            @for (booking of bookings(); track booking.id) {
              <tr [class.table-warning]="booking.status === 'Requested'">
                <td class="text-nowrap">
                  <div class="fw-semibold">
                    {{ booking.scheduledAtUtc | date: 'EEE d MMM' : '+0600' }}
                  </div>
                  <div class="small text-muted">
                    {{ booking.scheduledAtUtc | date: 'h:mm a' : '+0600' }}
                    &middot; {{ booking.durationMinutes }}m
                  </div>
                </td>

                <td>
                  <a
                    class="fw-semibold text-decoration-none font-monospace"
                    [routerLink]="['/admin/consultations/bookings', booking.bookingNumber]">
                    {{ booking.bookingNumber }}
                  </a>
                  <div class="small text-muted">
                    {{ booking.serviceName }} &middot; {{ modeLabel(booking.mode) }}
                  </div>
                  @if (booking.siteLocation) {
                    <!-- Where the designer is going. Two site visits across the
                         city in one afternoon is the thing this column exists
                         to prevent. -->
                    <div class="small">{{ booking.siteLocation }}</div>
                  }
                </td>

                <td>
                  {{ booking.contactName }}
                  <!-- Unmasked and clickable: ringing the customer is the first
                       thing anybody does with a booking nobody has confirmed. -->
                  <div class="small">
                    <a class="text-muted text-decoration-none" [href]="'tel:' + booking.contactPhone">
                      {{ booking.contactPhone }}
                    </a>
                  </div>
                </td>

                <td class="small">{{ booking.consultantName ?? '—' }}</td>

                <td>
                  <span class="badge fw-normal" [class]="statusClass(booking.status)">
                    {{ statusLabel(booking.status) }}
                  </span>
                  @if (booking.status === 'Requested') {
                    <div class="small text-muted">
                      asked {{ booking.requestedAt | date: 'd MMM' : '+0600' }}
                    </div>
                  }
                </td>

                <td class="text-end text-nowrap">
                  @if (booking.fee > 0) {
                    {{ booking.fee | taka }}
                    @if (booking.advanceDue) {
                      <div class="small text-muted">{{ booking.advanceDue | taka }} deposit</div>
                    }
                  } @else {
                    <span class="text-muted">Free</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Booking pages">
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
export class AdminBookingBoard {
  private readonly api = inject(AdminConsultationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private static readonly PageSize = 20;

  protected readonly windows: readonly { key: Window; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Next 7 days' },
    { key: 'upcoming', label: 'Everything ahead' },
    { key: 'all', label: 'Including the past' }
  ];

  protected readonly statuses: readonly BookingStatus[] = [
    'Requested',
    'Confirmed',
    'Rescheduled',
    'Completed',
    'Cancelled',
    'NoShow'
  ];

  protected readonly modes: readonly ConsultationMode[] = ['Online', 'InStudio', 'SiteVisit'];

  protected readonly bookings = signal<BookingListItem[]>([]);
  protected readonly consultants = signal<Consultant[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly term = signal('');
  protected readonly status = signal<BookingStatus | null>(null);
  protected readonly consultantId = signal<number | null>(null);
  protected readonly mode = signal<ConsultationMode | null>(null);
  protected readonly window = signal<Window>('week');

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminBookingBoard.PageSize))
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('window') as Window | null;

    if (requested && this.windows.some(option => option.key === requested)) {
      this.window.set(requested);
    }

    const status = this.route.snapshot.queryParamMap.get('status') as BookingStatus | null;

    if (status && this.statuses.includes(status)) {
      this.status.set(status);
    }

    this.load();
    this.api.getConsultants().subscribe(people => this.consultants.set(people));
  }

  protected statusLabel(status: BookingStatus): string {
    return BOOKING_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: BookingStatus): string {
    return BOOKING_STATUS_CLASS[status] ?? 'text-bg-secondary';
  }

  protected modeLabel(mode: ConsultationMode): string {
    return ADMIN_MODE_LABELS[mode] ?? mode;
  }

  protected onWindow(window: Window): void {
    this.window.set(window);
    this.page.set(1);
    this.remember();
    this.load();
  }

  protected onStatus(status: BookingStatus | null): void {
    this.status.set(status);
    this.page.set(1);
    this.remember();
    this.load();
  }

  protected onConsultant(id: number | null): void {
    this.consultantId.set(id);
    this.page.set(1);
    this.load();
  }

  protected onMode(mode: ConsultationMode | null): void {
    this.mode.set(mode);
    this.page.set(1);
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

  /** The window and the status in the URL, so a view can be bookmarked or sent on. */
  private remember(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { window: this.window(), status: this.status() },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private load(): void {
    this.loading.set(true);

    const { from, to } = this.dates();

    this.api
      .searchBookings({
        term: this.term() || null,
        status: this.status(),
        consultantId: this.consultantId(),
        mode: this.mode(),
        from,
        to,
        page: this.page(),
        pageSize: AdminBookingBoard.PageSize
      })
      .subscribe({
        next: result => {
          this.bookings.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  /**
   * The window as a pair of Dhaka dates.
   *
   * "Everything ahead" sends nothing at all, because the API's own answer to
   * an empty query is today onwards — repeating it here would be a second
   * place for that rule to live. "Including the past" has to say so
   * explicitly, and does it by naming a date far enough back to mean all of it.
   */
  private dates(): { from: string | null; to: string | null } {
    switch (this.window()) {
      case 'today':
        return { from: dhakaDate(0), to: dhakaDate(0) };
      case 'week':
        return { from: dhakaDate(0), to: dhakaDate(6) };
      case 'all':
        return { from: dhakaDate(-3650), to: null };
      default:
        return { from: null, to: null };
    }
  }
}

/**
 * A Dhaka date, so many days from today, as `YYYY-MM-DD`.
 *
 * Built by shifting the instant into +06:00 rather than reading the browser's
 * own today: an admin laptop set to another zone must not show a different
 * day's diary from the one the shop is working.
 */
function dhakaDate(offsetDays: number): string {
  const dhaka = new Date(Date.now() + 6 * 60 * 60 * 1000 + offsetDays * 86_400_000);

  return dhaka.toISOString().slice(0, 10);
}
