import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminConsultationService } from '../../_services/admin/admin-consultation.service';
import { ToastService } from '../../_services/toast.service';
import { HasUnsavedChanges } from '../../_guards/auth.guard';
import {
  AvailabilityException,
  AvailabilityRule,
  DayName,
  WEEK
} from '../../_models/admin-consultations';
import { ConsultationService } from '../../_models/consultations';

/** One row of the week editor. */
interface DayRow {
  day: DayName;
  weekend: boolean;
  working: boolean;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

/**
 * A designer, what they offer, and the week they work.
 *
 * <b>The week is saved whole, and separately from the details.</b> Two writes
 * because the API has two endpoints, and it has two because a week is one
 * decision — the Friday off only makes sense beside the Saturday morning. A
 * partial save is how somebody ends up bookable on a day nobody meant.
 *
 * <b>Friday and Saturday are marked as the weekend, not hidden.</b> Plenty of
 * showrooms in Dhaka do open on a Saturday; what would be wrong is a form that
 * quietly assumed a Monday-to-Friday week and left somebody wondering why
 * their Saturday never appears.
 *
 * <b>Exceptions replace the day rather than trimming it.</b> A closed day is
 * closed whatever the week says; a day with hours on it uses those hours
 * instead of the usual ones. That is how a half day before Eid is written.
 */
@Component({
  selector: 'app-admin-consultant-form',
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/consultations/consultants">
      &lsaquo; Designers
    </a>

    <h1 class="h4 mt-2 mb-3">{{ isNew() ? 'Add a designer' : form.controls.name.value }}</h1>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      <div class="row g-3">
        <div class="col-12 col-lg-5">
          <form class="border rounded p-3" [formGroup]="form" (ngSubmit)="saveDetails()" novalidate>
            <h2 class="h6 text-uppercase text-muted small mb-3">Who they are</h2>

            <div class="mb-3">
              <label class="form-label" for="name">Name</label>
              <input
                id="name"
                class="form-control"
                type="text"
                formControlName="name"
                [class.is-invalid]="invalid('name')" />
              @if (invalid('name')) {
                <div class="invalid-feedback">A name, please — the customer picks by it.</div>
              }
            </div>

            <div class="mb-3">
              <label class="form-label" for="bioEn">About them</label>
              <textarea
                id="bioEn"
                class="form-control"
                rows="3"
                maxlength="2000"
                formControlName="bioEn"></textarea>
            </div>

            <div class="mb-3">
              <label class="form-label" for="specialities">Specialities</label>
              <input
                id="specialities"
                class="form-control"
                type="text"
                placeholder="Small flats, Kitchens"
                formControlName="specialities" />
              <div class="form-text">Separated by commas.</div>
            </div>

            <div class="mb-3">
              <label class="form-label" for="photoPath">
                Photograph <span class="text-muted fw-normal">(optional)</span>
              </label>
              <input id="photoPath" class="form-control" type="text" formControlName="photoPath" />
              <div class="form-text">A Cloudinary id, as on a product.</div>
            </div>

            <div class="mb-3">
              <label class="form-label d-block">What they offer</label>
              @if (services().length === 0) {
                <p class="small text-muted mb-0">
                  Nothing is on offer yet.
                  <a routerLink="/admin/consultations/services">Add a consultation</a> first.
                </p>
              } @else {
                @for (service of services(); track service.id) {
                  <div class="form-check">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      [id]="'service-' + service.id"
                      [checked]="serviceIds().includes(service.id)"
                      (change)="toggleService(service.id)" />
                    <label class="form-check-label" [attr.for]="'service-' + service.id">
                      {{ service.name }}
                      @if (!service.isActive) {
                        <span class="badge text-bg-secondary fw-normal ms-1">off</span>
                      }
                    </label>
                  </div>
                }
                <div class="form-text">
                  Offering nothing means an empty calendar, however the week is written.
                </div>
              }
            </div>

            <div class="form-check form-switch mb-3">
              <input
                id="isActive"
                class="form-check-input"
                type="checkbox"
                role="switch"
                formControlName="isActive" />
              <label class="form-check-label" for="isActive">Taking bookings</label>
            </div>

            <button class="btn btn-dark" type="submit" [disabled]="busy()">
              {{ busy() ? 'Saving…' : isNew() ? 'Add' : 'Save details' }}
            </button>
          </form>
        </div>

        <div class="col-12 col-lg-7">
          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-1">The working week</h2>

            @if (isNew()) {
              <p class="small text-muted mb-0">
                Add the designer first, then their week.
              </p>
            } @else {
              <p class="small text-muted mb-3">
                What the booking page offers. Times are Dhaka's.
              </p>

              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col">Working</th>
                      <th scope="col">From</th>
                      <th scope="col">To</th>
                      <th scope="col">Every</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of week(); track row.day) {
                      <tr [class.table-light]="row.weekend">
                        <td class="text-nowrap">
                          {{ row.day }}
                          @if (row.weekend) {
                            <div class="small text-muted">weekend</div>
                          }
                        </td>
                        <td>
                          <input
                            class="form-check-input"
                            type="checkbox"
                            [attr.aria-label]="'Working on ' + row.day"
                            [checked]="row.working"
                            (change)="toggleDay(row.day)" />
                        </td>
                        <td>
                          <input
                            class="form-control form-control-sm"
                            type="time"
                            [attr.aria-label]="row.day + ' from'"
                            [disabled]="!row.working"
                            [ngModel]="row.startTime"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="setDay(row.day, { startTime: $event })" />
                        </td>
                        <td>
                          <input
                            class="form-control form-control-sm"
                            type="time"
                            [attr.aria-label]="row.day + ' to'"
                            [disabled]="!row.working"
                            [ngModel]="row.endTime"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="setDay(row.day, { endTime: $event })" />
                        </td>
                        <td>
                          <select
                            class="form-select form-select-sm"
                            [attr.aria-label]="row.day + ' every'"
                            [disabled]="!row.working"
                            [ngModel]="row.slotMinutes"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="setDay(row.day, { slotMinutes: +$event })">
                            @for (step of steps; track step) {
                              <option [ngValue]="step">{{ step }} min</option>
                            }
                          </select>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          @if (!isNew()) {
            <div class="border rounded p-3">
              <h2 class="h6 text-uppercase text-muted small mb-1">Days that are different</h2>
              <p class="small text-muted mb-3">
                Holidays and half days. One of these replaces the week for that date rather
                than trimming it.
              </p>

              @for (entry of exceptions(); track entry.date; let i = $index) {
                <div class="row g-2 align-items-end mb-2">
                  <div class="col-6 col-md-3">
                    <label class="form-label small" [attr.for]="'ex-date-' + i">Date</label>
                    <input
                      class="form-control form-control-sm"
                      type="date"
                      [id]="'ex-date-' + i"
                      [ngModel]="entry.date"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="setException(i, { date: $event })" />
                  </div>
                  <div class="col-6 col-md-2">
                    <div class="form-check mt-4">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        [id]="'ex-closed-' + i"
                        [checked]="entry.isClosed"
                        (change)="setException(i, { isClosed: !entry.isClosed })" />
                      <label class="form-check-label small" [attr.for]="'ex-closed-' + i">
                        Closed
                      </label>
                    </div>
                  </div>
                  @if (!entry.isClosed) {
                    <div class="col-6 col-md-2">
                      <label class="form-label small" [attr.for]="'ex-from-' + i">From</label>
                      <input
                        class="form-control form-control-sm"
                        type="time"
                        [id]="'ex-from-' + i"
                        [ngModel]="entry.startTime"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="setException(i, { startTime: $event })" />
                    </div>
                    <div class="col-6 col-md-2">
                      <label class="form-label small" [attr.for]="'ex-to-' + i">To</label>
                      <input
                        class="form-control form-control-sm"
                        type="time"
                        [id]="'ex-to-' + i"
                        [ngModel]="entry.endTime"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="setException(i, { endTime: $event })" />
                    </div>
                  }
                  <div class="col-8 col-md-2">
                    <label class="form-label small" [attr.for]="'ex-note-' + i">Why</label>
                    <input
                      class="form-control form-control-sm"
                      type="text"
                      [id]="'ex-note-' + i"
                      placeholder="Eid"
                      [ngModel]="entry.note"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="setException(i, { note: $event })" />
                  </div>
                  <div class="col-4 col-md-1">
                    <button
                      class="btn btn-sm btn-outline-danger w-100"
                      type="button"
                      [attr.aria-label]="'Remove ' + entry.date"
                      (click)="removeException(i)">
                      &times;
                    </button>
                  </div>
                </div>
              }

              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="addException()">
                Add a day
              </button>

              <hr />

              <div class="d-flex flex-wrap align-items-center gap-2">
                <button
                  class="btn btn-dark"
                  type="button"
                  [disabled]="busy() || !scheduleDirty()"
                  (click)="saveSchedule()">
                  {{ busy() ? 'Saving…' : 'Save the week' }}
                </button>
                @if (scheduleDirty()) {
                  <span class="small text-muted">Unsaved changes to the week.</span>
                }
              </div>
              <div class="form-text">
                Saved whole: whatever is on this screen becomes the week, and anything removed
                from it goes.
              </div>
            </div>
          }
        </div>
      </div>
    }
  `
})
export class AdminConsultantForm implements HasUnsavedChanges {
  private readonly api = inject(AdminConsultationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly steps = [15, 30, 45, 60, 90, 120];

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly id = signal<number | null>(null);
  protected readonly services = signal<ConsultationService[]>([]);
  protected readonly serviceIds = signal<number[]>([]);
  protected readonly week = signal<DayRow[]>(emptyWeek());
  protected readonly exceptions = signal<AvailabilityException[]>([]);
  protected readonly scheduleDirty = signal(false);

  protected readonly isNew = computed(() => this.id() === null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    bioEn: ['', Validators.maxLength(2000)],
    specialities: [''],
    photoPath: ['', Validators.maxLength(512)],
    isActive: [true],
    sortOrder: [0]
  });

  constructor() {
    this.api.getServices().subscribe(services => this.services.set(services));

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      return;
    }

    this.id.set(Number(id));
    this.loading.set(true);

    this.api.getConsultant(Number(id)).subscribe({
      next: person => {
        this.loading.set(false);

        if (!person) {
          this.toast.error('That designer no longer exists.');
          this.router.navigateByUrl('/admin/consultations/consultants');

          return;
        }

        this.apply(person.rules, person.exceptions);

        this.form.patchValue({
          name: person.name,
          bioEn: person.bio ?? '',
          specialities: person.specialities.join(', '),
          photoPath: person.photoPath ?? '',
          isActive: person.isActive,
          sortOrder: person.sortOrder
        });

        this.serviceIds.set([...person.serviceIds]);
        this.form.markAsPristine();
      },
      error: () => this.loading.set(false)
    });
  }

  /**
   * Both halves count.
   *
   * The details and the week are two saves, so a guard that only watched the
   * form would let somebody walk away from an afternoon of typed hours.
   */
  hasUnsavedChanges(): boolean {
    return (this.form.dirty || this.scheduleDirty()) && !this.busy();
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected toggleService(id: number): void {
    this.serviceIds.update(ids =>
      ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id]
    );

    this.form.markAsDirty();
  }

  protected toggleDay(day: DayName): void {
    this.week.update(rows =>
      rows.map(row => (row.day === day ? { ...row, working: !row.working } : row))
    );

    this.scheduleDirty.set(true);
  }

  protected setDay(day: DayName, patch: Partial<DayRow>): void {
    this.week.update(rows => rows.map(row => (row.day === day ? { ...row, ...patch } : row)));
    this.scheduleDirty.set(true);
  }

  protected addException(): void {
    this.exceptions.update(entries => [
      ...entries,
      { date: todayInDhaka(), isClosed: true, startTime: null, endTime: null, note: '' }
    ]);

    this.scheduleDirty.set(true);
  }

  protected setException(index: number, patch: Partial<AvailabilityException>): void {
    this.exceptions.update(entries =>
      entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );

    this.scheduleDirty.set(true);
  }

  protected removeException(index: number): void {
    this.exceptions.update(entries => entries.filter((_, i) => i !== index));
    this.scheduleDirty.set(true);
  }

  protected saveDetails(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const dto = {
      name: value.name.trim(),
      bioEn: value.bioEn.trim() || null,
      photoPath: value.photoPath.trim() || null,
      specialities: value.specialities
        .split(',')
        .map(one => one.trim())
        .filter(one => one.length > 0),
      serviceIds: this.serviceIds(),
      isActive: value.isActive,
      sortOrder: value.sortOrder
    };

    const creating = this.isNew();

    this.busy.set(true);

    const request = creating
      ? this.api.createConsultant(dto)
      : this.api.updateConsultant(this.id()!, dto);

    request.subscribe({
      next: response => {
        this.busy.set(false);

        if (!response.isSuccess || !response.data) {
          this.toast.error(response.message || 'That could not be saved.');
          return;
        }

        this.form.markAsPristine();
        this.toast.success(creating ? 'Designer added.' : 'Details saved.');

        if (creating) {
          // Straight to their own page, because the week is the half that
          // actually makes them bookable and it cannot be written until they
          // exist.
          this.router.navigate(['/admin/consultations/consultants', response.data.id]);
        }
      },
      error: () => this.busy.set(false)
    });
  }

  protected saveSchedule(): void {
    const rules: AvailabilityRule[] = this.week()
      .filter(row => row.working)
      .map(row => ({
        dayOfWeek: row.day,
        startTime: withSeconds(row.startTime),
        endTime: withSeconds(row.endTime),
        slotMinutes: row.slotMinutes
      }));

    const bad = this.week().find(row => row.working && row.endTime <= row.startTime);

    if (bad) {
      // The API refuses this too. Saying so here saves a round trip and points
      // at the row rather than at the week.
      this.toast.error(`${bad.day} ends before it starts.`);
      return;
    }

    const exceptions = this.exceptions().map(entry => ({
      date: entry.date,
      isClosed: entry.isClosed,
      startTime: entry.isClosed ? null : withSeconds(entry.startTime ?? '10:00'),
      endTime: entry.isClosed ? null : withSeconds(entry.endTime ?? '17:00'),
      note: entry.note?.trim() || null
    }));

    this.busy.set(true);

    this.api.saveSchedule(this.id()!, { rules, exceptions }).subscribe({
      next: response => {
        this.busy.set(false);

        if (!response.isSuccess || !response.data) {
          this.toast.error(response.message || 'The week could not be saved.');
          return;
        }

        // Re-read rather than trusted: the API normalises what it stores, and
        // a screen that kept its own version would quietly disagree with the
        // calendar customers are being shown.
        this.apply(response.data.rules, response.data.exceptions);
        this.scheduleDirty.set(false);
        this.toast.success('The week is saved.');
      },
      error: () => this.busy.set(false)
    });
  }

  private apply(rules: AvailabilityRule[], exceptions: AvailabilityException[]): void {
    const byDay = new Map(rules.map(rule => [rule.dayOfWeek, rule]));

    this.week.set(
      WEEK.map(({ day, weekend }) => {
        const rule = byDay.get(day);

        return {
          day,
          weekend,
          working: !!rule,
          startTime: rule ? rule.startTime.slice(0, 5) : '10:00',
          endTime: rule ? rule.endTime.slice(0, 5) : '17:00',
          slotMinutes: rule?.slotMinutes ?? 30
        };
      })
    );

    this.exceptions.set(
      exceptions.map(entry => ({
        ...entry,
        startTime: entry.startTime?.slice(0, 5) ?? null,
        endTime: entry.endTime?.slice(0, 5) ?? null
      }))
    );
  }
}

function emptyWeek(): DayRow[] {
  return WEEK.map(({ day, weekend }) => ({
    day,
    weekend,
    working: false,
    startTime: '10:00',
    endTime: '17:00',
    slotMinutes: 30
  }));
}

/** `10:00` from an `<input type="time">` is `10:00:00` to the API. */
function withSeconds(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

/** Today in Dhaka, for a new exception row. */
function todayInDhaka(): string {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
