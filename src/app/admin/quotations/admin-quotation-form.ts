import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminQuotationService } from '../../_services/admin/admin-quotation.service';
import { AdminStockService } from '../../_services/admin/admin-stock.service';
import { ToastService } from '../../_services/toast.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { DIVISIONS, districtsOf } from '../../_models/bangladesh';
import { DEFAULT_VALID_DAYS, SaveQuotation, SaveQuotationLine } from '../../_models/admin-quotations';
import { Quotation } from '../../_models/quotations';
import { StockLevel } from '../../_models/inventory';
import { HasUnsavedChanges } from '../../_guards/auth.guard';

/**
 * Writing a quotation.
 *
 * <b>One document, saved whole.</b> The discount only means something beside
 * the lines it comes off, so the API takes the whole thing in one call and
 * this screen sends it that way. A partial save would be a quotation whose
 * total disagrees with itself.
 *
 * <b>Two kinds of line, and the difference is the point.</b> A catalogue line
 * names a variant and inherits its description, its photograph and — unless a
 * price is typed over it — its price. A made-to-measure line names nothing:
 * it carries its own words and its own price, because there is nothing behind
 * it to read either from. The second kind is the most valuable thing a
 * designer sells, and it is why the variant on a quotation line is allowed to
 * be absent at all.
 *
 * <b>No total is worked out here.</b> What this screen adds up is goods as
 * typed, and it says so. VAT, delivery and any catalogue price left blank are
 * the API's, priced by the same function that prices a basket and an order. A
 * second pricer in TypeScript would be a second set of VAT rules, and the day
 * they disagreed the shop would find out from a customer.
 *
 * <b>Only a draft opens here.</b> Anything already sent is a price somebody is
 * holding; changing it means pulling it back to draft first, which is a
 * deliberate act and leaves a trail.
 */
