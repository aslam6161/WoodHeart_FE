import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { ConsultationApiService } from '../../_services/consultation.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { SeoService } from '../../_services/seo.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { DIVISIONS, districtsOf } from '../../_models/bangladesh';
import {
  AvailabilityDay,
  AvailabilitySlot,
  BUDGET_RANGES,
  ConsultationService,
  MODE_LABELS,
  ROOM_TYPES
} from '../../_models/consultations';

/**
 * Booking a consultation: who, when, and what it is about.
 *
 * <b>One page, three sections, rather than three routed steps.</b> A customer
 * who has picked a four o'clock and then finds the form asks for their address
 * needs to see both at once to change their mind — and a back button that
 * throws away a chosen slot is how somebody gives up. The sections unfold as
 * each is answered.
 *
 * <b>Times are rendered in Dhaka, not in the browser's zone.</b> The API
 * answers with UTC instants, and every one of them is put through
 * `date: … : '+0600'`. Somebody booking their Dhaka flat from Dubai or London
 * must read the same four o'clock the consultant will be at the studio for;
 * left to the browser they would read it in their own time and arrive two
 * hours late. Bangladesh keeps +06:00 all year, so a fixed offset is exact.
 *
 * <b>The slot is sent back exactly as it arrived.</b> The page never builds a
 * time of its own — it hands back one of the instants the API offered, which
 * is what makes the server's re-check meaningful rather than a formality.
 */
