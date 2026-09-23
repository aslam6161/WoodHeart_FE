import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminPaymentMethodService } from '../../_services/admin/admin-payment-method.service';
import { ToastService } from '../../_services/toast.service';
import { HasUnsavedChanges } from '../../_guards/auth.guard';
import {
  PaymentChargeType,
  PaymentMethodConfig,
  PaymentMode,
  UpdatePaymentMethod
} from '../../_models/payment-methods';

/**
 * Configuring one payment method.
 *
 * <b>The credential is write-only in both directions, and the form is shaped
 * around that.</b> This screen was never given the secret, so it has nothing
 * to redisplay and nothing to send back — which means a blank box must mean
 * "leave it alone", not "clear it". Clearing is its own deliberate tick, and
 * replacing is its own deliberate reveal. A form that posted its empty field
 * on every save would wipe a merchant key the first time somebody corrected a
 * spelling.
 *
 * <b>What cannot be switched on is said rather than hidden.</b> A method
 * nothing implements is shown with the reason and its switch disabled, because
 * the row exists precisely so that the day the code is written is a toggle
 * rather than a release — and hiding it would make that day a mystery.
 *
 * <b>Sandbox and live are one control and it is prominent.</b> They look
 * identical from the shop's side right up to the moment somebody's money
 * should have moved and did not.
 */
