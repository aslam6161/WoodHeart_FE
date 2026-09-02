import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { ToastService } from '../../_services/toast.service';
import { AdminBrand } from '../../_models/admin-catalog';
import { GeneralResponse } from '../../_models/generalResponse';

/**
 * Brands. Deliberately unremarkable — there is no hierarchy here.
 *
 * The one rule worth showing is that a brand still carrying products cannot be
 * deleted: the foreign key is `SetNull`, so deleting would succeed and quietly
 * strip the brand from every product that had it. The API refuses, and the
 * product count in this table is what makes that refusal predictable.
 */
@Component({
  selector: 'app-admin-brands',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="h4 mb-3">Brands</h1>

    <div class="row g-4">
      <div class="col-12 col-lg-7">
        @if (loading()) {
          <p class="text-muted small">Loading…</p>
        } @else if (brands().length === 0) {
          <div class="border rounded p-5 text-center text-muted">
            <p class="mb-0">No brands yet. A product does not need one.</p>
          </div>
        } @else {
          <div class="table-responsive border rounded">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th scope="col">Brand</th>
                  <th scope="col" class="text-end">Products</th>
                  <th scope="col">Visible</th>
                  <th scope="col"><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (brand of brands(); track brand.id) {
                  <tr [class.table-active]="editingId() === brand.id">
                    <td>
                      {{ brand.nameEn }}
                      <div class="small text-muted font-monospace">/{{ brand.slug }}</div>
                    </td>
                    <td class="text-end">{{ brand.productCount }}</td>
                    <td>
                      @if (brand.isActive) {
                        <span class="badge text-bg-success">Live</span>
                      } @else {
                        <span class="badge text-bg-secondary">Hidden</span>
                      }
                    </td>
                    <td class="text-end text-nowrap">
                      <button class="btn btn-sm btn-outline-secondary" type="button" (click)="edit(brand)">
                        Edit
                      </button>
                      <button
                        class="btn btn-sm btn-outline-danger ms-1"
                        type="button"
                        [disabled]="brand.productCount > 0"
                        [title]="brand.productCount > 0 ? 'Reassign its products first, or hide the brand instead.' : ''"
                        (click)="remove(brand)">
                        Delete
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <div class="col-12 col-lg-5">
        <div class="border rounded p-3">
          <h2 class="h6 text-uppercase text-muted mb-3">
            {{ editingId() ? 'Edit brand' : 'New brand' }}
          </h2>

          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="mb-3">
              <label class="form-label" for="brandNameEn">Name (English)</label>
              <input id="brandNameEn" class="form-control" formControlName="nameEn"
                     [class.is-invalid]="invalid('nameEn')" />
              <div class="invalid-feedback">{{ messageFor('nameEn') }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label" for="brandNameBn">Name (Bangla)</label>
              <input id="brandNameBn" class="form-control" formControlName="nameBn" />
            </div>

            <div class="mb-3">
              <label class="form-label" for="brandSlug">URL slug</label>
              <input id="brandSlug" class="form-control font-monospace" formControlName="slug" />
              <div class="form-text">
                {{ editingId() ? 'Leave empty to keep the current one.' : 'Leave empty to build it from the name.' }}
              </div>
            </div>

            <div class="form-check mb-3">
              <input id="brandIsActive" class="form-check-input" type="checkbox" formControlName="isActive" />
              <label class="form-check-label" for="brandIsActive">Show on the storefront</label>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-dark" type="submit" [disabled]="saving()">
                {{ saving() ? 'Saving…' : editingId() ? 'Save changes' : 'Create brand' }}
              </button>

              @if (editingId()) {
                <button class="btn btn-outline-secondary" type="button" (click)="reset()">Cancel</button>
              }
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class AdminBrands {
  private readonly formBuilder = inject(FormBuilder);
  private readonly catalog = inject(AdminCatalogService);
  private readonly toast = inject(ToastService);

  protected readonly brands = signal<AdminBrand[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  private readonly fieldErrors = signal<Record<string, string[]>>({});

  protected readonly form = this.formBuilder.nonNullable.group({
    nameEn: ['', [Validators.required, Validators.maxLength(200)]],
    nameBn: [''],
    slug: [''],
    isActive: [true]
  });

  constructor() {
    this.load();
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return (!!field?.invalid && (field.touched || field.dirty)) || !!this.fieldErrors()[control];
  }

  protected messageFor(control: string): string {
    return this.fieldErrors()[control]?.[0] ?? 'An English name is required.';
  }

  protected edit(brand: AdminBrand): void {
    this.editingId.set(brand.id);
    this.fieldErrors.set({});

    this.form.patchValue({
      nameEn: brand.nameEn,
      nameBn: brand.nameBn ?? '',
      slug: '',
      isActive: brand.isActive
    });
  }

  protected reset(): void {
    this.editingId.set(null);
    this.fieldErrors.set({});
    this.form.reset({ isActive: true });
  }

  protected save(): void {
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();
    const editing = this.editingId();
    const existing = editing ? this.brands().find(brand => brand.id === editing) : undefined;

    const payload = {
      nameEn: value.nameEn.trim(),
      nameBn: blankToNull(value.nameBn),
      slug: blankToNull(value.slug),
      isActive: value.isActive,
      // Preserved rather than reset. There is no control for it yet, and
      // sending 0 on every save would silently flatten a hand-set order.
      sortOrder: existing?.sortOrder ?? 0
    };

    const request = editing
      ? this.catalog.updateBrand(editing, payload)
      : this.catalog.createBrand(payload);

    request.subscribe({
      next: response => {
        this.saving.set(false);

        if (!response.isSuccess) {
          return;
        }

        this.toast.success(editing ? 'Brand saved.' : 'Brand created.');
        this.reset();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.fieldErrors.set((error.error as GeneralResponse | undefined)?.errors ?? {});
      }
    });
  }

  protected remove(brand: AdminBrand): void {
    if (!confirm(`Delete "${brand.nameEn}"?`)) {
      return;
    }

    this.catalog.deleteBrand(brand.id).subscribe(response => {
      if (response.isSuccess) {
        this.toast.success('Brand deleted.');
        this.reset();
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);

    this.catalog.getBrands().subscribe({
      next: brands => {
        this.brands.set(brands);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}
