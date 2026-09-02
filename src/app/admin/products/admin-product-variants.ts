import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { ToastService } from '../../_services/toast.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { AdminProductDetail, AdminProductVariant } from '../../_models/admin-catalog';
import { GeneralResponse } from '../../_models/generalResponse';

/**
 * The configurations one product is sold in.
 *
 * <b>Variants are where the money is, which is why they are a screen of their
 * own.</b> A bed sold in 5ft and 6ft, in Segun and in Mahogany, is four things
 * a customer can buy at four prices with four stock counts — and every order
 * line, every reservation and every stock movement points at a variant, not at
 * the product. Getting one wrong is not a display bug.
 *
 * <b>A price left empty inherits the product's base price.</b> That is not a
 * convenience: it means a shop-wide price change is one edit rather than one
 * per variant, and it is why the column below shows the resolved price the
 * customer will actually pay next to the override that produced it.
 */
@Component({
  selector: 'app-admin-product-variants',
  imports: [ReactiveFormsModule, RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Variants</h1>

      @if (product(); as loaded) {
        <span class="text-muted">— {{ loaded.nameEn }}</span>
        <span class="badge text-bg-light">base {{ loaded.basePrice | taka }}</span>

        <a class="btn btn-sm btn-link ms-auto" [routerLink]="['/admin/products', loaded.id]">
          Back to the product
        </a>
        <a class="btn btn-sm btn-outline-secondary" [routerLink]="['/admin/products', loaded.id, 'media']">
          Photographs
        </a>
      }
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      <div class="row g-4">
        <div class="col-12 col-lg-7">
          @if (variants().length === 0) {
            <div class="border rounded p-5 text-center text-muted">
              <p class="mb-0">
                No variants. A product with none has no price and no stock — nothing can be
                added to a basket.
              </p>
            </div>
          } @else {
            <div class="table-responsive border rounded">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th scope="col">Variant</th>
                    <th scope="col">Options</th>
                    <th scope="col" class="text-end">Price</th>
                    <th scope="col">Live</th>
                    <th scope="col"><span class="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (variant of variants(); track variant.id) {
                    <tr [class.table-active]="editingId() === variant.id">
                      <td>
                        {{ variant.variantName }}
                        @if (variant.isDefault) {
                          <span class="badge text-bg-dark ms-1">Default</span>
                        }
                        <div class="small text-muted font-monospace">{{ variant.sku }}</div>
                      </td>

                      <td class="small">
                        @for (option of optionsOf(variant); track option) {
                          <span class="badge text-bg-light me-1">{{ option }}</span>
                        }
                      </td>

                      <td class="text-end">
                        {{ variant.effectivePrice | taka }}
                        @if (variant.isOnOffer) {
                          <div class="small text-muted text-decoration-line-through">
                            {{ variant.effectiveCompareAtPrice | taka }}
                          </div>
                        }
                      </td>

                      <td>
                        @if (variant.isActive) {
                          <span class="badge text-bg-success">Yes</span>
                        } @else {
                          <span class="badge text-bg-secondary">No</span>
                        }
                      </td>

                      <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-secondary" type="button"
                                (click)="edit(variant)">
                          Edit
                        </button>
                        <button
                          class="btn btn-sm btn-outline-danger ms-1"
                          type="button"
                          [disabled]="variants().length === 1"
                          [title]="variants().length === 1
                            ? 'The last variant cannot be deleted — the product would have no price.'
                            : ''"
                          (click)="remove(variant)">
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
              {{ editingId() ? 'Edit variant' : 'New variant' }}
            </h2>

            <form [formGroup]="form" (ngSubmit)="save()" novalidate>
              <div class="mb-3">
                <label class="form-label" for="sku">SKU</label>
                <input id="sku" class="form-control font-monospace" formControlName="sku"
                       [class.is-invalid]="invalid('sku')" />
                <div class="form-text">Unique across the shop. It goes on the invoice.</div>
                <div class="invalid-feedback">{{ messageFor('sku') }}</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="variantName">Name</label>
                <input id="variantName" class="form-control" formControlName="variantName"
                       placeholder="from the options" />
                <div class="form-text">Leave empty to build it from the options below.</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="optionValues">Options</label>
                <input id="optionValues" class="form-control" formControlName="optionValues"
                       placeholder="Wood: Segun, Size: 6ft"
                       [class.is-invalid]="invalid('optionValues')" />
                <!-- A plain "Name: value" list rather than a repeating form
                     group. Furniture has two or three options, and a dynamic
                     FormArray here would be more machinery than the problem. -->
                <div class="form-text">Comma separated, each as <code>Name: value</code>.</div>
                <div class="invalid-feedback">{{ messageFor('optionValues') }}</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="priceOverride">Price (৳)</label>
                <input id="priceOverride" class="form-control" type="number" min="0"
                       formControlName="priceOverride"
                       [placeholder]="basePricePlaceholder()" />
                <!-- Empty inherits, which is what makes a shop-wide price change
                     one edit instead of one per variant. -->
                <div class="form-text">Leave empty to use the product's base price.</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="compareAtPriceOverride">Compare-at price (৳)</label>
                <input id="compareAtPriceOverride" class="form-control" type="number" min="0"
                       formControlName="compareAtPriceOverride" />
                <div class="form-text">The struck-through "was" price for this variant.</div>
              </div>

              <div class="form-check mb-2">
                <input id="isDefault" class="form-check-input" type="checkbox"
                       formControlName="isDefault" />
                <label class="form-check-label" for="isDefault">
                  Selected first on the product page
                </label>
              </div>

              <div class="form-check mb-3">
                <input id="isActive" class="form-check-input" type="checkbox"
                       formControlName="isActive" />
                <label class="form-check-label" for="isActive">Available to buy</label>
              </div>

              <div class="d-flex gap-2">
                <button class="btn btn-dark" type="submit" [disabled]="saving()">
                  {{ saving() ? 'Saving…' : editingId() ? 'Save changes' : 'Add variant' }}
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
    }
  `
})
export class AdminProductVariants implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly catalog = inject(AdminCatalogService);
  private readonly toast = inject(ToastService);

  /** Bound from the route. */
  readonly productId = input.required<string>();

  protected readonly product = signal<AdminProductDetail | null>(null);
  protected readonly variants = signal<AdminProductVariant[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  private readonly fieldErrors = signal<Record<string, string[]>>({});

  protected readonly form = this.formBuilder.nonNullable.group({
    sku: ['', [Validators.required, Validators.maxLength(64)]],
    variantName: [''],
    optionValues: ['', [Validators.required]],
    priceOverride: [null as number | null],
    compareAtPriceOverride: [null as number | null],
    isDefault: [false],
    isActive: [true]
  });

  private get id(): number {
    return Number(this.productId());
  }

  /** Loads in `ngOnInit` — route inputs are not set during construction. */
  ngOnInit(): void {
    this.load();
  }

  protected basePricePlaceholder(): string {
    const base = this.product()?.basePrice;

    return base === undefined ? '' : String(base);
  }

  protected optionsOf(variant: AdminProductVariant): string[] {
    return Object.entries(variant.optionValues).map(([name, value]) => `${name}: ${value}`);
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

    return control === 'optionValues'
      ? 'Give at least one option, as Name: value.'
      : 'This field is required.';
  }

  protected edit(variant: AdminProductVariant): void {
    this.editingId.set(variant.id);
    this.fieldErrors.set({});

    this.form.setValue({
      sku: variant.sku,
      variantName: variant.variantName,
      optionValues: this.optionsOf(variant).join(', '),
      // The resolved price is shown here, which is a small lie when it was
      // inherited — but blanking it on every edit would silently reset a
      // deliberate override the moment somebody fixed a typo in the SKU.
      priceOverride: variant.effectivePrice,
      compareAtPriceOverride: variant.effectiveCompareAtPrice ?? null,
      isDefault: variant.isDefault,
      isActive: variant.isActive
    });
  }

  protected reset(): void {
    this.editingId.set(null);
    this.fieldErrors.set({});
    this.form.reset({ isDefault: false, isActive: true });
  }

  protected save(): void {
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const options = parseOptions(value.optionValues);

    if (Object.keys(options).length === 0) {
      this.fieldErrors.set({ optionValues: ['Give at least one option, as Name: value.'] });
      return;
    }

    this.saving.set(true);

    const dto = {
      sku: value.sku.trim(),
      variantName: value.variantName.trim() || null,
      optionValues: options,
      priceOverride: value.priceOverride,
      compareAtPriceOverride: value.compareAtPriceOverride,
      isDefault: value.isDefault,
      isActive: value.isActive
    };

    const editing = this.editingId();

    const request = editing
      ? this.catalog.updateVariant(editing, dto)
      : this.catalog.addVariant(this.id, dto);

    request.subscribe({
      next: response => {
        this.saving.set(false);

        if (!response.isSuccess) {
          return;
        }

        this.toast.success(editing ? 'Variant saved.' : 'Variant added.');
        this.reset();

        // Reloaded rather than patched: setting one variant as the default
        // unsets whichever held it, and that second row is not in the response.
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.fieldErrors.set((error.error as GeneralResponse | undefined)?.errors ?? {});
      }
    });
  }

  protected remove(variant: AdminProductVariant): void {
    if (!confirm(`Delete "${variant.variantName}"?`)) {
      return;
    }

    this.catalog.deleteVariant(variant.id).subscribe(response => {
      if (response.isSuccess) {
        // The API refuses to delete the last one — a product with no variants
        // has no price and cannot be bought, and nothing on the storefront
        // reports why.
        this.toast.success('Variant deleted.');
        this.reset();
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);

    this.catalog.getProduct(this.id).subscribe({
      next: product => {
        this.product.set(product);
        this.variants.set(product?.variants ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}

/**
 * Reads `Wood: Segun, Size: 6ft` into `{ Wood: 'Segun', Size: '6ft' }`.
 *
 * Entries without a colon are dropped rather than guessed at. Inventing a key
 * for `6ft` would produce a variant whose options do not match its siblings,
 * and the product page builds its option pickers by grouping on those keys —
 * so one malformed entry gives a customer a picker with a single orphan choice.
 */
function parseOptions(input: string): Record<string, string> {
  const options: Record<string, string> = {};

  for (const part of input.split(',')) {
    const separator = part.indexOf(':');

    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (name && value) {
      options[name] = value;
    }
  }

  return options;
}