@Component({
  selector: 'app-booking-wizard',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-9">
          @if (loading()) {
            <p class="text-muted small">Loading…</p>
          } @else if (service(); as chosen) {
            <a class="small text-muted text-decoration-none" routerLink="/consultation">
              &lsaquo; All consultations
            </a>

            <h1 class="h3 mt-2 mb-1">{{ chosen.name }}</h1>
            <p class="text-muted mb-4">
              {{ modeLabel(chosen) }} &middot; {{ chosen.durationMinutes }} minutes &middot;
              @if (chosen.fee > 0) {
                {{ chosen.fee | taka }}
              } @else {
                <span class="text-success fw-semibold">Free</span>
              }
            </p>

            <!-- 1. Who -->
            @if (chosen.consultants.length > 1) {
              <section class="mb-4">
                <h2 class="h6 text-uppercase text-muted small mb-2">Who would you like?</h2>
                <div class="d-flex flex-wrap gap-2 wh-consultants">
                  <button
                    type="button"
                    class="btn btn-sm"
                    [class]="consultantId() === null ? 'btn-dark' : 'btn-outline-dark'"
                    (click)="chooseConsultant(null)">
                    Anybody
                  </button>
                  @for (person of chosen.consultants; track person.id) {
                    <button
                      type="button"
                      class="btn btn-sm d-flex align-items-center gap-2"
                      [class]="consultantId() === person.id ? 'btn-dark' : 'btn-outline-dark'"
                      (click)="chooseConsultant(person.id)">
                      @if (photo(person.photoPath); as src) {
                        <img class="rounded-circle" [src]="src" alt="" width="20" height="20" />
                      }
                      {{ person.name }}
                    </button>
                  }
                </div>
                <p class="form-text">
                  "Anybody" usually means more times to choose from.
                </p>
              </section>
            }

            <!-- 2. When -->
            <section class="mb-4">
              <div class="d-flex align-items-baseline justify-content-between mb-2">
                <h2 class="h6 text-uppercase text-muted small mb-0">Pick a time</h2>
                <div class="btn-group btn-group-sm">
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    [disabled]="windowStart() === 0 || loadingSlots()"
                    (click)="shiftWindow(-1)">
                    Earlier
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    [disabled]="windowStart() >= maxWindowStart || loadingSlots()"
                    (click)="shiftWindow(1)">
                    Later
                  </button>
                </div>
              </div>

              @if (loadingSlots()) {
                <p class="text-muted small mb-0">Looking at the diary…</p>
              } @else if (days().length === 0) {
                <div class="border rounded p-4 text-center">
                  <p class="mb-1 small">Nothing free in these two weeks.</p>
                  <button class="btn btn-sm btn-outline-dark" type="button" (click)="shiftWindow(1)">
                    Try the fortnight after
                  </button>
                </div>
              } @else {
                <div class="d-flex gap-2 overflow-auto pb-2 mb-3 wh-days">
                  @for (day of days(); track day.date) {
                    <button
                      type="button"
                      class="btn btn-sm text-nowrap"
                      [class]="day.date === selectedDate() ? 'btn-dark' : 'btn-outline-dark'"
                      (click)="chooseDay(day.date)">
                      {{ day.date | date: 'EEE d MMM' : '+0600' }}
                      <span class="badge rounded-pill text-bg-light ms-1 fw-normal">
                        {{ day.slots.length }}
                      </span>
                    </button>
                  }
                </div>

                <div class="d-flex flex-wrap gap-2 wh-slots">
                  @for (slot of slotsForDay(); track slot.startUtc) {
                    <button
                      type="button"
                      class="btn btn-sm"
                      [class]="slot.startUtc === startUtc() ? 'btn-dark' : 'btn-outline-dark'"
                      (click)="chooseSlot(slot)">
                      {{ slot.startUtc | date: 'h:mm a' : '+0600' }}
                    </button>
                  }
                </div>

                @if (chosenSlot(); as slot) {
                  <p class="form-text mb-0">
                    {{ slot.startUtc | date: 'EEEE d MMMM, h:mm a' : '+0600' }} with
                    {{ slot.consultantName }}. All times are Dhaka time.
                  </p>
                }
              }
            </section>

            <!-- 3. About you -->
            @if (startUtc()) {
              <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
                <section class="mb-4">
                  <h2 class="h6 text-uppercase text-muted small mb-2">How do we reach you?</h2>

                  <div class="row g-2">
                    <div class="col-12 col-sm-6">
                      <label class="form-label" for="contactName">Your name</label>
                      <input
                        id="contactName"
                        class="form-control"
                        type="text"
                        autocomplete="name"
                        formControlName="contactName"
                        [class.is-invalid]="invalid('contactName')" />
                      @if (invalid('contactName')) {
                        <div class="invalid-feedback">Please tell us your name.</div>
                      }
                    </div>

                    <div class="col-12 col-sm-6">
                      <label class="form-label" for="contactPhone">Mobile number</label>
                      <input
                        id="contactPhone"
                        class="form-control"
                        type="tel"
                        inputmode="numeric"
                        autocomplete="tel"
                        placeholder="01712345678"
                        formControlName="contactPhone"
                        [class.is-invalid]="invalid('contactPhone')" />
                      @if (invalid('contactPhone')) {
                        <div class="invalid-feedback">A Bangladeshi mobile number, please.</div>
                      } @else {
                        <div class="form-text">We confirm by SMS on this number.</div>
                      }
                    </div>

                    <div class="col-12">
                      <label class="form-label" for="contactEmail">
                        Email <span class="text-muted fw-normal">(optional)</span>
                      </label>
                      <input
                        id="contactEmail"
                        class="form-control"
                        type="email"
                        autocomplete="email"
                        formControlName="contactEmail"
                        [class.is-invalid]="invalid('contactEmail')" />
                    </div>
                  </div>
                </section>

                @if (chosen.mode === 'SiteVisit') {
                  <section class="mb-4" formGroupName="siteAddress">
                    <h2 class="h6 text-uppercase text-muted small mb-2">Where are we coming?</h2>

                    <div class="row g-2">
                      <div class="col-12 col-sm-6">
                        <label class="form-label" for="division">Division</label>
                        <select
                          id="division"
                          class="form-select"
                          formControlName="division"
                          (change)="divisionChanged()">
                          <option value="">Choose…</option>
                          @for (division of divisions; track division.name) {
                            <option [value]="division.name">{{ division.name }}</option>
                          }
                        </select>
                      </div>

                      <div class="col-12 col-sm-6">
                        <label class="form-label" for="district">District</label>
                        <select id="district" class="form-select" formControlName="district">
                          <option value="">Choose…</option>
                          @for (district of districts(); track district) {
                            <option [value]="district">{{ district }}</option>
                          }
                        </select>
                      </div>

                      <div class="col-12 col-sm-6">
                        <label class="form-label" for="area">Area</label>
                        <input
                          id="area"
                          class="form-control"
                          type="text"
                          placeholder="Dhanmondi"
                          formControlName="area" />
                      </div>

                      <div class="col-12 col-sm-6">
                        <label class="form-label" for="landmark">
                          Landmark <span class="text-muted fw-normal">(optional)</span>
                        </label>
                        <input
                          id="landmark"
                          class="form-control"
                          type="text"
                          placeholder="Opposite Popular Diagnostic"
                          formControlName="landmark" />
                      </div>

                      <div class="col-12">
                        <label class="form-label" for="addressLine">House and road</label>
                        <input
                          id="addressLine"
                          class="form-control"
                          type="text"
                          placeholder="House 4, Road 27"
                          formControlName="addressLine"
                          [class.is-invalid]="invalidSite('addressLine')" />
                        @if (invalidSite('addressLine')) {
                          <div class="invalid-feedback">
                            We cannot visit without knowing where.
                          </div>
                        }
                      </div>
                    </div>
                  </section>
                }

                <section class="mb-4">
                  <h2 class="h6 text-uppercase text-muted small mb-2">
                    What is it about?
                    <span class="text-lowercase fw-normal">(all optional)</span>
                  </h2>

                  <label class="form-label" id="rooms-label">Rooms</label>
                  <div class="d-flex flex-wrap gap-2 mb-3 wh-rooms" role="group" aria-labelledby="rooms-label">
                    @for (room of rooms; track room) {
                      <button
                        type="button"
                        class="btn btn-sm"
                        [class]="roomTypes().includes(room) ? 'btn-dark' : 'btn-outline-dark'"
                        [attr.aria-pressed]="roomTypes().includes(room)"
                        (click)="toggleRoom(room)">
                        {{ room }}
                      </button>
                    }
                  </div>

                  <div class="mb-3">
                    <label class="form-label" for="budgetRange">Rough budget</label>
                    <select id="budgetRange" class="form-select" formControlName="budgetRange">
                      <option value="">Rather not say</option>
                      @for (band of budgets; track band) {
                        <option [value]="band">{{ band }}</option>
                      }
                    </select>
                    <div class="form-text">
                      A band, not a figure. It decides what the designer brings, not what you pay.
                    </div>
                  </div>

                  <div>
                    <label class="form-label" for="projectBrief">Anything we should know</label>
                    <textarea
                      id="projectBrief"
                      class="form-control"
                      rows="3"
                      maxlength="2000"
                      placeholder="Two children sharing a bedroom; we would like bunk storage."
                      formControlName="projectBrief"></textarea>
                  </div>
                </section>

                @if (refusal(); as message) {
                  <div class="alert alert-warning small" role="alert">{{ message }}</div>
                }

                <div class="border-top pt-3 d-flex flex-wrap align-items-center gap-3">
                  <button class="btn btn-dark btn-lg" type="submit" [disabled]="busy()">
                    {{ busy() ? 'Booking…' : 'Request this time' }}
                  </button>

                  <p class="small text-muted mb-0">
                    We confirm by SMS. Nothing is charged now
                    @if (chosen.advanceDue) {
                      — the {{ chosen.advanceDue | taka }} deposit is arranged when we confirm.
                    } @else {
                      .
                    }
                  </p>
                </div>
              </form>
            }
          } @else {
            <div class="border rounded p-5 text-center">
              <h1 class="h5 mb-2">We do not offer that consultation</h1>
              <p class="text-muted small mb-3">
                It may have been withdrawn, or the address may be mistyped.
              </p>
              <a class="btn btn-dark" routerLink="/consultation">See what we do offer</a>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class BookingWizard {
  private readonly api = inject(ConsultationApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly media = inject(MediaUrlService);
  private readonly seo = inject(SeoService);
  private readonly account = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);

  /** A fortnight at a time, and no further than the API will compute. */
  private static readonly WindowDays = 14;
  protected readonly maxWindowStart = 42;

  protected readonly divisions = DIVISIONS;
  protected readonly budgets = BUDGET_RANGES;
  protected readonly rooms = ROOM_TYPES;

  protected readonly service = signal<ConsultationService | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingSlots = signal(false);
  protected readonly busy = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected readonly consultantId = signal<number | null>(null);
  protected readonly windowStart = signal(0);
  protected readonly days = signal<AvailabilityDay[]>([]);
  protected readonly selectedDate = signal<string | null>(null);
  protected readonly startUtc = signal<string | null>(null);
  protected readonly roomTypes = signal<string[]>([]);

  protected readonly slotsForDay = computed(
    () => this.days().find(day => day.date === this.selectedDate())?.slots ?? []
  );

  protected readonly chosenSlot = computed(
    () => this.slotsForDay().find(slot => slot.startUtc === this.startUtc()) ?? null
  );

  protected readonly districts = computed(() => districtsOf(this.division()));

  private readonly division = signal<string>('');

  /**
   * One key per visit to this page, not per press.
   *
   * That is the whole point: a double tap on a slow connection sends the same
   * key twice, and the API answers the second with the booking it already
   * made rather than blocking a second afternoon.
   */
  private readonly idempotencyKey = newKey();

  protected readonly form = this.formBuilder.nonNullable.group({
    contactName: ['', [Validators.required, Validators.maxLength(120)]],
    contactPhone: ['', [Validators.required, Validators.maxLength(20)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(256)]],
    budgetRange: [''],
    projectBrief: ['', Validators.maxLength(2000)],
    siteAddress: this.formBuilder.nonNullable.group({
      division: [''],
      district: [''],
      area: [''],
      addressLine: [''],
      landmark: ['']
    })
  });

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';

    // Somebody signed in has told us this once already.
    //
    // An effect rather than a read, because the session is restored from a
    // cookie after the page has rendered: reading once in the constructor
    // fills nothing for anybody who arrived by opening the URL. It only ever
    // fills an empty, untouched box, so somebody booking on behalf of their
    // mother is not overwritten a second later.
    effect(() => {
      const user = this.account.user();

      if (!user) {
        return;
      }

      const name = this.form.controls.contactName;
      const phone = this.form.controls.contactPhone;

      if (!name.dirty && !name.value) {
        name.setValue(user.fullName ?? '');
      }

      if (!phone.dirty && !phone.value) {
        phone.setValue(user.phoneNumber ?? '');
      }
    });

    this.api.getService(slug).subscribe({
      next: service => {
        this.service.set(service);
        this.loading.set(false);

        if (!service) {
          this.seo.apply({
            title: 'Consultation not found',
            canonicalPath: `/consultation/${slug}`,
            noIndex: true
          });

          return;
        }

        this.seo.apply({
          title: service.name,
          description: service.description ?? `Book a ${service.name} with WoodHeart.`,
          canonicalPath: `/consultation/${service.slug}`
        });

        // A site visit cannot be booked without an address, and the API
        // refuses one that is missing. Asking here means the customer finds
        // out before they have chosen a time.
        if (service.mode === 'SiteVisit') {
          const site = this.form.controls.siteAddress;

          site.controls.division.addValidators(Validators.required);
          site.controls.district.addValidators(Validators.required);
          site.controls.addressLine.addValidators(Validators.required);
          site.updateValueAndValidity();
        }

        this.loadSlots();
      },
      error: () => this.loading.set(false)
    });
  }

  protected modeLabel(service: ConsultationService): string {
    return MODE_LABELS[service.mode] ?? service.mode;
  }

  protected photo(path: string | null | undefined): string | null {
    return this.media.image(path, { width: 40, height: 40, fit: 'fill' });
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected invalidSite(control: string): boolean {
    const field = this.form.controls.siteAddress.get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected divisionChanged(): void {
    this.division.set(this.form.controls.siteAddress.controls.division.value);
    this.form.controls.siteAddress.controls.district.setValue('');
  }

  protected chooseConsultant(id: number | null): void {
    this.consultantId.set(id);
    this.loadSlots();
  }

  protected shiftWindow(direction: number): void {
    this.windowStart.update(start =>
      Math.min(this.maxWindowStart, Math.max(0, start + direction * BookingWizard.WindowDays))
    );

    this.loadSlots();
  }

  protected chooseDay(date: string): void {
    this.selectedDate.set(date);
    this.startUtc.set(null);
  }

  protected chooseSlot(slot: AvailabilitySlot): void {
    // Sent back untouched. The page never builds a time of its own, so the
    // server's re-check is a real check rather than a formality.
    this.startUtc.set(slot.startUtc);
    this.refusal.set(null);
  }

  protected toggleRoom(room: string): void {
    this.roomTypes.update(rooms =>
      rooms.includes(room) ? rooms.filter(one => one !== room) : [...rooms, room]
    );
  }

  protected submit(): void {
    const service = this.service();
    const startUtc = this.startUtc();

    if (!service || !startUtc) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const site = value.siteAddress;

    this.busy.set(true);
    this.refusal.set(null);

    this.api
      .book(
        {
          serviceId: service.id,
          consultantId: this.chosenSlot()?.consultantId ?? this.consultantId(),
          startUtc,
          contactName: value.contactName.trim(),
          contactPhone: value.contactPhone.trim(),
          contactEmail: value.contactEmail.trim() || null,
          siteAddress:
            service.mode === 'SiteVisit'
              ? {
                  division: site.division,
                  district: site.district,
                  area: site.area.trim() || null,
                  addressLine: site.addressLine.trim(),
                  landmark: site.landmark.trim() || null
                }
              : null,
          projectBrief: value.projectBrief.trim() || null,
          budgetRange: value.budgetRange || null,
          roomTypes: this.roomTypes()
        },
        this.idempotencyKey
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.busy.set(false);

          if (response.isSuccess && response.data) {
            // Through router state rather than the URL: the confirmation page
            // needs the phone number to read the booking back, and a phone
            // number in a URL ends up in history, in a proxy log and in a
            // referrer header.
            this.router.navigate(['/consultation/bookings', response.data.bookingNumber], {
              state: { booking: response.data }
            });

            return;
          }

          this.refusal.set(response.message || 'We could not book that time.');

          // The slot went while the form was being filled in. Redrawing the
          // calendar is more use than the sentence saying so.
          if (response.errorCode?.includes('slot_')) {
            this.startUtc.set(null);
            this.loadSlots();
          }
        },
        error: () => {
          this.busy.set(false);
          this.refusal.set('We could not reach the shop. Please try again.');
        }
      });
  }

  private loadSlots(): void {
    const service = this.service();

    if (!service) {
      return;
    }

    this.loadingSlots.set(true);

    const from = dhakaToday(this.windowStart());
    const to = dhakaToday(this.windowStart() + BookingWizard.WindowDays - 1);

    this.api
      .getAvailability(service.id, from, to, this.consultantId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: availability => {
          this.days.set(availability.days);
          this.loadingSlots.set(false);

          // Land on the first day that has anything, so the commonest case —
          // "the soonest you can" — takes no clicks at all.
          const still = availability.days.some(day => day.date === this.selectedDate());

          if (!still) {
            this.selectedDate.set(availability.days[0]?.date ?? null);
            this.startUtc.set(null);
          }
        },
        error: () => this.loadingSlots.set(false)
      });
  }
}

/**
 * One key for one visit to the page.
 *
 * Guarded because this component is server-rendered, and `crypto.randomUUID`
 * is not on every runtime that renders it.
 */
function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * A Dhaka date, so many days from today, as `YYYY-MM-DD`.
 *
 * Built by shifting the instant into +06:00 and reading the date off it,
 * rather than by asking the browser for its own today. A customer in London
 * asking for "today" at nine in the evening would otherwise be shown a
 * calendar starting on a day that, in Dhaka, is already over.
 */
function dhakaToday(offsetDays: number): string {
  const dhaka = new Date(Date.now() + 6 * 60 * 60 * 1000 + offsetDays * 86_400_000);

  return dhaka.toISOString().slice(0, 10);
}
