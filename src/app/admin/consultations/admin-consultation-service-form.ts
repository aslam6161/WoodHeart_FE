import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminConsultationService } from '../../_services/admin/admin-consultation.service';
import { ToastService } from '../../_services/toast.service';
import { HasUnsavedChanges } from '../../_guards/auth.guard';
import { ADMIN_MODE_LABELS } from '../../_models/admin-consultations';
import { ConsultationMode } from '../../_models/consultations';

/**
 * One consultation the shop sells: what it is, how long, what it costs, and
 * how much air to leave round it.
 *
 * <b>The buffers are the part worth explaining.</b> They are quiet time either
 * side of every appointment of this kind — travel to a site visit, or clearing
 * the studio between two customers — and they come off the calendar without
 * appearing on it. Fifteen minutes of buffer on an hour-long studio visit
 * means the half hours touching a booking cannot be sold, which is usually
 * what somebody means by "do not book me back to back".
 *
 * <b>A deposit is recorded, not taken.</b> Charging it needs a gateway, which
 * is Phase 5. Setting it now means the shop can already see what it meant to
 * ask for, and a year of bookings will not have to be reinterpreted later.
 */
@Component({
  selector: 'app-admin-consultation-service-form',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/consultations/services">
      &lsaquo; What we offer
    </a>

    <h1 class="h4 mt-2 mb-3">{{ isNew() ? 'Add a consultation' : 'Edit consultation' }}</h1>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      <form class="row g-3" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="col-12 col-lg-7">
          <div class="border rounded p-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">What it is</h2>

            <div class="mb-3">
              <label class="form-label" for="nameEn">Name</label>
              <input
                id="nameEn"
                class="form-control"
                type="text"
                formControlName="nameEn"
                [class.is-invalid]="invalid('nameEn')" />
              @if (invalid('nameEn')) {
                <div class="invalid-feedback">A name, please — the customer reads it.</div>
              }
            </div>

            <div class="mb-3">
              <label class="form-label" for="nameBn">
                Name in Bangla <span class="text-muted fw-normal">(optional)</span>
              </label>
              <input id="nameBn" class="form-control" type="text" formControlName="nameBn" />
            </div>

            <div class="mb-3">
              <label class="form-label" for="descriptionEn">Description</label>
              <textarea
                id="descriptionEn"
                class="form-control"
                rows="3"
                maxlength="2000"
                formControlName="descriptionEn"></textarea>
              <div class="form-text">
                What the customer gets for the hour. This is the only copy on the booking page.
              </div>
            </div>

            <div class="mb-0">
              <label class="form-label" for="slug">
                Address <span class="text-muted fw-normal">(optional)</span>
              </label>
              <div class="input-group">
                <span class="input-group-text font-monospace">/consultation/</span>
                <input id="slug" class="form-control font-monospace" type="text" formControlName="slug" />
              </div>
              <div class="form-text">
                Left empty, it is made from the name. Changing it later breaks any link
                already shared.
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">How it runs</h2>

            <div class="mb-3">
              <label class="form-label" for="mode">Kind</label>
              <select id="mode" class="form-select" formControlName="mode">
                @for (option of modes; track option) {
                  <option [value]="option">{{ modeLabel(option) }}</option>
                }
              </select>
              @if (form.controls.mode.value === 'SiteVisit') {
                <div class="form-text">
                  A site visit asks the customer for an address, and will not be booked
                  without one.
                </div>
              }
            </div>

            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label" for="durationMinutes">Length (minutes)</label>
                <input
                  id="durationMinutes"
                  class="form-control"
                  type="number"
                  min="5"
                  max="600"
                  formControlName="durationMinutes"
                  [class.is-invalid]="invalid('durationMinutes')" />
              </div>
              <div class="col-6">
                <label class="form-label" for="sortOrder">Order on the page</label>
                <input id="sortOrder" class="form-control" type="number" min="0" formControlName="sortOrder" />
              </div>
            </div>

            <div class="row g-2 mb-1">
              <div class="col-6">
                <label class="form-label" for="bufferBeforeMinutes">Quiet before</label>
                <input
                  id="bufferBeforeMinutes"
                  class="form-control"
                  type="number"
                  min="0"
                  max="480"
                  formControlName="bufferBeforeMinutes" />
              </div>
              <div class="col-6">
                <label class="form-label" for="bufferAfterMinutes">Quiet after</label>
                <input
                  id="bufferAfterMinutes"
                  class="form-control"
                  type="number"
                  min="0"
                  max="480"
                  formControlName="bufferAfterMinutes" />
              </div>
            </div>
            <div class="form-text">
              Minutes kept free either side — travel, or clearing the room. It never appears
              on the calendar; it removes the times that would collide with it.
            </div>
          </div>

          <div class="border rounded p-3 mb-3">
            <h2 class="h6 text-uppercase text-muted small mb-3">What it costs</h2>

            <div class="mb-3">
              <label class="form-label" for="fee">Fee (৳)</label>
              <input
                id="fee"
                class="form-control"
                type="number"
                min="0"
                step="1"
                formControlName="fee" />
              <div class="form-text">Zero is a free consultation, and reads as "Free".</div>
            </div>

            <div class="form-check mb-2">
              <input
                id="requiresAdvance"
                class="form-check-input"
                type="checkbox"
                formControlName="requiresAdvance" />
              <label class="form-check-label" for="requiresAdvance">Ask for a deposit</label>
            </div>

            @if (form.controls.requiresAdvance.value) {
              <label class="form-label" for="advanceAmount">Deposit (৳)</label>
              <input
                id="advanceAmount"
                class="form-control"
                type="number"
                min="0"
                formControlName="advanceAmount" />
              <div class="form-text">
                Left empty, the whole fee is asked for. Recorded but not charged — taking it
                needs a payment gateway.
              </div>
            }
          </div>

          <div class="border rounded p-3 mb-3">
            <div class="form-check form-switch">
              <input
                id="isActive"
                class="form-check-input"
                type="checkbox"
                role="switch"
                formControlName="isActive" />
              <label class="form-check-label" for="isActive">Live on the storefront</label>
            </div>
            <div class="form-text">
              Switched off, it leaves the booking page and keeps every booking already made
              against it.
            </div>
          </div>

          <div class="d-flex gap-2">
            <button class="btn btn-dark" type="submit" [disabled]="busy()">
              {{ busy() ? 'Saving…' : 'Save' }}
            </button>
            <a class="btn btn-outline-secondary" routerLink="/admin/consultations/services">
              Cancel
            </a>
          </div>
        </div>
      </form>
    }
  `
})
export class AdminConsultationServiceForm implements HasUnsavedChanges {
  private readonly api = inject(AdminConsultationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly modes: readonly ConsultationMode[] = ['Online', 'InStudio', 'SiteVisit'];

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly id = signal<number | null>(null);

  protected readonly isNew = computed(() => this.id() === null);

  protected readonly form = this.formBuilder.nonNullable.group({
    nameEn: ['', [Validators.required, Validators.maxLength(160)]],
    nameBn: ['', Validators.maxLength(160)],
    slug: ['', Validators.maxLength(160)],
    descriptionEn: ['', Validators.maxLength(2000)],
    mode: ['InStudio' as ConsultationMode],
    durationMinutes: [60, [Validators.required, Validators.min(5), Validators.max(600)]],
    fee: [0, [Validators.required, Validators.min(0)]],
    requiresAdvance: [false],
    advanceAmount: [null as number | null],
    bufferBeforeMinutes: [0, [Validators.min(0), Validators.max(480)]],
    bufferAfterMinutes: [0, [Validators.min(0), Validators.max(480)]],
    isActive: [true],
    sortOrder: [0, Validators.min(0)]
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      return;
    }

    this.id.set(Number(id));
    this.loading.set(true);

    // There is no "get one service" endpoint on the admin side, because the
    // list is small and always wanted whole — the form picks its own row out
    // of it rather than the API growing a route for one screen.
    this.api.getServices().subscribe({
      next: services => {
        const service = services.find(one => one.id === this.id());

        this.loading.set(false);

        if (!service) {
          this.toast.error('That consultation no longer exists.');
          this.router.navigateByUrl('/admin/consultations/services');

          return;
        }

        this.form.patchValue({
          nameEn: service.name,
          slug: service.slug,
          descriptionEn: service.description ?? '',
          mode: service.mode,
          durationMinutes: service.durationMinutes,
          fee: service.fee,
          requiresAdvance: service.requiresAdvance,
          advanceAmount: service.requiresAdvance ? (service.advanceDue ?? null) : null,
          isActive: service.isActive,
          sortOrder: service.sortOrder
        });

        this.form.markAsPristine();
      },
      error: () => this.loading.set(false)
    });
  }

  /** Asked by the router guard before it lets a half-typed form be abandoned. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.busy();
  }

  protected modeLabel(mode: ConsultationMode): string {
    return ADMIN_MODE_LABELS[mode] ?? mode;
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const dto = {
      nameEn: value.nameEn.trim(),
      nameBn: value.nameBn.trim() || null,
      slug: value.slug.trim() || null,
      descriptionEn: value.descriptionEn.trim() || null,
      mode: value.mode,
      durationMinutes: value.durationMinutes,
      fee: value.fee,
      requiresAdvance: value.requiresAdvance,

      // Sent only when a deposit is actually asked for: a leftover figure in a
      // hidden box would otherwise be saved against a service that is not
      // taking one.
      advanceAmount: value.requiresAdvance ? value.advanceAmount : null,
      bufferBeforeMinutes: value.bufferBeforeMinutes,
      bufferAfterMinutes: value.bufferAfterMinutes,
      isActive: value.isActive,
      sortOrder: value.sortOrder
    };

    // Captured before the request: applying the answer sets the id, and a
    // redirect decided afterwards would never fire — so a refresh would make a
    // second consultation.
    const creating = this.isNew();

    this.busy.set(true);

    const request = creating
      ? this.api.createService(dto)
      : this.api.updateService(this.id()!, dto);

    request.subscribe({
      next: response => {
        this.busy.set(false);

        if (!response.isSuccess || !response.data) {
          this.toast.error(response.message || 'That could not be saved.');
          return;
        }

        this.form.markAsPristine();
        this.toast.success(creating ? 'Consultation added.' : 'Consultation saved.');

        if (creating) {
          this.router.navigateByUrl('/admin/consultations/services');
        }
      },
      error: () => this.busy.set(false)
    });
  }
}
