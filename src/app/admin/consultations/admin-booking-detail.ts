import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminConsultationService } from '../../_services/admin/admin-consultation.service';
import { ConsultationApiService } from '../../_services/consultation.service';
import { ToastService } from '../../_services/toast.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { ADMIN_MODE_LABELS } from '../../_models/admin-consultations';
import {
  BOOKING_STATUS_CLASS,
  BOOKING_STATUS_LABELS,
  AvailabilityDay,
  Booking,
  BookingStatus,
  Consultant
} from '../../_models/consultations';

/**
 * One booking, and the three things the shop does with it: confirm it, move
 * it, or write off the afternoon.
 *
 * <b>The buttons come from the API.</b> `allowedStatusTransitions` is sent
 * from the same table the API refuses with, so a button that renders is a
 * button that works. A second copy of the graph in TypeScript would drift, and
 * the drift is a press that returns a 409.
 *
 * <b>Moving is not a status change with a date on it.</b> It has its own
 * endpoint and its own panel here, because it is checked against the schedule
 * the customer's own calendar is drawn from — so the shop cannot put somebody
 * where a customer could not have — and because it can still lose to a
 * customer booking that slot a moment earlier. The times offered are the
 * customer's times, fetched from the public availability endpoint.
 */
@Component({
  selector: 'app-admin-booking-detail',
  imports: [FormsModule, RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/consultations">
      &lsaquo; All consultations
    </a>

    @if (loading()) {
      <p class="text-muted small mt-3">Loading…</p>
    } @else if (booking(); as item) {
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mb-3">
        <h1 class="h4 mb-0 font-monospace">{{ item.bookingNumber }}</h1>
        <span class="badge fw-normal" [class]="statusClass(item.status)">
          {{ statusLabel(item.status) }}
        </span>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-7">
          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">The appointment</h2>

            <dl class="row mb-0 gy-2 small">
              <dt class="col-4 text-muted fw-normal">When</dt>
              <dd class="col-8 mb-0">
                {{ item.scheduledAtUtc | date: 'EEEE d MMMM yyyy, h:mm a' : '+0600' }}
                <span class="text-muted">({{ item.durationMinutes }} minutes)</span>
              </dd>

              <dt class="col-4 text-muted fw-normal">What</dt>
              <dd class="col-8 mb-0">{{ item.serviceName }} &middot; {{ modeLabel(item) }}</dd>

              <dt class="col-4 text-muted fw-normal">Designer</dt>
              <dd class="col-8 mb-0">{{ item.consultantName ?? 'Nobody assigned' }}</dd>

              <dt class="col-4 text-muted fw-normal">Fee</dt>
              <dd class="col-8 mb-0">
                @if (item.fee > 0) {
                  {{ item.fee | taka }}
                  @if (item.advanceDue) {
                    <span class="text-muted">&middot; {{ item.advanceDue | taka }} deposit</span>
                  }
                } @else {
                  Free
                }
              </dd>

              @if (item.siteAddress; as site) {
                <dt class="col-4 text-muted fw-normal">Address</dt>
                <dd class="col-8 mb-0">
                  {{ site.addressLine }}, {{ site.area }}, {{ site.district }}
                  @if (site.landmark) {
                    <div class="text-muted">{{ site.landmark }}</div>
                  }
                </dd>
              }
            </dl>
          </div>

          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">The customer</h2>

            <dl class="row mb-0 gy-2 small">
              <dt class="col-4 text-muted fw-normal">Name</dt>
              <dd class="col-8 mb-0">{{ item.contactName }}</dd>

              <dt class="col-4 text-muted fw-normal">Phone</dt>
              <dd class="col-8 mb-0">
                <a class="text-decoration-none" [href]="'tel:' + item.contactPhone">
                  {{ item.contactPhone }}
                </a>
              </dd>

              @if (item.contactEmail) {
                <dt class="col-4 text-muted fw-normal">Email</dt>
                <dd class="col-8 mb-0">{{ item.contactEmail }}</dd>
              }

              @if (item.roomTypes.length > 0) {
                <dt class="col-4 text-muted fw-normal">Rooms</dt>
                <dd class="col-8 mb-0">{{ item.roomTypes.join(', ') }}</dd>
              }

              @if (item.budgetRange) {
                <dt class="col-4 text-muted fw-normal">Budget</dt>
                <dd class="col-8 mb-0">{{ item.budgetRange }}</dd>
              }

              @if (item.projectBrief) {
                <dt class="col-4 text-muted fw-normal">Brief</dt>
                <dd class="col-8 mb-0">{{ item.projectBrief }}</dd>
              }
            </dl>
          </div>

          <div class="border rounded p-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">History</h2>
            <ul class="list-unstyled mb-0 small">
              @for (entry of item.timeline; track entry.occurredAt) {
                <li class="d-flex gap-2 mb-2">
                  <span class="text-muted text-nowrap">
                    {{ entry.occurredAt | date: 'd MMM, h:mm a' : '+0600' }}
                  </span>
                  <span>
                    {{ statusLabel(entry.toStatus) }}
                    <span class="text-muted">by {{ entry.actorName }}</span>
                    @if (entry.note) {
                      <div class="text-muted">{{ entry.note }}</div>
                    }
                  </span>
                </li>
              }
            </ul>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">Move it along</h2>

            @if (item.allowedStatusTransitions.length === 0) {
              <p class="small text-muted mb-0">
                This booking is finished. Nothing more can be done to it here.
              </p>
            } @else if (buttons().length === 0) {
              <p class="small text-muted mb-0">
                The only thing left for this one is a new time — use the panel below.
              </p>
            } @else {
              <label class="form-label small" for="note">Note (optional)</label>
              <input
                id="note"
                class="form-control form-control-sm mb-2"
                type="text"
                maxlength="500"
                placeholder="Rung the customer; they confirmed."
                [(ngModel)]="note" />
              <div class="form-text mb-2">
                Confirming, moving and cancelling each send the customer an SMS.
              </div>

              <div class="d-flex flex-wrap gap-2">
                @for (next of buttons(); track next) {
                  <button
                    class="btn btn-sm"
                    type="button"
                    [class]="actionClass(next)"
                    [disabled]="busy()"
                    (click)="setStatus(next)">
                    {{ actionLabel(next) }}
                  </button>
                }
              </div>
            }
          </div>

          @if (canMove()) {
            <div class="border rounded p-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">Move it to another time</h2>

              <div class="row g-2 mb-3">
                <div class="col-12">
                  <label class="form-label small" for="designer">Designer</label>
                  <select
                    id="designer"
                    class="form-select form-select-sm"
                    [ngModel]="moveConsultantId()"
                    (ngModelChange)="onMoveConsultant($event)">
                    <option [ngValue]="null">Whoever is free</option>
                    @for (person of consultants(); track person.id) {
                      <option [ngValue]="person.id">{{ person.name }}</option>
                    }
                  </select>
                </div>
              </div>

              @if (loadingSlots()) {
                <p class="small text-muted mb-0">Looking at the diary…</p>
              } @else if (days().length === 0) {
                <p class="small text-muted mb-0">
                  Nothing free in the next fortnight for that choice.
                </p>
              } @else {
                <div class="d-flex gap-2 overflow-auto pb-2 mb-2 wh-move-days">
                  @for (day of days(); track day.date) {
                    <button
                      type="button"
                      class="btn btn-sm text-nowrap"
                      [class]="day.date === moveDate() ? 'btn-dark' : 'btn-outline-dark'"
                      (click)="moveDate.set(day.date); moveStart.set(null)">
                      {{ day.date | date: 'EEE d MMM' : '+0600' }}
                    </button>
                  }
                </div>

                <div class="d-flex flex-wrap gap-2 mb-3 wh-move-slots">
                  @for (slot of slotsForDay(); track slot.startUtc) {
                    <button
                      type="button"
                      class="btn btn-sm"
                      [class]="slot.startUtc === moveStart() ? 'btn-dark' : 'btn-outline-dark'"
                      (click)="moveStart.set(slot.startUtc)">
                      {{ slot.startUtc | date: 'h:mm a' : '+0600' }}
                    </button>
                  }
                </div>

                <button
                  class="btn btn-sm btn-dark"
                  type="button"
                  [disabled]="!moveStart() || busy()"
                  (click)="move()">
                  Move this booking
                </button>

                <div class="form-text">
                  The customer is told the new time. The times here are the ones a customer
                  would be offered, so nothing can be put where a customer could not have
                  booked it.
                </div>
              }
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="border rounded p-5 text-center text-muted mt-3">
        <p class="mb-0">No booking with that number.</p>
      </div>
    }
  `
})
export class AdminBookingDetail {
  private readonly api = inject(AdminConsultationService);
  private readonly publicApi = inject(ConsultationApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly booking = signal<Booking | null>(null);
  protected readonly consultants = signal<Consultant[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingSlots = signal(false);
  protected readonly busy = signal(false);

  protected note = '';

  protected readonly days = signal<AvailabilityDay[]>([]);
  protected readonly moveDate = signal<string | null>(null);
  protected readonly moveStart = signal<string | null>(null);
  protected readonly moveConsultantId = signal<number | null>(null);

  protected readonly slotsForDay = computed(
    () => this.days().find(day => day.date === this.moveDate())?.slots ?? []
  );

  /** Only a booking the machine would let move gets the panel at all. */
  protected readonly canMove = computed(
    () => this.booking()?.allowedStatusTransitions.includes('Rescheduled') ?? false
  );

  /**
   * The moves that are one press.
   *
   * Rescheduling is legal here and is deliberately not among them: it needs a
   * time, and it has the panel below to pick one in. A greyed-out button
   * beside the others would only be something to wonder about.
   */
  protected readonly buttons = computed(() =>
    (this.booking()?.allowedStatusTransitions ?? []).filter(next => next !== 'Rescheduled')
  );

  private serviceId: number | null = null;

  private readonly bookingNumber = this.route.snapshot.paramMap.get('bookingNumber') ?? '';

  constructor() {
    this.api.getConsultants().subscribe(people => this.consultants.set(people));
    this.load();
  }

  protected statusLabel(status: BookingStatus): string {
    return BOOKING_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: BookingStatus): string {
    return BOOKING_STATUS_CLASS[status] ?? 'text-bg-secondary';
  }

  protected modeLabel(booking: Booking): string {
    return ADMIN_MODE_LABELS[booking.mode] ?? booking.mode;
  }

  /** The verb, not the status. "Confirm", not "Confirmed" — it is a button. */
  protected actionLabel(status: BookingStatus): string {
    switch (status) {
      case 'Confirmed':
        return 'Confirm';
      case 'Completed':
        return 'Mark done';
      case 'Cancelled':
        return 'Cancel';
      case 'NoShow':
        return 'Nobody came';
      case 'Rescheduled':
        return 'Move';
      default:
        return status;
    }
  }

  protected actionClass(status: BookingStatus): string {
    switch (status) {
      case 'Confirmed':
        return 'btn-dark';
      case 'Completed':
        return 'btn-outline-success';
      case 'Cancelled':
      case 'NoShow':
        return 'btn-outline-danger';
      default:
        return 'btn-outline-secondary';
    }
  }

  protected setStatus(status: BookingStatus): void {
    this.busy.set(true);

    this.api.setStatus(this.bookingNumber, { status, note: this.note.trim() || null }).subscribe({
      next: response => {
        this.busy.set(false);

        if (response.isSuccess && response.data) {
          this.apply(response.data);
          this.note = '';
          this.toast.success(`Booking ${this.statusLabel(status).toLowerCase()}.`);

          return;
        }

        this.toast.error(response.message || 'That move was refused.');
      },
      error: () => this.busy.set(false)
    });
  }

  protected onMoveConsultant(id: number | null): void {
    this.moveConsultantId.set(id);
    this.moveStart.set(null);
    this.loadSlots();
  }

  protected move(): void {
    const startUtc = this.moveStart();

    if (!startUtc) {
      return;
    }

    this.busy.set(true);

    this.api
      .reschedule(this.bookingNumber, {
        startUtc,
        consultantId: this.moveConsultantId(),
        note: this.note.trim() || null
      })
      .subscribe({
        next: response => {
          this.busy.set(false);

          if (response.isSuccess && response.data) {
            this.apply(response.data);
            this.note = '';
            this.moveStart.set(null);
            this.toast.success('Moved, and the customer has been told.');

            // The old time is free again and the new one is not, so the
            // calendar on this page is now wrong. Fetched rather than patched.
            this.loadSlots();

            return;
          }

          // "Somebody booked that time while you were looking at it" is the
          // one that matters, and it is worth redrawing for.
          this.toast.error(response.message || 'That time could not be taken.');
          this.loadSlots();
        },
        error: () => this.busy.set(false)
      });
  }

  private load(): void {
    this.loading.set(true);

    this.api.getBooking(this.bookingNumber).subscribe({
      next: booking => {
        this.loading.set(false);

        if (!booking) {
          return;
        }

        this.apply(booking);

        // The move panel needs the service the booking is for, and the booking
        // itself carries only its name. One extra call, once.
        this.publicApi.getServices().subscribe(services => {
          this.serviceId =
            services.find(service => service.name === booking.serviceName)?.id ?? null;

          if (this.canMove()) {
            this.loadSlots();
          }
        });
      },
      error: () => this.loading.set(false)
    });
  }

  private apply(booking: Booking): void {
    this.booking.set(booking);
    this.moveConsultantId.set(
      this.consultants().find(person => person.name === booking.consultantName)?.id ?? null
    );
  }

  private loadSlots(): void {
    if (this.serviceId === null) {
      return;
    }

    this.loadingSlots.set(true);

    this.publicApi
      .getAvailability(this.serviceId, dhakaDate(0), dhakaDate(13), this.moveConsultantId())
      .subscribe({
        next: availability => {
          this.days.set(availability.days);
          this.loadingSlots.set(false);

          const still = availability.days.some(day => day.date === this.moveDate());

          if (!still) {
            this.moveDate.set(availability.days[0]?.date ?? null);
          }
        },
        error: () => this.loadingSlots.set(false)
      });
  }
}

/** A Dhaka date, so many days from today. See the board for why not the browser's. */
function dhakaDate(offsetDays: number): string {
  const dhaka = new Date(Date.now() + 6 * 60 * 60 * 1000 + offsetDays * 86_400_000);

  return dhaka.toISOString().slice(0, 10);
}