@Component({
  selector: 'app-admin-payment-method-form',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/payment-methods">
      &lsaquo; All payment methods
    </a>

    @if (loading()) {
      <p class="text-muted small mt-3">Loading…</p>
    } @else if (method(); as config) {
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mb-3">
        <h1 class="h4 mb-0">{{ config.displayNameEn }}</h1>
        <span class="badge text-bg-light font-monospace fw-normal">{{ config.code }}</span>
      </div>

      @if (!config.isImplemented) {
        <div class="alert alert-secondary" role="note">
          <strong>Nothing can take money this way yet.</strong> The settings below can be
          prepared, but the method cannot be switched on until the code that serves it is
          written. That is the point of it being here: the day it is built, this is a
          toggle rather than a release.
        </div>
      }

      @if (refusal(); as message) {
        <div class="alert alert-warning" role="alert">{{ message }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row g-3">
          <div class="col-12 col-xl-7">
            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">What the customer sees</h2>

              <div class="row g-2">
                <div class="col-12 col-md-6">
                  <label class="form-label small" for="displayNameEn">Name</label>
                  <input
                    id="displayNameEn"
                    class="form-control form-control-sm"
                    type="text"
                    formControlName="displayNameEn"
                    [class.is-invalid]="invalid('displayNameEn')" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="displayNameBn">Name in Bangla</label>
                  <input
                    id="displayNameBn"
                    class="form-control form-control-sm"
                    type="text"
                    formControlName="displayNameBn" />
                </div>

                <div class="col-12">
                  <label class="form-label small" for="descriptionEn">Description</label>
                  <input
                    id="descriptionEn"
                    class="form-control form-control-sm"
                    type="text"
                    placeholder="One line, as the customer reads it at checkout"
                    formControlName="descriptionEn" />
                </div>

                <div class="col-12">
                  <label class="form-label small" for="descriptionBn">
                    Description in Bangla
                  </label>
                  <input
                    id="descriptionBn"
                    class="form-control form-control-sm"
                    type="text"
                    formControlName="descriptionBn" />
                </div>

                <div class="col-12 col-md-8">
                  <label class="form-label small" for="iconUrl">Icon URL</label>
                  <input
                    id="iconUrl"
                    class="form-control form-control-sm"
                    type="text"
                    formControlName="iconUrl" />
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label small" for="sortOrder">Order at checkout</label>
                  <input
                    id="sortOrder"
                    class="form-control form-control-sm"
                    type="number"
                    min="0"
                    formControlName="sortOrder" />
                  <div class="form-text">Lowest first.</div>
                </div>
              </div>
            </div>

            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">When it is offered</h2>

              <div class="form-check form-switch mb-2">
                <input
                  id="availableInsideDhaka"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  formControlName="availableInsideDhaka" />
                <label class="form-check-label small" for="availableInsideDhaka">
                  Inside Dhaka
                </label>
              </div>

              <div class="form-check form-switch mb-3">
                <input
                  id="availableOutsideDhaka"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  formControlName="availableOutsideDhaka" />
                <label class="form-check-label small" for="availableOutsideDhaka">
                  Outside Dhaka
                </label>
              </div>

              <div class="row g-2">
                <div class="col-12 col-md-6">
                  <label class="form-label small" for="minOrderAmount">
                    Smallest order (৳)
                  </label>
                  <input
                    id="minOrderAmount"
                    class="form-control form-control-sm"
                    type="number"
                    min="0"
                    placeholder="no floor"
                    formControlName="minOrderAmount" />
                  <div class="form-text">
                    A gateway's fixed fee makes small orders unprofitable to take
                    electronically.
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="maxOrderAmount">
                    Largest order (৳)
                  </label>
                  <input
                    id="maxOrderAmount"
                    class="form-control form-control-sm"
                    type="number"
                    min="0"
                    placeholder="no ceiling"
                    formControlName="maxOrderAmount" />
                  <!-- The one field on this screen that is about somebody's
                       safety rather than the shop's margin. -->
                  <div class="form-text">
                    Above this the method is not offered. For cash on delivery this is
                    how the shop says it will not send a rider out to collect two lakh
                    in notes.
                  </div>
                </div>
              </div>
            </div>

            <div class="border rounded p-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">What it costs the customer</h2>

              <div class="row g-2">
                <div class="col-12 col-md-6">
                  <label class="form-label small" for="chargeType">Charge</label>
                  <select
                    id="chargeType"
                    class="form-select form-select-sm"
                    formControlName="chargeType">
                    <option value="None">No charge</option>
                    <option value="Fixed">A flat amount</option>
                    <option value="Percent">A percentage of the order</option>
                  </select>
                </div>

                @if (form.controls.chargeType.value !== 'None') {
                  <div class="col-12 col-md-6">
                    <label class="form-label small" for="chargeValue">
                      {{ form.controls.chargeType.value === 'Percent' ? 'Percent' : 'Amount (৳)' }}
                    </label>
                    <input
                      id="chargeValue"
                      class="form-control form-control-sm"
                      type="number"
                      min="0"
                      formControlName="chargeValue" />
                  </div>
                }
              </div>

              <!-- Shown before the choice is made, not after. A charge that
                   appears only on the confirmation is the one customers write
                   reviews about. -->
              <div class="form-text">
                The customer is shown this beside the method at checkout, before they
                choose it.
              </div>
            </div>
          </div>

          <div class="col-12 col-xl-5">
            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">Whether it is on</h2>

              <div class="form-check form-switch mb-2">
                <input
                  id="isEnabled"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  formControlName="isEnabled" />
                <label class="form-check-label" for="isEnabled">
                  Offer this to customers
                </label>
              </div>

              @if (!config.isImplemented) {
                <p class="form-text mb-3">
                  Cannot be switched on until something implements it.
                </p>
              } @else if (config.needsCredentials && !willHaveCredentials()) {
                <!-- Said here rather than discovered on save. The API refuses
                     it either way; being told before the press is kinder. -->
                <p class="form-text text-warning mb-3">
                  This needs merchant credentials before it can be switched on.
                </p>
              }

              <label class="form-label small" for="mode">Pointed at</label>
              <select id="mode" class="form-select form-select-sm" formControlName="mode">
                <option value="Sandbox">The gateway's sandbox</option>
                <option value="Live">Live — real money</option>
              </select>

              @if (form.controls.mode.value === 'Sandbox' && form.controls.isEnabled.value) {
                <div class="alert alert-warning small mt-2 mb-0" role="alert">
                  Switched on and pointed at the sandbox. Customers will be offered this
                  and no real money will move.
                </div>
              }
            </div>

            @if (config.needsCredentials) {
              <div class="border rounded p-3 mb-3">
                <h2 class="h6 text-uppercase text-muted small mb-3">Merchant credentials</h2>

                <p class="small mb-2">
                  @if (config.credentialsUnreadable) {
                    <span class="text-danger">
                      Something is stored but can no longer be read — almost always a key
                      lost with a redeployment. Enter them again.
                    </span>
                  } @else if (config.hasCredentials) {
                    Credentials are stored.
                  } @else {
                    <span class="text-muted">Nothing is stored.</span>
                  }
                </p>

                <!-- Never redisplayed. A screen that shows a live merchant
                     secret is one screenshot away from being a public one. -->
                <p class="form-text">
                  They are encrypted and never shown again, here or anywhere else.
                </p>

                @if (replacing()) {
                  <label class="form-label small" for="credentials">
                    {{ config.hasCredentials ? 'New credentials' : 'Credentials' }}
                  </label>
                  <textarea
                    id="credentials"
                    class="form-control form-control-sm mb-2"
                    rows="4"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder='{"appKey":"…","appSecret":"…"}'
                    formControlName="credentials"></textarea>
                  <button
                    class="btn btn-sm btn-link p-0"
                    type="button"
                    (click)="cancelReplace()">
                    Leave what is stored alone
                  </button>
                } @else {
                  <button
                    class="btn btn-sm btn-outline-dark"
                    type="button"
                    (click)="startReplace()">
                    {{ config.hasCredentials ? 'Replace them' : 'Enter them' }}
                  </button>

                  @if (config.hasCredentials) {
                    <div class="form-check mt-3">
                      <input
                        id="removeCredentials"
                        class="form-check-input"
                        type="checkbox"
                        formControlName="removeCredentials" />
                      <label class="form-check-label small" for="removeCredentials">
                        Remove the stored credentials when I save
                      </label>
                    </div>
                  }
                }
              </div>
            }

            <div class="d-flex gap-2">
              <button class="btn btn-dark" type="submit" [disabled]="saving() || !form.dirty">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
              <a class="btn btn-link" routerLink="/admin/payment-methods">Cancel</a>
            </div>
          </div>
        </div>
      </form>
    } @else {
      <div class="border rounded p-5 text-center text-muted mt-3">
        <p class="mb-0">There is no payment method with that code.</p>
      </div>
    }
  `
})
export class AdminPaymentMethodForm implements HasUnsavedChanges {
  private readonly api = inject(AdminPaymentMethodService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly method = signal<PaymentMethodConfig | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly refusal = signal<string | null>(null);

  /** Whether the secret box is open. Closed means "leave what is stored alone". */
  protected readonly replacing = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    displayNameEn: ['', [Validators.required, Validators.maxLength(80)]],
    displayNameBn: ['', Validators.maxLength(80)],
    descriptionEn: ['', Validators.maxLength(500)],
    descriptionBn: ['', Validators.maxLength(500)],
    iconUrl: ['', Validators.maxLength(500)],
    isEnabled: [false],
    sortOrder: [0, [Validators.min(0), Validators.max(9999)]],
    mode: ['Sandbox' as PaymentMode],
    minOrderAmount: this.formBuilder.control<number | null>(null),
    maxOrderAmount: this.formBuilder.control<number | null>(null),
    availableInsideDhaka: [true],
    availableOutsideDhaka: [true],
    chargeType: ['None' as PaymentChargeType],
    chargeValue: [0, Validators.min(0)],
    credentials: [''],
    removeCredentials: [false]
  });

  /**
   * Whether a credential will exist once this save lands.
   *
   * Not whether one is stored now: an admin pasting the key and ticking the
   * switch in the same breath is the ordinary case, and the warning should
   * clear as they type.
   */
  protected readonly willHaveCredentials = computed(() => {
    const config = this.method();

    if (!config) {
      return false;
    }

    if (this.replacing()) {
      return this.form.controls.credentials.value.trim().length > 0;
    }

    return config.hasCredentials && !this.form.controls.removeCredentials.value;
  });

  private readonly code = this.route.snapshot.paramMap.get('code') ?? '';

  constructor() {
    this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected startReplace(): void {
    this.replacing.set(true);
    this.form.controls.removeCredentials.setValue(false);
  }

  protected cancelReplace(): void {
    this.replacing.set(false);
    this.form.controls.credentials.setValue('');
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);
    this.refusal.set(null);

    this.api.update(this.code, this.toDto()).subscribe({
      next: response => {
        this.saving.set(false);

        if (response.isSuccess && response.data) {
          this.apply(response.data);
          this.toast.success('Saved.');

          return;
        }

        // Every refusal is about something on this screen: nothing implements
        // it, it is offered nowhere, the gateway has no key. The API's own
        // wording says which, and it belongs here rather than in a toast that
        // scrolls away.
        this.refusal.set(response.message || 'That could not be saved.');
      },
      error: () => {
        this.saving.set(false);
        this.refusal.set('We could not reach the shop. Please try again.');
      }
    });
  }

  /**
   * The three states of a credential, decided here and nowhere else.
   *
   * Left out keeps what is stored. An empty string clears it. A value replaces
   * it. The box being blank is the first of those, not the second — which is
   * why clearing has a tick of its own.
   */
  private toDto(): UpdatePaymentMethod {
    const value = this.form.getRawValue();
    const typed = value.credentials.trim();

    const dto: UpdatePaymentMethod = {
      displayNameEn: value.displayNameEn.trim(),
      displayNameBn: value.displayNameBn.trim() || null,
      descriptionEn: value.descriptionEn.trim() || null,
      descriptionBn: value.descriptionBn.trim() || null,
      iconUrl: value.iconUrl.trim() || null,
      isEnabled: value.isEnabled,
      sortOrder: value.sortOrder,
      mode: value.mode,
      minOrderAmount: value.minOrderAmount,
      maxOrderAmount: value.maxOrderAmount,
      availableInsideDhaka: value.availableInsideDhaka,
      availableOutsideDhaka: value.availableOutsideDhaka,
      chargeType: value.chargeType,
      chargeValue: value.chargeType === 'None' ? 0 : value.chargeValue
    };

    if (this.replacing() && typed) {
      dto.credentials = typed;
    } else if (value.removeCredentials) {
      dto.credentials = '';
    }

    return dto;
  }

  private load(): void {
    this.loading.set(true);

    this.api.get(this.code).subscribe({
      next: config => {
        this.loading.set(false);

        if (config) {
          this.apply(config);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  private apply(config: PaymentMethodConfig): void {
    this.method.set(config);

    this.form.patchValue({
      displayNameEn: config.displayNameEn,
      displayNameBn: config.displayNameBn ?? '',
      descriptionEn: config.descriptionEn ?? '',
      descriptionBn: config.descriptionBn ?? '',
      iconUrl: config.iconUrl ?? '',
      isEnabled: config.isEnabled,
      sortOrder: config.sortOrder,
      mode: config.mode,
      minOrderAmount: config.minOrderAmount ?? null,
      maxOrderAmount: config.maxOrderAmount ?? null,
      availableInsideDhaka: config.availableInsideDhaka,
      availableOutsideDhaka: config.availableOutsideDhaka,
      chargeType: config.chargeType,
      chargeValue: config.chargeValue,
      credentials: '',
      removeCredentials: false
    });

    // A method nothing implements can be prepared but not switched on. The API
    // refuses it; disabling the control means nobody has to find that out by
    // pressing save.
    if (config.isImplemented) {
      this.form.controls.isEnabled.enable({ emitEvent: false });
    } else {
      this.form.controls.isEnabled.disable({ emitEvent: false });
    }

    this.replacing.set(false);
    this.form.markAsPristine();
  }
}
