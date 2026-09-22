import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminDiscountService } from '../../_services/admin/admin-discount.service';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { ToastService } from '../../_services/toast.service';
import { HasUnsavedChanges } from '../../_guards/auth.guard';
import { GeneralResponse } from '../../_models/generalResponse';
import { AdminCategoryTree, AdminProductListItem } from '../../_models/admin-catalog';
import { DeliveryZone } from '../../_models/cart';
import {
  DISCOUNT_STATUSES,
  DISCOUNT_STATUS_LABELS,
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
  Discount,
  DiscountStatus,
  DiscountTarget,
  DiscountType,
  SaveDiscount,
  VALUELESS_TYPES
} from '../../_models/promotions';

/** A category flattened out of the tree, with its depth for the indent. */
interface CategoryOption {
  id: number;
  label: string;
}

/**
 * Writing a discount.
 *
 * <b>The form is one page, not a wizard.</b> Every field on it changes what
 * the discount is worth or who gets it, and somebody setting up a campaign
 * needs to see the ceiling and the minimum at the same time as the
 * percentage — a three-step wizard is how "20% off" ships without its cap.
 *
 * <b>A discount that has already been given is only half editable.</b> Its
 * name, window, limits and status can still change; its type, value and
 * targets cannot, because orders point at it and say what it gave them. The
 * API refuses the rest, and this screen locks the controls so the refusal is
 * not the first anyone hears of it.
 */
