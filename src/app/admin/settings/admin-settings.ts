import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormRecord, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminSettingsService } from '../../_services/admin/admin-settings.service';
import { ToastService } from '../../_services/toast.service';
import { HasUnsavedChanges } from '../../_guards/auth.guard';
import { GeneralResponse } from '../../_models/generalResponse';
import { MULTILINE_SETTINGS, SETTING_LABELS, StoreSetting } from '../../_models/settings';

/**
 * Store settings: the shop's own details, VAT, delivery defaults.
 *
 * <b>The form is built from the table, not the other way round.</b> The API
 * says which settings exist, what type each is and which section it belongs
 * to; the screen renders a control per row from that. A setting the backend
 * adds later appears here without a frontend change, labelled by its key
 * until `SETTING_LABELS` catches up.
 *
 * One Save for the whole screen, all-or-nothing on the API. The VAT rate and
 * "prices include VAT" are one decision, and a save that landed half of it
 * would have the shop charging tax it does not show. A refusal comes back
 * with a message per setting, shown beside its field.
 */
@Component({
  selector: 'app-admin-settings',
  imports: [ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <h1 class="h4 mb-0">Settings</h1>
      @if (!loading()) {
        <button
          class="btn btn-dark"
          type="submit"
          form="settingsForm"
          [disabled]="saving() || !form.dirty">
          {{ saving() ? 'Saving…' : 'Save changes' }}
        </button>
      }
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      <form id="settingsForm" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row g-3">
          @for (section of sections(); track section.name) {
            <div class="col-12 col-xl-6">
              <div class="border rounded p-3 h-100">
                <h2 class="h6 text-uppercase text-muted mb-3">{{ section.name }}</h2>

                @for (setting of section.settings; track setting.key) {
                  <div class="mb-3">
                    @if (setting.valueType === 'Boolean') {
                      <div class="form-check form-switch">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          role="switch"
                          [id]="setting.key"
                          [formControlName]="setting.key"
                          [class.is-invalid]="errorFor(setting.key)" />
                        <label class="form-check-label" [for]="setting.key">{{ label(setting.key) }}</label>
                      </div>
                    } @else {
                      <label class="form-label" [for]="setting.key">{{ label(setting.key) }}</label>
                      @if (multiline(setting.key)) {
                        <textarea
                          class="form-control"
                          rows="3"
                          [id]="setting.key"
                          [formControlName]="setting.key"
                          [class.is-invalid]="errorFor(setting.key)"></textarea>
                      } @else {
                        <input
                          class="form-control"
                          [id]="setting.key"
                          [type]="setting.valueType === 'String' ? 'text' : 'number'"
                          [attr.inputmode]="setting.valueType === 'String' ? null : 'decimal'"
                          [attr.step]="setting.valueType === 'Decimal' ? 'any' : setting.valueType === 'Integer' ? '1' : null"
                          [attr.min]="setting.valueType === 'String' ? null : '0'"
                          [formControlName]="setting.key"
                          [class.is-invalid]="errorFor(setting.key)" />
                      }
                    }

                    @if (errorFor(setting.key); as error) {
                      <div class="invalid-feedback d-block">{{ error }}</div>
                    } @else if (setting.description; as description) {
                      <div class="form-text">{{ description }}</div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </form>

      @if (lastSaved(); as when) {
        <p class="small text-muted mt-3 mb-0">
          Last change {{ when | date: 'd MMM yyyy, h:mm a' }}. Changes apply to the next order placed.
        </p>
      }
    }
  `
})
export class AdminSettings implements HasUnsavedChanges {
  private readonly settingsApi = inject(AdminSettingsService);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  private readonly settings = signal<StoreSetting[]>([]);

  /** Server-side refusals, keyed by setting key. */
  private readonly fieldErrors = signal<Record<string, string[]>>({});

  /** One control per setting, keyed by setting key. Booleans are booleans; everything else a string. */
  protected readonly form: FormRecord<FormControl<string | boolean>> = this.formBuilder.record<
    FormControl<string | boolean>
  >({});

  /** Sections in the API's order, each with its settings in the API's order. */
  protected readonly sections = computed(() => {
    const byName = new Map<string, StoreSetting[]>();

    for (const setting of this.settings()) {
      const list = byName.get(setting.category) ?? [];

      list.push(setting);
      byName.set(setting.category, list);
    }

    return [...byName.entries()].map(([name, settings]) => ({ name, settings }));
  });

  protected readonly lastSaved = computed(() => {
    const stamps = this.settings()
      .map(s => s.updatedAt)
      .filter((s): s is string => !!s)
      .sort();

    return stamps.at(-1) ?? null;
  });

  constructor() {
    this.settingsApi.getAll().subscribe({
      next: settings => {
        this.apply(settings);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  protected label(key: string): string {
    return SETTING_LABELS[key] ?? key;
  }

  protected multiline(key: string): boolean {
    return MULTILINE_SETTINGS.has(key);
  }

  protected errorFor(key: string): string | null {
    return this.fieldErrors()[key]?.[0] ?? null;
  }

  protected save(): void {
    if (!this.form.dirty || this.saving()) {
      return;
    }

    // Only what changed. The API leaves unsent keys alone, and sending the
    // whole table would make every save look like a change to every row.
    const values: Record<string, string> = {};

    for (const [key, control] of Object.entries(this.form.controls)) {
      if (control.dirty) {
        values[key] = String(control.value);
      }
    }

    this.saving.set(true);
    this.fieldErrors.set({});

    this.settingsApi.update({ values }).subscribe({
      next: response => {
        this.saving.set(false);
        this.apply(response.data ?? []);
        this.toast.success(response.message || 'Settings saved.');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);

        const body = error.error as GeneralResponse | undefined;

        // Beside the field, keyed by setting key. The interceptor has already
        // toasted the headline.
        this.fieldErrors.set(body?.errors ?? {});
      }
    });
  }

  /** Rebuilds the controls from the table and marks the form clean. */
  private apply(settings: StoreSetting[]): void {
    for (const key of Object.keys(this.form.controls)) {
      if (!settings.some(s => s.key === key)) {
        this.form.removeControl(key, { emitEvent: false });
      }
    }

    for (const setting of settings) {
      const value: string | boolean =
        setting.valueType === 'Boolean' ? setting.value === 'true' : setting.value;

      const existing = this.form.controls[setting.key];

      if (existing) {
        existing.setValue(value, { emitEvent: false });
      } else {
        this.form.addControl(setting.key, this.formBuilder.control<string | boolean>(value), {
          emitEvent: false
        });
      }
    }

    this.form.markAsPristine();
    this.settings.set(settings);
  }
}