@Component({
  selector: 'app-admin-quotation-form',
  imports: [ReactiveFormsModule, RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/quotations">
      &lsaquo; All quotations
    </a>

    <h1 class="h4 mt-2 mb-3">
      @if (quotationNumber) {
        Edit {{ quotationNumber }}
      } @else {
        Write a quotation
      }
    </h1>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      @if (refusal(); as message) {
        <div class="alert alert-warning" role="alert">{{ message }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row g-3">
          <div class="col-12 col-xl-8">
            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">Who it is for</h2>

              <div class="row g-2">
                <div class="col-12 col-md-6">
                  <label class="form-label small" for="contactName">Name</label>
                  <input
                    id="contactName"
                    class="form-control form-control-sm"
                    type="text"
                    formControlName="contactName"
                    [class.is-invalid]="invalid('contactName')" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="contactPhone">Mobile number</label>
                  <input
                    id="contactPhone"
                    class="form-control form-control-sm"
                    type="tel"
                    inputmode="numeric"
                    placeholder="01712345678"
                    formControlName="contactPhone"
                    [class.is-invalid]="invalid('contactPhone')" />
                  <div class="form-text">
                    This is what the customer quotes back to read the quotation.
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="contactEmail">Email (optional)</label>
                  <input
                    id="contactEmail"
                    class="form-control form-control-sm"
                    type="email"
                    formControlName="contactEmail"
                    [class.is-invalid]="invalid('contactEmail')" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="validUntil">Stands until</label>
                  <input
                    id="validUntil"
                    class="form-control form-control-sm"
                    type="date"
                    formControlName="validUntil" />
                  <!-- Timber prices move, and a quotation with no end to it is
                       a price the shop is held to for ever. -->
                  <div class="form-text">
                    A fortnight by default. After this date it is re-quoted, not honoured.
                  </div>
                </div>
              </div>
            </div>

            <div class="border rounded p-3 mb-3" formGroupName="shippingAddress">
              <h2 class="h6 text-uppercase text-muted small mb-3">Where it is going</h2>

              <div class="row g-2">
                <div class="col-12 col-md-6">
                  <label class="form-label small" for="division">Division</label>
                  <select
                    id="division"
                    class="form-select form-select-sm"
                    formControlName="division"
                    (change)="onDivision()">
                    <option value="">Not yet</option>
                    @for (division of divisions; track division.name) {
                      <option [value]="division.name">{{ division.name }}</option>
                    }
                  </select>
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="district">District</label>
                  <select
                    id="district"
                    class="form-select form-select-sm"
                    formControlName="district">
                    <option value="">
                      {{ districts().length ? 'Choose a district' : 'Choose a division first' }}
                    </option>
                    @for (district of districts(); track district) {
                      <option [value]="district">{{ district }}</option>
                    }
                  </select>
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="area">Area</label>
                  <input
                    id="area"
                    class="form-control form-control-sm"
                    type="text"
                    placeholder="Dhanmondi"
                    formControlName="area" />
                </div>

                <div class="col-12 col-md-6">
                  <label class="form-label small" for="landmark">Landmark</label>
                  <input
                    id="landmark"
                    class="form-control form-control-sm"
                    type="text"
                    formControlName="landmark" />
                </div>

                <div class="col-12">
                  <label class="form-label small" for="addressLine">House and road</label>
                  <input
                    id="addressLine"
                    class="form-control form-control-sm"
                    type="text"
                    formControlName="addressLine" />
                </div>
              </div>

              <!-- Optional to save, required to send: a draft is allowed to be
                   unfinished, but delivery cannot be priced without knowing
                   where it is going. -->
              <div class="form-text mt-2">
                A draft can be saved without this. Delivery is only priced once the
                address is here, and it has to be here before the quotation can be sent.
              </div>
            </div>

            <div class="border rounded p-3 mb-3">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                <h2 class="h6 text-uppercase text-muted small mb-0">What is being quoted</h2>
                <button
                  class="btn btn-sm btn-outline-dark ms-auto"
                  type="button"
                  (click)="addMadeToMeasure()">
                  Add a made-to-measure line
                </button>
              </div>

              <div class="mb-3">
                <label class="form-label small" for="catalogueSearch">
                  Add from the catalogue
                </label>
                <input
                  id="catalogueSearch"
                  class="form-control form-control-sm"
                  type="search"
                  autocomplete="off"
                  placeholder="Search a product or SKU"
                  [value]="pickerTerm()"
                  (input)="onPickerTerm($event)" />

                @if (picking()) {
                  <p class="small text-muted mt-2 mb-0">Looking…</p>
                } @else if (matches().length > 0) {
                  <ul class="list-group list-group-flush mt-2 wh-picker">
                    @for (match of matches(); track match.variantId) {
                      <li class="list-group-item px-0 py-2 d-flex align-items-center gap-2">
                        <span class="small">
                          {{ match.productName }}
                          <span class="text-muted">{{ match.variantName }}</span>
                          <span class="d-block text-muted font-monospace">{{ match.sku }}</span>
                        </span>
                        <button
                          class="btn btn-sm btn-outline-dark ms-auto"
                          type="button"
                          (click)="addFromCatalogue(match)">
                          Add
                        </button>
                      </li>
                    }
                  </ul>
                } @else if (pickerTerm().length > 1) {
                  <p class="small text-muted mt-2 mb-0">Nothing in the catalogue matches that.</p>
                }
              </div>

              @if (lines.length === 0) {
                <p class="small text-muted mb-0">
                  Nothing on it yet. A quotation needs at least one line before it can be
                  saved.
                </p>
              } @else {
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-0">
                    <thead>
                      <tr class="small text-muted">
                        <th scope="col">Item</th>
                        <th scope="col" class="text-end" style="width: 6rem">Qty</th>
                        <th scope="col" class="text-end" style="width: 9rem">Unit price</th>
                        <th scope="col" class="text-end" style="width: 7rem">Lead time</th>
                        <th scope="col"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of lines.controls; track line; let i = $index) {
                        <tr [formGroup]="asGroup(line)">
                          <td>
                            @if (isCatalogue(line)) {
                              <div class="small">{{ describe(line) }}</div>
                              <div class="small text-muted font-monospace">
                                {{ skuOf(line) }}
                              </div>
                            } @else {
                              <input
                                class="form-control form-control-sm"
                                type="text"
                                placeholder="Wardrobe built to the alcove, 7ft, segun"
                                aria-label="What this line is"
                                formControlName="description"
                                [class.is-invalid]="lineInvalid(line, 'description')" />
                              <!-- The customer's invoice will read exactly
                                   this. Nothing behind it to fall back on. -->
                              <div class="form-text">
                                This is what the invoice will say, word for word.
                              </div>
                            }
                          </td>

                          <td>
                            <input
                              class="form-control form-control-sm text-end"
                              type="number"
                              min="1"
                              max="9999"
                              aria-label="Quantity"
                              formControlName="quantity"
                              [class.is-invalid]="lineInvalid(line, 'quantity')" />
                          </td>

                          <td>
                            <input
                              class="form-control form-control-sm text-end"
                              type="number"
                              min="0"
                              aria-label="Unit price"
                              [placeholder]="isCatalogue(line) ? 'catalogue' : 'required'"
                              formControlName="unitPrice"
                              [class.is-invalid]="lineInvalid(line, 'unitPrice')" />
                          </td>

                          <td>
                            <input
                              class="form-control form-control-sm text-end"
                              type="number"
                              min="0"
                              max="3650"
                              placeholder="days"
                              aria-label="Lead time in days"
                              formControlName="leadTimeDays" />
                          </td>

                          <td class="text-end">
                            <button
                              class="btn btn-sm btn-link text-danger p-0"
                              type="button"
                              aria-label="Remove this line"
                              (click)="removeLine(i)">
                              Remove
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <div class="form-text mt-2">
                  A catalogue line with no price typed takes the catalogue's, so a
                  shop-wide price change is one edit rather than one per quotation.
                </div>
              }
            </div>
          </div>

          <div class="col-12 col-xl-4">
            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">Money</h2>

              <div class="mb-2">
                <label class="form-label small" for="discount">Discount (৳)</label>
                <input
                  id="discount"
                  class="form-control form-control-sm"
                  type="number"
                  min="0"
                  formControlName="discount" />
                <div class="form-text">A figure off the goods, not a percentage.</div>
              </div>

              <div class="mb-3">
                <label class="form-label small" for="deliveryFeeOverride">Delivery (৳)</label>
                <input
                  id="deliveryFeeOverride"
                  class="form-control form-control-sm"
                  type="number"
                  min="0"
                  placeholder="worked out"
                  formControlName="deliveryFeeOverride" />
                <div class="form-text">Leave empty and the products decide it.</div>
              </div>

              <dl class="row mb-0 small">
                <dt class="col-7 fw-normal text-muted">Goods, as typed</dt>
                <dd class="col-5 text-end mb-0">{{ typedGoods() | taka }}</dd>
              </dl>

              <!-- Deliberately not a grand total. VAT and delivery come from
                   the shop's own pricer, and a figure invented here would be
                   a second answer to the same question. -->
              <p class="form-text mb-0">
                VAT, delivery and any catalogue price left blank are worked out by the
                shop when this is saved. The real figures are on the quotation itself.
              </p>
            </div>

            <div class="border rounded p-3 mb-3">
              <h2 class="h6 text-uppercase text-muted small mb-3">Words</h2>

              <div class="mb-2">
                <label class="form-label small" for="notes">Notes for the customer</label>
                <textarea
                  id="notes"
                  class="form-control form-control-sm"
                  rows="3"
                  formControlName="notes"></textarea>
                <div class="form-text">They read this on the quotation.</div>
              </div>

              <div>
                <label class="form-label small" for="internalNotes">Notes for us</label>
                <textarea
                  id="internalNotes"
                  class="form-control form-control-sm"
                  rows="3"
                  formControlName="internalNotes"></textarea>
                <!-- Never leaves the admin panel: the customer's own view of
                     this quotation does not carry the field at all. -->
                <div class="form-text">The customer never sees this.</div>
              </div>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-dark" type="submit" [disabled]="busy()">
                {{ busy() ? 'Saving…' : 'Save draft' }}
              </button>
              <a class="btn btn-link" routerLink="/admin/quotations">Cancel</a>
            </div>
          </div>
        </div>
      </form>
    }
  `,
  styles: `
    /* A picker, not a page. Ten matches is plenty to choose from and the rest
       is what the search box is for. */
    .wh-picker {
      max-height: 16rem;
      overflow-y: auto;
    }
  `
})
export class AdminQuotationForm implements HasUnsavedChanges {
  private readonly api = inject(AdminQuotationService);
  private readonly stock = inject(AdminStockService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly divisions = DIVISIONS;

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly refusal = signal<string | null>(null);
  protected readonly districts = signal<readonly string[]>([]);

  protected readonly pickerTerm = signal('');
  protected readonly picking = signal(false);
  protected readonly matches = signal<StockLevel[]>([]);

  /** Set on load when editing; the API's update takes an id, not a number. */
  private quotationId: number | null = null;

  protected readonly quotationNumber = this.route.snapshot.paramMap.get('quotationNumber');

  protected readonly form = this.formBuilder.nonNullable.group({
    contactName: ['', [Validators.required, Validators.maxLength(120)]],
    contactPhone: ['', [Validators.required, Validators.maxLength(20)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(256)]],
    validUntil: [dhakaDate(DEFAULT_VALID_DAYS)],
    discount: [0, [Validators.min(0)]],
    deliveryFeeOverride: this.formBuilder.control<number | null>(null),
    notes: ['', Validators.maxLength(4000)],
    internalNotes: ['', Validators.maxLength(2000)],
    shippingAddress: this.formBuilder.nonNullable.group({
      division: [''],
      district: [''],
      area: ['', Validators.maxLength(120)],
      addressLine: ['', Validators.maxLength(400)],
      landmark: ['', Validators.maxLength(200)]
    }),
    lines: this.formBuilder.array<FormGroup>([])
  });

  /** What the screen adds up: quantity times price, where a price is typed. */
  protected readonly typedGoods = signal(0);

  private pickerTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    if (this.quotationNumber) {
      this.load(this.quotationNumber);
    }

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recount());
  }

  protected get lines(): FormArray<FormGroup> {
    return this.form.controls.lines;
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.busy();
  }

  protected asGroup(control: unknown): FormGroup {
    return control as FormGroup;
  }

  protected isCatalogue(line: unknown): boolean {
    return this.asGroup(line).getRawValue().productVariantId !== null;
  }

  protected describe(line: unknown): string {
    return this.asGroup(line).getRawValue().description ?? '';
  }

  protected skuOf(line: unknown): string {
    return this.asGroup(line).getRawValue().sku ?? '';
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected lineInvalid(line: unknown, control: string): boolean {
    const field = this.asGroup(line).get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected onDivision(): void {
    const address = this.form.controls.shippingAddress;

    this.districts.set(districtsOf(address.controls.division.value));
    address.controls.district.setValue('');
  }

  protected onPickerTerm(event: Event): void {
    const term = (event.target as HTMLInputElement).value;

    this.pickerTerm.set(term);
    clearTimeout(this.pickerTimer);

    if (term.trim().length < 2) {
      this.matches.set([]);

      return;
    }

    this.pickerTimer = setTimeout(() => {
      this.picking.set(true);

      this.stock.search({ term: term.trim(), page: 1, pageSize: 10 }).subscribe({
        next: result => {
          this.matches.set(result.items);
          this.picking.set(false);
        },
        error: () => this.picking.set(false)
      });
    }, 300);
  }

  /**
   * A catalogue line.
   *
   * The description and SKU are copied in so the row reads as something, but
   * they are only for this screen: the API fills both from the variant itself,
   * which is what stops a quotation describing a bed the catalogue has since
   * renamed.
   */
  protected addFromCatalogue(variant: StockLevel): void {
    this.lines.push(
      this.lineGroup({
        productVariantId: variant.variantId,
        description: `${variant.productName} — ${variant.variantName}`,
        sku: variant.sku,
        quantity: 1,
        unitPrice: null,
        leadTimeDays: null
      })
    );

    this.form.markAsDirty();
    this.pickerTerm.set('');
    this.matches.set([]);
  }

  /** A line with nothing behind it: its own words, and its own price. */
  protected addMadeToMeasure(): void {
    this.lines.push(
      this.lineGroup({
        productVariantId: null,
        description: '',
        sku: null,
        quantity: 1,
        unitPrice: null,
        leadTimeDays: null
      })
    );

    this.form.markAsDirty();
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    if (this.lines.length === 0) {
      this.refusal.set('A quotation needs at least one line.');

      return;
    }

    this.busy.set(true);
    this.refusal.set(null);

    const dto = this.toDto();
    const request = this.quotationId
      ? this.api.update(this.quotationId, dto)
      : this.api.create(dto);

    request.subscribe({
      next: response => {
        this.busy.set(false);

        if (response.isSuccess && response.data) {
          this.form.markAsPristine();
          this.toast.success('Saved as a draft.');

          // Straight to the quotation itself, because that is where the real
          // figures are: this screen never worked out the VAT or the delivery.
          this.router.navigate(['/admin/quotations', response.data.quotationNumber]);

          return;
        }

        // "The discount is larger than the goods", "that variant is gone" —
        // each is about something on this page, and belongs on it.
        this.refusal.set(response.message || 'That quotation could not be saved.');
      },
      error: () => {
        this.busy.set(false);
        this.refusal.set('We could not reach the shop. Please try again.');
      }
    });
  }

  private lineGroup(value: {
    productVariantId: number | null;
    description: string;
    sku: string | null;
    quantity: number;
    unitPrice: number | null;
    leadTimeDays: number | null;
  }): FormGroup {
    const catalogue = value.productVariantId !== null;

    return this.formBuilder.group({
      productVariantId: this.formBuilder.control<number | null>(value.productVariantId),
      // Kept on the group for both kinds, and sent for neither catalogue line:
      // it is what this screen draws the row from.
      sku: this.formBuilder.control<string | null>(value.sku),
      description: this.formBuilder.control<string>(value.description, {
        nonNullable: true,
        validators: catalogue
          ? [Validators.maxLength(500)]
          : [Validators.required, Validators.maxLength(500)]
      }),
      quantity: this.formBuilder.control<number>(value.quantity, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.max(9999)]
      }),
      // A made-to-measure line has no catalogue to fall back on, so a price is
      // not optional there the way it is on a bed the shop already sells.
      unitPrice: this.formBuilder.control<number | null>(
        value.unitPrice,
        catalogue ? [Validators.min(0)] : [Validators.required, Validators.min(0)]
      ),
      leadTimeDays: this.formBuilder.control<number | null>(value.leadTimeDays, [
        Validators.min(0),
        Validators.max(3650)
      ])
    });
  }

  private toDto(): SaveQuotation {
    const value = this.form.getRawValue();
    const address = value.shippingAddress;
    const complete = !!address.division && !!address.district && !!address.addressLine;

    const lines: SaveQuotationLine[] = this.lines.controls.map(group => {
      const line = group.getRawValue();

      return {
        productVariantId: line.productVariantId,
        // A catalogue line sends no words of its own: the API takes them from
        // the variant, so the quotation cannot describe a bed by a name the
        // catalogue no longer uses.
        description: line.productVariantId === null ? line.description.trim() : null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        leadTimeDays: line.leadTimeDays
      };
    });

    return {
      contactName: value.contactName.trim(),
      contactPhone: value.contactPhone.trim(),
      contactEmail: value.contactEmail.trim() || null,
      // Half an address is worse than none: it would be priced as somewhere.
      shippingAddress: complete
        ? {
            division: address.division,
            district: address.district,
            area: address.area.trim() || null,
            addressLine: address.addressLine.trim(),
            landmark: address.landmark.trim() || null
          }
        : null,
      validUntil: value.validUntil || null,
      discount: value.discount || 0,
      deliveryFeeOverride: value.deliveryFeeOverride,
      notes: value.notes.trim() || null,
      internalNotes: value.internalNotes.trim() || null,
      lines
    };
  }

  private recount(): void {
    const goods = this.lines.controls.reduce((running, group) => {
      const line = group.getRawValue();

      return running + (line.unitPrice ?? 0) * (line.quantity ?? 0);
    }, 0);

    this.typedGoods.set(goods);
  }

  private load(quotationNumber: string): void {
    this.loading.set(true);

    this.api.get(quotationNumber).subscribe({
      next: quotation => {
        this.loading.set(false);

        if (!quotation) {
          this.toast.error('No quotation with that number.');
          this.router.navigateByUrl('/admin/quotations');

          return;
        }

        // A sent quotation is a price somebody is holding. Pulling it back to
        // draft is how it is changed, and that happens on the quotation
        // itself where the trail is.
        if (quotation.status !== 'Draft') {
          this.toast.error('Only a draft can be edited. Put it back to draft first.');
          this.router.navigate(['/admin/quotations', quotationNumber]);

          return;
        }

        this.apply(quotation);
      },
      error: () => this.loading.set(false)
    });
  }

  private apply(quotation: Quotation): void {
    this.quotationId = quotation.id;

    const address = quotation.shippingAddress;

    this.districts.set(districtsOf(address?.division));

    this.form.patchValue({
      contactName: quotation.contactName,
      contactPhone: quotation.contactPhone,
      contactEmail: quotation.contactEmail ?? '',
      validUntil: quotation.validUntil,
      discount: quotation.discountTotal,
      deliveryFeeOverride: quotation.deliveryOverridden ? quotation.deliveryFee : null,
      notes: quotation.notes ?? '',
      internalNotes: quotation.internalNotes ?? '',
      shippingAddress: {
        division: address?.division ?? '',
        district: address?.district ?? '',
        area: address?.area ?? '',
        addressLine: address?.addressLine ?? '',
        landmark: address?.landmark ?? ''
      }
    });

    this.lines.clear();

    for (const line of quotation.lines) {
      this.lines.push(
        this.lineGroup({
          productVariantId: line.productVariantId ?? null,
          description: line.description,
          sku: line.sku ?? null,
          quantity: line.quantity,
          // Filled in on the way back, because by now it is a price somebody
          // quoted rather than a blank meaning "whatever the catalogue says".
          unitPrice: line.unitPrice,
          leadTimeDays: line.leadTimeDays ?? null
        })
      );
    }

    this.form.markAsPristine();
    this.recount();
  }
}

/**
 * A Dhaka date, so many days from today.
 *
 * Not the browser's: a laptop set to another zone would offer a fortnight that
 * starts on the wrong day, and "stands until" is a date the shop is held to.
 */
function dhakaDate(offsetDays: number): string {
  const dhaka = new Date(Date.now() + 6 * 60 * 60 * 1000 + offsetDays * 86_400_000);

  return dhaka.toISOString().slice(0, 10);
}
