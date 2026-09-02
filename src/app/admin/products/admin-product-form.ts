import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { ToastService } from '../../_services/toast.service';
import { HasUnsavedChanges } from '../../_guards/auth.guard';
import { GeneralResponse } from '../../_models/generalResponse';
import {
  AdminBrand,
  AdminCategoryTree,
  AdminProductDetail,
  CreateProductDto
} from '../../_models/admin-catalog';

/**
 * Create and edit one product.
 *
 * <b>One component for both, because the fields are the same.</b> The
 * difference is a POST or a PUT and whether a code field is editable, and
 * splitting on that produces two forms that drift — the second one quietly
 * missing the validator someone added to the first.
 *
 * The `id` input is bound from the route by `withComponentInputBinding`, so
 * `/admin/products/7` arrives here as `id = '7'` without touching
 * `ActivatedRoute`.
 */
@Component({
  selector: 'app-admin-product-form',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">{{ isNew() ? 'Add product' : product()?.nameEn }}</h1>

      @if (!isNew() && product(); as loaded) {
        <span class="badge" [class]="loaded.status === 'Active' ? 'text-bg-success' : 'text-bg-warning'">
          {{ loaded.status }}
        </span>

        <a class="btn btn-sm btn-outline-secondary ms-auto" [routerLink]="['/admin/products', loaded.id, 'media']">
          Photographs ({{ loaded.media.length }})
        </a>
      } @else {
        <span class="ms-auto"></span>
      }

      <a class="btn btn-sm btn-link" routerLink="/admin/products">Back to products</a>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row g-4">
          <div class="col-12 col-lg-8">
            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted mb-3">Basics</h2>

              <div class="row g-3">
                <div class="col-12 col-md-8">
                  <label class="form-label" for="nameEn">Name (English)</label>
                  <input id="nameEn" class="form-control" formControlName="nameEn"
                         [class.is-invalid]="invalid('nameEn')" />
                  <div class="invalid-feedback">{{ messageFor('nameEn') }}</div>
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label" for="code">Code</label>
                  <input id="code" class="form-control font-monospace" formControlName="code"
                         [class.is-invalid]="invalid('code')" />
                  <div class="form-text">Your internal reference, e.g. WH-BED-014.</div>
                  <div class="invalid-feedback">{{ messageFor('code') }}</div>
                </div>

                <div class="col-12 col-md-8">
                  <label class="form-label" for="nameBn">Name (Bangla)</label>
                  <input id="nameBn" class="form-control" formControlName="nameBn" />
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label" for="slug">URL slug</label>
                  <input id="slug" class="form-control font-monospace" formControlName="slug"
                         [placeholder]="isNew() ? 'from the name' : ''" />
                  <!-- Empty means "keep the published slug", which is the safe
                       default: a slug is part of every inbound link. -->
                  <div class="form-text">
                    {{ isNew() ? 'Leave empty to build it from the name.' : 'Leave empty to keep the current one.' }}
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label" for="categoryId">Category</label>
                  <select id="categoryId" class="form-select" formControlName="categoryId"
                          [class.is-invalid]="invalid('categoryId')">
                    <option [ngValue]="null">Choose a category</option>
                    @for (option of categoryOptions(); track option.id) {
                      <option [ngValue]="option.id">{{ option.label }}</option>
                    }
                  </select>
                  <div class="invalid-feedback">{{ messageFor('categoryId') }}</div>
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label" for="brandId">Brand</label>
                  <select id="brandId" class="form-select" formControlName="brandId">
                    <option [ngValue]="null">None</option>
                    @for (brand of brands(); track brand.id) {
                      <option [ngValue]="brand.id">{{ brand.nameEn }}</option>
                    }
                  </select>
                </div>

                <div class="col-12">
                  <label class="form-label" for="shortDescriptionEn">Short description</label>
                  <input id="shortDescriptionEn" class="form-control" maxlength="500"
                         formControlName="shortDescriptionEn" />
                  <div class="form-text">One line, shown on the product card.</div>
                </div>

                <div class="col-12">
                  <label class="form-label" for="descriptionEn">Description</label>
                  <textarea id="descriptionEn" class="form-control" rows="5"
                            formControlName="descriptionEn"></textarea>
                </div>
              </div>
            </div>

            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted mb-3">Dimensions and build</h2>

              <div class="row g-3">
                <div class="col-6 col-md-3">
                  <label class="form-label" for="lengthCm">Length (cm)</label>
                  <input id="lengthCm" class="form-control" type="number" formControlName="lengthCm" />
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label" for="widthCm">Width (cm)</label>
                  <input id="widthCm" class="form-control" type="number" formControlName="widthCm" />
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label" for="heightCm">Height (cm)</label>
                  <input id="heightCm" class="form-control" type="number" formControlName="heightCm" />
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label" for="weightKg">Weight (kg)</label>
                  <input id="weightKg" class="form-control" type="number" formControlName="weightKg" />
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label" for="material">Material</label>
                  <input id="material" class="form-control" formControlName="material"
                         placeholder="Segun wood" />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label" for="finishType">Finish</label>
                  <input id="finishType" class="form-control" formControlName="finishType" />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label" for="warrantyMonths">Warranty (months)</label>
                  <input id="warrantyMonths" class="form-control" type="number"
                         formControlName="warrantyMonths" />
                </div>
              </div>
            </div>

            <div class="border rounded p-3">
              <h2 class="h6 text-uppercase text-muted mb-3">Search appearance</h2>

              <div class="row g-3">
                <div class="col-12">
                  <label class="form-label" for="seoTitle">Page title</label>
                  <input id="seoTitle" class="form-control" maxlength="200" formControlName="seoTitle" />
                  <!-- The storefront appends "| WoodHeart" only when it is not
                       already there, so writing it here is allowed but not
                       required. -->
                  <div class="form-text">Leave empty to use the product name.</div>
                </div>

                <div class="col-12">
                  <label class="form-label" for="seoDescription">Meta description</label>
                  <textarea id="seoDescription" class="form-control" rows="2" maxlength="400"
                            formControlName="seoDescription"></textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-lg-4">
            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted mb-3">Price</h2>

              <div class="mb-3">
                <label class="form-label" for="basePrice">Base price (৳)</label>
                <input id="basePrice" class="form-control" type="number" min="0"
                       formControlName="basePrice" [class.is-invalid]="invalid('basePrice')" />
                <div class="invalid-feedback">{{ messageFor('basePrice') }}</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="compareAtPrice">Compare-at price (৳)</label>
                <input id="compareAtPrice" class="form-control" type="number" min="0"
                       formControlName="compareAtPrice" />
                <div class="form-text">The struck-through "was" price. Leave empty for no offer.</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="deliverySurcharge">Delivery surcharge (৳)</label>
                <input id="deliverySurcharge" class="form-control" type="number" min="0"
                       formControlName="deliverySurcharge" />
                <div class="form-text">For bulky items, on top of the zone fee.</div>
              </div>
            </div>

            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted mb-3">Type</h2>

              <div class="mb-3">
                <label class="form-label" for="productType">Sold as</label>
                <select id="productType" class="form-select" formControlName="productType">
                  <option value="Stocked">Stocked — we hold these</option>
                  <option value="MadeToOrder">Made to order</option>
                  <option value="Service">Service</option>
                </select>
              </div>

              @if (form.controls.productType.value === 'MadeToOrder') {
                <!-- Only shown for made-to-order, because a lead time on a
                     stocked product is a promise nobody is tracking. -->
                <div class="mb-3">
                  <label class="form-label" for="leadTimeDays">Lead time (working days)</label>
                  <input id="leadTimeDays" class="form-control" type="number" min="0"
                         formControlName="leadTimeDays" />
                </div>
              }

              <div class="form-check mb-2">
                <input id="assemblyRequired" class="form-check-input" type="checkbox"
                       formControlName="assemblyRequired" />
                <label class="form-check-label" for="assemblyRequired">Needs assembly on delivery</label>
              </div>

              <div class="form-check">
                <input id="isFeatured" class="form-check-input" type="checkbox"
                       formControlName="isFeatured" />
                <label class="form-check-label" for="isFeatured">Feature on the home page</label>
              </div>
            </div>

            <div class="d-grid gap-2">
              <button class="btn btn-dark" type="submit" [disabled]="saving()">
                {{ saving() ? 'Saving…' : isNew() ? 'Create product' : 'Save changes' }}
              </button>

              @if (!isNew()) {
                <p class="small text-muted mb-0">
                  Saving does not publish. Use Publish on the product list when it is ready.
                </p>
              } @else {
                <p class="small text-muted mb-0">
                  New products are created as a draft, so nothing appears on the storefront until
                  you publish it.
                </p>
              }
            </div>
          </div>
        </div>
      </form>
    }
  `
})
export class AdminProductForm implements OnInit, HasUnsavedChanges {
  private readonly formBuilder = inject(FormBuilder);
  private readonly catalog = inject(AdminCatalogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from the route. `'new'` for the create form. */
  readonly id = input<string>('new');

  protected readonly isNew = computed(() => this.id() === 'new');

  protected readonly product = signal<AdminProductDetail | null>(null);
  protected readonly brands = signal<AdminBrand[]>([]);
  protected readonly categoryOptions = signal<{ id: number; label: string }[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  private readonly fieldErrors = signal<Record<string, string[]>>({});

  protected readonly form = this.formBuilder.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(64)]],
    nameEn: ['', [Validators.required, Validators.maxLength(300)]],
    nameBn: [''],
    slug: [''],
    categoryId: [null as number | null, [Validators.required]],
    brandId: [null as number | null],
    productType: ['Stocked'],
    basePrice: [0, [Validators.required, Validators.min(0)]],
    compareAtPrice: [null as number | null],
    shortDescriptionEn: [''],
    descriptionEn: [''],
    lengthCm: [null as number | null],
    widthCm: [null as number | null],
    heightCm: [null as number | null],
    weightKg: [null as number | null],
    material: [''],
    finishType: [''],
    warrantyMonths: [null as number | null],
    leadTimeDays: [null as number | null],
    assemblyRequired: [false],
    isFeatured: [false],
    deliverySurcharge: [null as number | null],
    seoTitle: [''],
    seoDescription: ['']
  });

  /**
   * Loads in `ngOnInit`, not the constructor.
   *
   * <b>Route inputs do not exist yet during construction.</b>
   * `withComponentInputBinding` sets them after the component is built, so
   * reading `id()` in the constructor returns the declared default — `'new'` —
   * and this form quietly decides every edit is a create. It renders every
   * label, loads nothing, and saving overwrites a real product with blanks.
   *
   * Found by driving the page in a browser. Nothing else could have: the
   * component builds, the template compiles, and the screen looks like a form.
   */
  ngOnInit(): void {
    this.catalog.getBrands().subscribe(brands => this.brands.set(brands));
    this.catalog.getCategoryTree().subscribe(tree => this.categoryOptions.set(flatten(tree)));

    if (this.isNew()) {
      this.loading.set(false);
    } else {
      this.catalog.getProduct(Number(this.id())).subscribe(product => {
        if (product) {
          this.product.set(product);
          this.form.patchValue(toFormValue(product));

          // Reset marks the form pristine at its loaded values, so the
          // unsaved-changes guard does not fire on a product that was only
          // opened and closed.
          this.form.markAsPristine();
        }

        this.loading.set(false);
      });
    }
  }

  /** Used by `preventUnsavedChangesGuard`. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return (!!field?.invalid && (field.touched || field.dirty)) || !!this.fieldErrors()[control];
  }

  protected messageFor(control: string): string {
    const fromServer = this.fieldErrors()[control];

    if (fromServer?.length) {
      return fromServer[0];
    }

    return 'This field is required.';
  }

  protected save(): void {
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Some fields still need attention.');
      return;
    }

    this.saving.set(true);

    const dto = this.toDto();

    const request = this.isNew()
      ? this.catalog.createProduct(dto)
      : this.catalog.updateProduct(Number(this.id()), dto);

    request.subscribe({
      next: response => {
        this.saving.set(false);

        if (!response.isSuccess) {
          return;
        }

        this.form.markAsPristine();
        this.toast.success(this.isNew() ? 'Product created as a draft.' : 'Product saved.');

        if (this.isNew()) {
          // Straight to the photographs. A product with no image shows a blank
          // tile in every listing, so this is the next thing that has to happen
          // and the admin should not have to go looking for it.
          this.router.navigate(['/admin/products', response.data?.id ?? response.id, 'media']);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);

        const body = error.error as GeneralResponse | undefined;

        this.fieldErrors.set(body?.errors ?? {});
      }
    });
  }

  /**
   * Turns the form into the API's shape.
   *
   * Empty strings become null. The backend treats an empty slug as "derive it"
   * or "keep the existing one", and `''` is the value an untouched text input
   * holds — sending it as an empty string would ask for a slug of nothing.
   */
  private toDto(): CreateProductDto {
    const value = this.form.getRawValue();

    return {
      code: value.code.trim(),
      nameEn: value.nameEn.trim(),
      nameBn: blankToNull(value.nameBn),
      slug: blankToNull(value.slug),
      categoryId: value.categoryId!,
      brandId: value.brandId,
      productType: value.productType as CreateProductDto['productType'],
      basePrice: value.basePrice,
      compareAtPrice: value.compareAtPrice,
      shortDescriptionEn: blankToNull(value.shortDescriptionEn),
      descriptionEn: blankToNull(value.descriptionEn),
      lengthCm: value.lengthCm,
      widthCm: value.widthCm,
      heightCm: value.heightCm,
      weightKg: value.weightKg,
      material: blankToNull(value.material),
      finishType: blankToNull(value.finishType),
      warrantyMonths: value.warrantyMonths,
      // A lead time only means something for a product that is built to order.
      leadTimeDays: value.productType === 'MadeToOrder' ? value.leadTimeDays : null,
      assemblyRequired: value.assemblyRequired,
      deliverySurcharge: value.deliverySurcharge,
      isFeatured: value.isFeatured,
      seoTitle: blankToNull(value.seoTitle),
      seoDescription: blankToNull(value.seoDescription)
    };
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

/** Flattens the category tree for a `<select>`, showing depth as indentation. */
function flatten(tree: AdminCategoryTree[], depth = 0): { id: number; label: string }[] {
  return tree.flatMap(node => [
    { id: node.id, label: `${'— '.repeat(depth)}${node.nameEn}` },
    ...flatten(node.children, depth + 1)
  ]);
}

function toFormValue(product: AdminProductDetail) {
  return {
    code: product.code,
    nameEn: product.nameEn,
    nameBn: product.nameBn ?? '',
    // Deliberately not pre-filled with the current slug. An admin who edits the
    // name and saves would otherwise keep the old slug silently; empty means
    // "leave it alone", which is the same thing but visible.
    slug: '',
    categoryId: product.categoryId,
    brandId: product.brandId ?? null,
    productType: product.productType,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice ?? null,
    shortDescriptionEn: product.shortDescriptionEn ?? '',
    descriptionEn: product.descriptionEn ?? '',
    lengthCm: product.lengthCm ?? null,
    widthCm: product.widthCm ?? null,
    heightCm: product.heightCm ?? null,
    weightKg: product.weightKg ?? null,
    material: product.material ?? '',
    finishType: product.finishType ?? '',
    warrantyMonths: product.warrantyMonths ?? null,
    leadTimeDays: product.leadTimeDays ?? null,
    assemblyRequired: product.assemblyRequired,
    deliverySurcharge: product.deliverySurcharge ?? null,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? ''
  };
}
