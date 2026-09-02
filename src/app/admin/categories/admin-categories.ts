import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { ToastService } from '../../_services/toast.service';
import { AdminCategoryTree } from '../../_models/admin-catalog';
import { GeneralResponse } from '../../_models/generalResponse';

/** One row of the flattened tree, carrying the depth it should be indented to. */
interface Row {
  category: AdminCategoryTree;
  depth: number;
}

/**
 * The category tree, with an editor beside it.
 *
 * <b>Renaming and moving are separate actions, following the API.</b> A move
 * rewrites the materialized path of every descendant and has to be checked for
 * cycles; folding it into the save would make every typo correction pay that
 * cost and let anyone trigger it by accident.
 */
@Component({
  selector: 'app-admin-categories',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="h4 mb-3">Categories</h1>

    <div class="row g-4">
      <div class="col-12 col-lg-7">
        @if (loading()) {
          <p class="text-muted small">Loading…</p>
        } @else if (rows().length === 0) {
          <div class="border rounded p-5 text-center text-muted">
            <p class="mb-0">No categories yet. Create the first one on the right.</p>
          </div>
        } @else {
          <div class="table-responsive border rounded">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" class="text-end">Products</th>
                  <th scope="col">Visible</th>
                  <th scope="col"><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.category.id) {
                  <tr [class.table-active]="editingId() === row.category.id">
                    <td>
                      <span [style.padding-left.rem]="row.depth * 1.25">
                        {{ row.category.nameEn }}
                      </span>
                      <div class="small text-muted font-monospace"
                           [style.padding-left.rem]="row.depth * 1.25">
                        /{{ row.category.slug }}
                      </div>
                    </td>

                    <td class="text-end">{{ row.category.productCount }}</td>

                    <td>
                      @if (row.category.isActive) {
                        <span class="badge text-bg-success">Live</span>
                      } @else {
                        <span class="badge text-bg-secondary">Hidden</span>
                      }
                    </td>

                    <td class="text-end text-nowrap">
                      <button class="btn btn-sm btn-outline-secondary" type="button"
                              (click)="edit(row.category)">
                        Edit
                      </button>
                      <button class="btn btn-sm btn-outline-danger ms-1" type="button"
                              (click)="remove(row.category)">
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
            {{ editingId() ? 'Edit category' : 'New category' }}
          </h2>

          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="mb-3">
              <label class="form-label" for="nameEn">Name (English)</label>
              <input id="nameEn" class="form-control" formControlName="nameEn"
                     [class.is-invalid]="invalid('nameEn')" />
              <div class="invalid-feedback">{{ messageFor('nameEn') }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label" for="nameBn">Name (Bangla)</label>
              <input id="nameBn" class="form-control" formControlName="nameBn" />
            </div>

            <div class="mb-3">
              <label class="form-label" for="slug">URL slug</label>
              <input id="slug" class="form-control font-monospace" formControlName="slug" />
              <div class="form-text">
                {{ editingId() ? 'Leave empty to keep the current one.' : 'Leave empty to build it from the name.' }}
              </div>
            </div>

            @if (!editingId()) {
              <!-- Only on create. Moving an existing category is a different
                   operation with different consequences, and it does not belong
                   on a rename form. -->
              <div class="mb-3">
                <label class="form-label" for="parentId">Parent</label>
                <select id="parentId" class="form-select" formControlName="parentId">
                  <option [ngValue]="null">Top level</option>
                  @for (row of rows(); track row.category.id) {
                    <option [ngValue]="row.category.id">
                      {{ '— '.repeat(row.depth) }}{{ row.category.nameEn }}
                    </option>
                  }
                </select>
              </div>
            }

            <div class="mb-3">
              <label class="form-label" for="descriptionEn">Description</label>
              <textarea id="descriptionEn" class="form-control" rows="3"
                        formControlName="descriptionEn"></textarea>
            </div>

            <div class="form-check mb-2">
              <input id="isActive" class="form-check-input" type="checkbox" formControlName="isActive" />
              <label class="form-check-label" for="isActive">Show on the storefront</label>
            </div>

            <div class="form-check mb-3">
              <input id="isFeatured" class="form-check-input" type="checkbox" formControlName="isFeatured" />
              <label class="form-check-label" for="isFeatured">Feature on the home page</label>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-dark" type="submit" [disabled]="saving()">
                {{ saving() ? 'Saving…' : editingId() ? 'Save changes' : 'Create category' }}
              </button>

              @if (editingId()) {
                <button class="btn btn-outline-secondary" type="button" (click)="reset()">
                  Cancel
                </button>
              }
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class AdminCategories {
  private readonly formBuilder = inject(FormBuilder);
  private readonly catalog = inject(AdminCatalogService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  private readonly fieldErrors = signal<Record<string, string[]>>({});

  protected readonly form = this.formBuilder.nonNullable.group({
    nameEn: ['', [Validators.required, Validators.maxLength(200)]],
    nameBn: [''],
    slug: [''],
    parentId: [null as number | null],
    descriptionEn: [''],
    isActive: [true],
    isFeatured: [false]
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

  protected edit(category: AdminCategoryTree): void {
    this.editingId.set(category.id);
    this.fieldErrors.set({});

    this.form.patchValue({
      nameEn: category.nameEn,
      nameBn: category.nameBn ?? '',
      // Left empty rather than pre-filled: an admin who renames and saves would
      // otherwise silently keep the old slug. Empty means "leave it", visibly.
      slug: '',
      descriptionEn: category.descriptionEn ?? '',
      isActive: category.isActive,
      isFeatured: category.isFeatured
    });
  }

  protected reset(): void {
    this.editingId.set(null);
    this.fieldErrors.set({});
    this.form.reset({ isActive: true, isFeatured: false });
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

    const payload = {
      nameEn: value.nameEn.trim(),
      nameBn: blankToNull(value.nameBn),
      slug: blankToNull(value.slug),
      descriptionEn: blankToNull(value.descriptionEn),
      isActive: value.isActive,
      isFeatured: value.isFeatured
    };

    const request = editing
      ? this.catalog.updateCategory(editing, payload)
      : this.catalog.createCategory({ ...payload, parentId: value.parentId });

    request.subscribe({
      next: response => {
        this.saving.set(false);

        if (!response.isSuccess) {
          return;
        }

        this.toast.success(editing ? 'Category saved.' : 'Category created.');
        this.reset();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.fieldErrors.set((error.error as GeneralResponse | undefined)?.errors ?? {});
      }
    });
  }

  protected remove(category: AdminCategoryTree): void {
    if (!confirm(`Delete "${category.nameEn}"?`)) {
      return;
    }

    this.catalog.deleteCategory(category.id).subscribe(response => {
      if (response.isSuccess) {
        // The API refuses while a category still has children or products, and
        // that refusal arrives as a 409 the error interceptor already surfaced
        // with the server's own explanation — which names the reason.
        this.toast.success('Category deleted.');
        this.reset();
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);

    this.catalog.getCategoryTree().subscribe({
      next: tree => {
        this.rows.set(flatten(tree));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}

function flatten(tree: AdminCategoryTree[], depth = 0): Row[] {
  return tree.flatMap(category => [
    { category, depth },
    ...flatten(category.children, depth + 1)
  ]);
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}
