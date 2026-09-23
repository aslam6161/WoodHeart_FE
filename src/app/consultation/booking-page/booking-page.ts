import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
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
 * One booking: the confirmation straight after booking, and the page a
 * customer comes back to.
 *
 * <b>Three ways in, one page.</b> Straight from the wizard, where the booking
 * arrives in router state and nothing is fetched. Signed in, where the API
 * knows whose it is. And a guest coming back later, who quotes the number and
 * the phone it was booked with — the same two facts a guest order is tracked
 * by, and the reason a guessed booking number on its own discloses nothing.
 *
 * <b>The phone is asked for on the page, never carried in the URL.</b> A URL
 * ends up in browser history, in a proxy log and in a referrer header, and the
 * phone number is the other half of the credential. So a refresh of this page
 * asks again rather than remembering.
 *
 * <b>"Requested" is said plainly, and is not green.</b> A booking is a request
 * until somebody at the shop looks at it; a customer who reads it as confirmed
 * is a customer who turns up to a studio that was not expecting them.
 */
@Component({
  selector: 'app-booking-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-8">
          @if (booking(); as detail) {
            @if (justBooked()) {
              <div class="alert alert-success" role="alert">
                <h1 class="h5 mb-1">Thank you — we have your request</h1>
                <p class="mb-0 small">
                  We will send an SMS to {{ detail.contactPhone }} once it is confirmed. Keep the
                  booking number below.
                </p>
              </div>
            } @else {
              <h1 class="h4 mb-3">Your consultation</h1>
            }

            <div class="border rounded p-4 mb-3">
              <div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
                <div>
                  <div class="h5 mb-1">{{ detail.serviceName }}</div>
                  <div class="font-monospace small text-muted">{{ detail.bookingNumber }}</div>
                </div>
                <span class="badge fw-normal" [class]="statusClass(detail)">
                  {{ statusLabel(detail) }}
                </span>
              </div>

              <dl class="row mb-0 gy-2 small">
                <dt class="col-4 col-sm-3 text-muted fw-normal">When</dt>
                <dd class="col-8 col-sm-9 mb-0">
                  {{ detail.scheduledAtUtc | date: 'EEEE d MMMM yyyy, h:mm a' : '+0600' }}
                  <span class="text-muted">
                    ({{ detail.durationMinutes }} minutes, Dhaka time)
                  </span>
                </dd>

                <dt class="col-4 col-sm-3 text-muted fw-normal">Where</dt>
                <dd class="col-8 col-sm-9 mb-0">
                  {{ modeLabel(detail) }}
                  @if (detail.siteAddress; as site) {
                    <div>{{ site.addressLine }}, {{ site.area }}, {{ site.district }}</div>
                    @if (site.landmark) {
                      <div class="text-muted">{{ site.landmark }}</div>
                    }
                  }
                </dd>

                @if (detail.consultantName) {
                  <dt class="col-4 col-sm-3 text-muted fw-normal">With</dt>
                  <dd class="col-8 col-sm-9 mb-0">{{ detail.consultantName }}</dd>
                }

                <dt class="col-4 col-sm-3 text-muted fw-normal">Fee</dt>
                <dd class="col-8 col-sm-9 mb-0">
                  @if (detail.fee > 0) {
                    {{ detail.fee | taka }}
                    @if (detail.advanceDue) {
                      <span class="text-muted">
                        &middot; {{ detail.advanceDue | taka }} to be paid in advance
                      </span>
                    }
                  } @else {
                    <span class="text-success fw-semibold">Free</span>
                  }
                </dd>

                @if (detail.roomTypes.length > 0) {
                  <dt class="col-4 col-sm-3 text-muted fw-normal">Rooms</dt>
                  <dd class="col-8 col-sm-9 mb-0">{{ detail.roomTypes.join(', ') }}</dd>
                }

                @if (detail.budgetRange) {
                  <dt class="col-4 col-sm-3 text-muted fw-normal">Budget</dt>
                  <dd class="col-8 col-sm-9 mb-0">{{ detail.budgetRange }}</dd>
                }

                @if (detail.projectBrief) {
                  <dt class="col-4 col-sm-3 text-muted fw-normal">Notes</dt>
                  <dd class="col-8 col-sm-9 mb-0">{{ detail.projectBrief }}</dd>
                }
              </dl>
            </div>

            @if (detail.timeline.length > 1) {
              <div class="border rounded p-4 mb-3">
                <h2 class="h6 text-uppercase text-muted small mb-3">What has happened</h2>
                <ul class="list-unstyled mb-0 small">
                  @for (entry of detail.timeline; track entry.occurredAt) {
                    <li class="d-flex gap-2 mb-2">
                      <span class="text-muted text-nowrap">
                        {{ entry.occurredAt | date: 'd MMM, h:mm a' : '+0600' }}
                      </span>
                      <span>
                        {{ statusLabelFor(entry.toStatus) }}
                        @if (entry.note) {
                          <span class="text-muted">— {{ entry.note }}</span>
                        }
                      </span>
                    </li>
                  }
                </ul>
              </div>
            }

            @if (refusal(); as message) {
              <div class="alert alert-warning small" role="alert">{{ message }}</div>
            }

            @if (detail.canCancel) {
              @if (cancelling()) {
                <div class="border rounded p-4">
                  <h2 class="h6 mb-2">Cancel this consultation?</h2>
                  <p class="small text-muted">
                    The time goes back on the calendar for somebody else. Tell us why, if you like.
                  </p>
                  <form class="row g-2 align-items-end" [formGroup]="cancelForm" (ngSubmit)="cancel()" novalidate>
                    <div class="col-12 col-sm-7">
                      <label class="form-label" for="reason">Reason (optional)</label>
                      <input id="reason" class="form-control" type="text" formControlName="reason" />
                    </div>
                    <div class="col-12 col-sm-5 d-flex gap-2">
                      <button class="btn btn-outline-danger" type="submit" [disabled]="busy()">
                        {{ busy() ? 'Cancelling…' : 'Yes, cancel it' }}
                      </button>
                      <button class="btn btn-link" type="button" (click)="cancelling.set(false)">
                        Keep it
                      </button>
                    </div>
                  </form>
                </div>
              } @else {
                <button class="btn btn-outline-secondary btn-sm" type="button" (click)="cancelling.set(true)">
                  Cancel this consultation
                </button>
              }
            } @else {
              <p class="small text-muted mb-0">
                This booking can no longer be changed here. Please telephone us if something has
                come up.
              </p>
            }
          } @else {
            <h1 class="h4 mb-1">Find your booking</h1>
            <p class="text-muted small mb-4">
              Enter the booking number from your SMS and the mobile number you booked with.
            </p>

            <form class="row g-2 align-items-end mb-3" [formGroup]="lookupForm" (ngSubmit)="lookup()" novalidate>
              <div class="col-12 col-sm-5">
                <label class="form-label" for="bookingNumber">Booking number</label>
                <input
                  id="bookingNumber"
                  class="form-control font-monospace"
                  type="text"
                  autocomplete="off"
                  placeholder="WHC-2609-00042"
                  formControlName="bookingNumber" />
              </div>
              <div class="col-12 col-sm-4">
                <label class="form-label" for="phone">Mobile number</label>
                <input
                  id="phone"
                  class="form-control"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  placeholder="01712345678"
                  formControlName="phone" />
              </div>
              <div class="col-12 col-sm-3 d-grid">
                <button class="btn btn-dark" type="submit" [disabled]="busy()">
                  {{ busy() ? 'Looking…' : 'Find it' }}
                </button>
              </div>
            </form>

            @if (notFound()) {
              <div class="alert alert-warning small" role="alert">
                We could not find a booking with that number and mobile number. Check both against
                your SMS — the number starts with <span class="font-monospace">WHC-</span>.
              </div>
            }

            @if (!account.isAuthenticated()) {
              <p class="small text-muted mb-0">
                Have an account? <a routerLink="/account/bookings">Sign in</a> to see all your
                bookings without typing anything.
              </p>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class BookingPage {
  private readonly api = inject(ConsultationApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly account = inject(AccountService);

  protected readonly booking = signal<Booking | null>(null);
  protected readonly justBooked = signal(false);
  protected readonly busy = signal(false);
  protected readonly notFound = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected readonly lookupForm = this.formBuilder.nonNullable.group({
    bookingNumber: ['', [Validators.required, Validators.maxLength(30)]],
    phone: ['', [Validators.required, Validators.maxLength(20)]]
  });

  protected readonly cancelForm = this.formBuilder.nonNullable.group({
    reason: ['', Validators.maxLength(500)]
  });

  /** Remembered from the lookup, so cancelling does not ask for it again. */
  private phone: string | null = null;

  constructor() {
    const number = this.route.snapshot.paramMap.get('bookingNumber');

    this.seo.apply({
      title: 'Your consultation',
      canonicalPath: number ? `/consultation/bookings/${number}` : '/consultation/find',
      noIndex: true
    });

    // Straight from the wizard: the booking is in router state, so nothing is
    // fetched and the guest is not asked for a number they have not been sent
    // yet.
    const passed = this.router.getCurrentNavigation()?.extras.state?.['booking'] as
      | Booking
      | undefined;

    if (passed) {
      this.booking.set(passed);
      this.justBooked.set(true);
      return;
    }

    if (number) {
      this.lookupForm.controls.bookingNumber.setValue(number);

      // A signed-in customer needs nothing else; the API knows whose it is.
      // A guest falls through to the form below.
      if (this.account.isAuthenticated()) {
        this.fetch(number, null);
      }
    }
  }

  protected modeLabel(booking: Booking): string {
    return MODE_LABELS[booking.mode] ?? booking.mode;
  }

  protected statusLabel(booking: Booking): string {
    return this.statusLabelFor(booking.status);
  }

  protected statusLabelFor(status: Booking['status']): string {
    return BOOKING_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(booking: Booking): string {
    return BOOKING_STATUS_CLASS[booking.status] ?? 'text-bg-secondary';
  }

  protected lookup(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }

    const value = this.lookupForm.getRawValue();

    this.fetch(value.bookingNumber.trim().toUpperCase(), value.phone.trim());
  }

  protected cancel(): void {
    const booking = this.booking();

    if (!booking) {
      return;
    }

    this.busy.set(true);
    this.refusal.set(null);

    this.api
      .cancel(booking.bookingNumber, {
        phone: this.phone,
        reason: this.cancelForm.getRawValue().reason.trim() || null
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.busy.set(false);
          this.cancelling.set(false);

          if (response.isSuccess && response.data) {
            this.booking.set(response.data);
            this.justBooked.set(false);

            return;
          }

          // "Please telephone us" — the API refuses once the consultation has
          // happened or is already off, and its wording says which.
          this.refusal.set(response.message || 'We could not cancel that booking.');
        },
        error: () => {
          this.busy.set(false);
          this.refusal.set('We could not reach the shop. Please try again.');
        }
      });
  }

  private fetch(bookingNumber: string, phone: string | null): void {
    this.busy.set(true);
    this.notFound.set(false);

    this.api
      .get(bookingNumber, phone)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: booking => {
          this.busy.set(false);
          this.booking.set(booking);
          this.notFound.set(booking === null && phone !== null);
          this.phone = phone;
        },
        error: () => this.busy.set(false)
      });
  }
}