@Component({
  selector: 'app-admin-discount-form',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h1 class="h4 mb-0">{{ isNew() ? 'New discount' : name() }}</h1>
        @if (!isNew() && timesUsed() > 0) {
          <p class="small text-muted mb-0">
            Given to {{ timesUsed() }} order{{ timesUsed() === 1 ? '' : 's' }} &middot;
            <a [routerLink]="['/admin/discounts', id(), 'usage']">see the usage</a>
          </p>
        }
      </div>
      <a class="btn btn-outline-secondary" routerLink="/admin/discounts">Back to the list</a>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      @if (locked()) {
        <!-- Said once, at the top, rather than leaving somebody to discover
             three disabled fields one at a time. -->
        <div class="alert alert-info py-2 small" role="status">
          This discount has already been given to {{ timesUsed() }}
          order{{ timesUsed() === 1 ? '' : 's' }}, so what it is worth and what it applies to
          can no longer be changed. Its name, dates, limits and status still can. To change the
          offer, pause this one and write a new one.
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row g-3">
          <!-- ============ What it is ============ -->
          <div class="col-12 col-xl-6">
            <div class="border rounded p-3 h-100">
              <h2 class="h6 text-uppercase text-muted mb-3">The offer</h2>

              <div class="mb-3">
                <label class="form-label" for="name">Name</label>
                <input class="form-control" id="name" type="text" formControlName="name" />
                <div class="form-text">
                  The customer sees this on their basket, so write it for them.
                </div>
                @if (errorFor('name'); as message) {
                  <div class="small text-danger">{{ message }}</div>
                }
              </div>

              <div class="mb-3">
                <label class="form-label" for="code">Code</label>
                <input
                  class="form-control text-uppercase"
                  id="code"
                  type="text"
                  autocomplete="off"
                  formControlName="code" />
                <div class="form-text">
                  Leave blank for an automatic promotion that applies to every basket which
                  qualifies. With a code, it applies only when somebody types it.
                </div>
                @if (errorFor('code'); as message) {
                  <div class="small text-danger">{{ message }}</div>
                }
              </div>

              <div class="mb-3">
                <label class="form-label" for="type">Kind</label>
                <select class="form-select" id="type" formControlName="type">
                  @for (option of types; track option) {
                    <option [ngValue]="option">{{ typeLabel(option) }}</option>
                  }
                </select>
              </div>

              @if (!valueless()) {
                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <label class="form-label" for="value">
                      {{ isPercentage() ? 'Percentage' : 'Amount off (৳)' }}
                    </label>
                    <input
                      class="form-control"
                      id="value"
                      type="number"
                      min="0"
                      step="0.01"
                      formControlName="value" />
                    @if (errorFor('value'); as message) {
                      <div class="small text-danger">{{ message }}</div>
                    }
                  </div>

                  <div class="col-6">
                    <label class="form-label" for="maxDiscountAmount">Never more than (৳)</label>
                    <input
                      class="form-control"
                      id="maxDiscountAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      formControlName="maxDiscountAmount" />
                  </div>

                  @if (isPercentage()) {
                    <div class="col-12">
                      <div class="form-text">
                        A ceiling is what stops "20% off" costing ৳14,000 on a wardrobe. Leave
                        it blank only if you mean it.
                      </div>
                    </div>
                  }
                </div>
              }

              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label" for="priority">Priority</label>
                  <input
                    class="form-control"
                    id="priority"
                    type="number"
                    step="1"
                    formControlName="priority" />
                  <div class="form-text">Higher wins when two cannot both apply.</div>
                </div>

                <div class="col-6 d-flex align-items-center">
                  <div class="form-check form-switch mt-4">
                    <input
                      class="form-check-input"
                      id="stackable"
                      type="checkbox"
                      role="switch"
                      formControlName="stackable" />
                    <label class="form-check-label" for="stackable">
                      Can be combined with others
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ============ Who gets it ============ -->
          <div class="col-12 col-xl-6">
            <div class="border rounded p-3 h-100">
              <h2 class="h6 text-uppercase text-muted mb-3">Who gets it</h2>

              <div class="row g-2 mb-3">
                <div class="col-6">
                  <label class="form-label" for="minSubtotal">Basket at least (৳)</label>
                  <input
                    class="form-control"
                    id="minSubtotal"
                    type="number"
                    min="0"
                    step="0.01"
                    formControlName="minSubtotal" />
                </div>
                <div class="col-6">
                  <label class="form-label" for="minQuantity">At least this many items</label>
                  <input
                    class="form-control"
                    id="minQuantity"
                    type="number"
                    min="1"
                    step="1"
                    formControlName="minQuantity" />
                </div>
                <div class="col-12">
                  <div class="form-text">
                    Both are measured on the items the discount applies to. Restricted to sofas,
                    they mean "spend this much on sofas".
                  </div>
                </div>
              </div>

              <fieldset class="mb-3">
                <legend class="form-label">Delivering to</legend>
                @for (zone of zones; track zone) {
                  <div class="form-check form-check-inline">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      [id]="'zone-' + zone"
                      [checked]="hasZone(zone)"
                      (change)="toggleZone(zone)" />
                    <label class="form-check-label" [attr.for]="'zone-' + zone">
                      {{ zone === 'InsideDhaka' ? 'Inside Dhaka' : 'Outside Dhaka' }}
                    </label>
                  </div>
                }
                <div class="form-text">Neither ticked means anywhere the shop delivers.</div>
              </fieldset>

              <div class="mb-3">
                <label class="form-label" for="paymentMethods">Payment methods</label>
                <input
                  class="form-control"
                  id="paymentMethods"
                  type="text"
                  placeholder="cod, bkash"
                  formControlName="paymentMethods" />
                <div class="form-text">
                  Codes, separated by commas. Blank means any. A code that does not exist simply
                  never matches, so check the spelling against the payment methods you offer.
                </div>
              </div>

              <div class="form-check form-switch mb-3">
                <input
                  class="form-check-input"
                  id="firstOrderOnly"
                  type="checkbox"
                  role="switch"
                  formControlName="firstOrderOnly" />
                <label class="form-check-label" for="firstOrderOnly">
                  First order only
                </label>
                <div class="form-text">
                  Counted by account, and by phone number for a guest. A guest sees it on the
                  basket and is refused at checkout, where they have finally said who they are.
                </div>
              </div>

              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label" for="usageLimitTotal">Uses in total</label>
                  <input
                    class="form-control"
                    id="usageLimitTotal"
                    type="number"
                    min="1"
                    step="1"
                    formControlName="usageLimitTotal" />
                </div>
                <div class="col-6">
                  <label class="form-label" for="usageLimitPerCustomer">Uses per customer</label>
                  <input
                    class="form-control"
                    id="usageLimitPerCustomer"
                    type="number"
                    min="1"
                    step="1"
                    formControlName="usageLimitPerCustomer" />
                </div>
                <div class="col-12">
                  <div class="form-text">Blank means no limit.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- ============ When ============ -->
          <div class="col-12 col-xl-6">
            <div class="border rounded p-3 h-100">
              <h2 class="h6 text-uppercase text-muted mb-3">When it runs</h2>

              <div class="row g-2">
                <div class="col-12 col-sm-6">
                  <label class="form-label" for="startsAt">Starts</label>
                  <input
                    class="form-control"
                    id="startsAt"
                    type="datetime-local"
                    formControlName="startsAt" />
                </div>
                <div class="col-12 col-sm-6">
                  <label class="form-label" for="endsAt">Ends</label>
                  <input
                    class="form-control"
                    id="endsAt"
                    type="datetime-local"
                    formControlName="endsAt" />
                </div>
                <div class="col-12">
                  <div class="form-text">
                    Your own time. Blank dates mean it runs until somebody stops it, and the end
                    is the moment it stops — set it to midnight to run through the night before.
                  </div>
                  @if (errorFor('endsAt'); as message) {
                    <div class="small text-danger">{{ message }}</div>
                  }
                </div>
              </div>

              <hr />

              <label class="form-label" for="status">Status</label>
              <select class="form-select" id="status" formControlName="status">
                @for (option of statuses; track option) {
                  <option [ngValue]="option">{{ statusLabel(option) }}</option>
                }
              </select>
              <div class="form-text">
                Draft never applies, whatever the dates say. Archived keeps it for the orders
                that used it.
              </div>
            </div>
          </div>

          <!-- ============ What it applies to ============ -->
          <div class="col-12 col-xl-6">
            <div class="border rounded p-3 h-100">
              <h2 class="h6 text-uppercase text-muted mb-3">What it applies to</h2>

              @if (targets().length === 0) {
                <p class="small text-muted">
                  Nothing chosen, so it applies to the whole basket.
                </p>
              } @else {
                <ul class="list-unstyled mb-3">
                  @for (target of targets(); track $index) {
                    <li class="d-flex align-items-center gap-2 small py-1">
                      <span class="badge text-bg-light border">
                        {{ target.categoryId ? 'Category' : 'Product' }}
                      </span>
                      <span class="flex-grow-1">{{ target.name ?? '#' + targetId(target) }}</span>
                      @if (!locked()) {
                        <button
                          class="btn btn-link btn-sm text-muted p-0"
                          type="button"
                          (click)="removeTarget($index)">
                          Remove
                        </button>
                      }
                    </li>
                  }
                </ul>
              }

              @if (!locked()) {
                <div class="mb-3">
                  <label class="form-label" for="addCategory">Add a category</label>
                  <select
                    class="form-select"
                    id="addCategory"
                    [value]="''"
                    (change)="addCategory($event)">
                    <option value="">Choose a category…</option>
                    @for (option of categories(); track option.id) {
                      <option [value]="option.id">{{ option.label }}</option>
                    }
                  </select>
                  <div class="form-text">A category takes everything beneath it as well.</div>
                </div>

                <div>
                  <label class="form-label" for="productSearch">Add a product</label>
                  <input
                    class="form-control"
                    id="productSearch"
                    type="search"
                    autocomplete="off"
                    placeholder="Search by name or code"
                    [value]="productTerm()"
                    (input)="onProductSearch($event)" />

                  @if (productMatches().length > 0) {
                    <ul class="list-group mt-1">
                      @for (product of productMatches(); track product.id) {
                        <li class="list-group-item list-group-item-action py-1">
                          <button
                            class="btn btn-link btn-sm p-0 text-start text-decoration-none"
                            type="button"
                            (click)="addProduct(product)">
                            {{ product.nameEn }}
                            <span class="text-muted font-monospace small">{{ product.code }}</span>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <div class="d-flex align-items-center gap-2 mt-3">
          <button class="btn btn-dark" type="submit" [disabled]="saving() || form.invalid">
            {{ saving() ? 'Saving…' : isNew() ? 'Create discount' : 'Save changes' }}
          </button>
          <a class="btn btn-link text-muted" routerLink="/admin/discounts">Cancel</a>
        </div>
      </form>
    }
  `
})
export class AdminDiscountForm implements HasUnsavedChanges {
  private readonly discountsApi = inject(AdminDiscountService);
  private readonly catalog = inject(AdminCatalogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly types = DISCOUNT_TYPES;
  protected readonly statuses = DISCOUNT_STATUSES;
  protected readonly zones: readonly DeliveryZone[] = ['InsideDhaka', 'OutsideDhaka'];

  protected readonly id = signal<number | null>(null);
  protected readonly name = signal('Discount');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly timesUsed = signal(0);
  protected readonly targets = signal<DiscountTarget[]>([]);
  protected readonly selectedZones = signal<DeliveryZone[]>([]);
  protected readonly categories = signal<CategoryOption[]>([]);
  protected readonly productTerm = signal('');
  protected readonly productMatches = signal<AdminProductListItem[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  protected readonly isNew = computed(() => this.id() === null);

  /** What a discount already given no longer allows. The API refuses the same. */
  protected readonly locked = computed(() => this.timesUsed() > 0);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    code: [''],
    type: ['Percentage' as DiscountType, Validators.required],
    value: [10],
    maxDiscountAmount: [null as number | null],
    minSubtotal: [null as number | null],
    minQuantity: [null as number | null],
    firstOrderOnly: [false],
    paymentMethods: [''],
    startsAt: [''],
    endsAt: [''],
    usageLimitTotal: [null as number | null],
    usageLimitPerCustomer: [null as number | null],
    stackable: [false],
    priority: [0],
    status: ['Draft' as DiscountStatus]
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const raw = this.route.snapshot.paramMap.get('id');
    const id = raw === null || raw === 'new' ? null : Number(raw);

    this.id.set(Number.isFinite(id) ? id : null);

    this.catalog.getCategoryTree().subscribe(tree => this.categories.set(flatten(tree)));

    if (this.id() === null) {
      this.loading.set(false);
      return;
    }

    this.discountsApi.get(this.id()!).subscribe({
      next: discount => {
        if (discount) {
          this.apply(discount);
        }

        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  protected typeLabel(type: DiscountType): string {
    return DISCOUNT_TYPE_LABELS[type] ?? type;
  }

  protected statusLabel(status: DiscountStatus): string {
    return DISCOUNT_STATUS_LABELS[status] ?? status;
  }

  protected isPercentage(): boolean {
    return this.form.controls.type.value === 'Percentage';
  }

  /** Free delivery is worth the delivery charge, so the value box is hidden rather than ignored. */
  protected valueless(): boolean {
    return VALUELESS_TYPES.has(this.form.controls.type.value);
  }

  protected errorFor(key: string): string | null {
    return this.fieldErrors()[key]?.[0] ?? null;
  }

  protected hasZone(zone: DeliveryZone): boolean {
    return this.selectedZones().includes(zone);
  }

  protected toggleZone(zone: DeliveryZone): void {
    this.selectedZones.update(zones =>
      zones.includes(zone) ? zones.filter(existing => existing !== zone) : [...zones, zone]
    );

    this.form.markAsDirty();
  }

  protected targetId(target: DiscountTarget): number {
    return target.categoryId ?? target.productId ?? 0;
  }

  protected addCategory(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = Number(select.value);

    select.value = '';

    if (!Number.isFinite(id) || id === 0) {
      return;
    }

    if (this.targets().some(target => target.categoryId === id)) {
      return;
    }

    const option = this.categories().find(candidate => candidate.id === id);

    this.targets.update(targets => [
      ...targets,
      { categoryId: id, name: option?.label.trim() ?? `#${id}` }
    ]);

    this.form.markAsDirty();
  }

  protected onProductSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;

    this.productTerm.set(term);

    clearTimeout(this.searchTimer);

    if (term.trim().length < 2) {
      this.productMatches.set([]);
      return;
    }

    this.searchTimer = setTimeout(() => {
      this.catalog
        .searchProducts({ search: term.trim(), pageNumber: 1, pageSize: 8 })
        .subscribe(result => this.productMatches.set(result.result ?? []));
    }, 300);
  }

  protected addProduct(product: AdminProductListItem): void {
    if (!this.targets().some(target => target.productId === product.id)) {
      this.targets.update(targets => [...targets, { productId: product.id, name: product.nameEn }]);
      this.form.markAsDirty();
    }

    this.productTerm.set('');
    this.productMatches.set([]);
  }

  protected removeTarget(index: number): void {
    this.targets.update(targets => targets.filter((_, position) => position !== index));
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.saving() || this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.fieldErrors.set({});

    const dto = this.toDto();

    // Captured before the answer comes back, because applying it sets the id
    // and the screen stops being a create. Without this the URL would stay at
    // /new, and a refresh would write a second discount rather than edit the
    // one just made.
    const creating = this.isNew();

    const request = creating
      ? this.discountsApi.create(dto)
      : this.discountsApi.update(this.id()!, dto);

    request.subscribe({
      next: response => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.toast.success(response.message || 'Discount saved.');

        if (response.data) {
          this.apply(response.data);
        }

        if (creating && response.data) {
          void this.router.navigate(['/admin/discounts', response.data.id], { replaceUrl: true });
        }
      },
      error: (failure: HttpErrorResponse) => {
        this.saving.set(false);

        const body = failure.error as GeneralResponse | undefined;

        this.fieldErrors.set(body?.errors ?? {});
      }
    });
  }

  private toDto(): SaveDiscount {
    const value = this.form.getRawValue();

    return {
      name: value.name.trim(),
      code: value.code.trim() === '' ? null : value.code.trim().toUpperCase(),
      type: value.type,
      value: this.valueless() ? 0 : Number(value.value) || 0,
      maxDiscountAmount: blankToNull(value.maxDiscountAmount),
      minSubtotal: blankToNull(value.minSubtotal),
      minQuantity: blankToNull(value.minQuantity),
      firstOrderOnly: value.firstOrderOnly,
      deliveryZones: this.selectedZones(),
      paymentMethods: value.paymentMethods
        .split(',')
        .map(method => method.trim().toLowerCase())
        .filter(method => method.length > 0),

      // The control holds "2026-10-01T00:00" in the admin's own time. Sent as
      // an ISO instant so the API is never left guessing which midnight was
      // meant.
      startsAt: toInstant(value.startsAt),
      endsAt: toInstant(value.endsAt),

      usageLimitTotal: blankToNull(value.usageLimitTotal),
      usageLimitPerCustomer: blankToNull(value.usageLimitPerCustomer),
      stackable: value.stackable,
      priority: Number(value.priority) || 0,
      status: value.status,
      targets: this.targets().map(target => ({
        categoryId: target.categoryId ?? null,
        productId: target.productId ?? null
      }))
    };
  }

  private apply(discount: Discount): void {
    this.id.set(discount.id);
    this.name.set(discount.name);
    this.timesUsed.set(discount.timesUsed);
    this.targets.set(discount.targets ?? []);
    this.selectedZones.set(discount.deliveryZones ?? []);

    this.form.patchValue(
      {
        name: discount.name,
        code: discount.code ?? '',
        type: discount.type,
        value: discount.value,
        maxDiscountAmount: discount.maxDiscountAmount ?? null,
        minSubtotal: discount.minSubtotal ?? null,
        minQuantity: discount.minQuantity ?? null,
        firstOrderOnly: discount.firstOrderOnly,
        paymentMethods: (discount.paymentMethods ?? []).join(', '),
        startsAt: toLocalInput(discount.startsAt),
        endsAt: toLocalInput(discount.endsAt),
        usageLimitTotal: discount.usageLimitTotal ?? null,
        usageLimitPerCustomer: discount.usageLimitPerCustomer ?? null,
        stackable: discount.stackable,
        priority: discount.priority,
        status: discount.status
      },
      { emitEvent: false }
    );

    // What an order that already used it has a claim on. Disabled rather than
    // hidden, so the shop can still see what the offer is.
    for (const control of [this.form.controls.type, this.form.controls.value]) {
      if (discount.timesUsed > 0) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }

    this.form.markAsPristine();
  }
}

/** The tree as a flat list, indented so the shape survives a `<select>`. */
function flatten(tree: AdminCategoryTree[], depth = 0): CategoryOption[] {
  return tree.flatMap(node => [
    { id: node.id, label: `${'  '.repeat(depth)}${node.nameEn}` },
    ...flatten(node.children ?? [], depth + 1)
  ]);
}

/** An empty number input arrives as null or an empty string; both mean "no limit". */
function blankToNull(value: number | null | string): number | null {
  if (value === null || value === '' || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/** `datetime-local` text to an ISO instant, in the admin's own time zone. */
function toInstant(value: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** An ISO instant back to what `datetime-local` wants, in local time. */
function toLocalInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const pad = (part: number) => String(part).padStart(2, '0');

  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
}
