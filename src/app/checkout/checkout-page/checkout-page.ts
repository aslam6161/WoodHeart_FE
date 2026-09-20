import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AccountService } from '../../_services/account.service';
import { CartService } from '../../_services/cart.service';
import { CheckoutService } from '../../_services/checkout.service';
import { SeoService } from '../../_services/seo.service';
import { ToastService } from '../../_services/toast.service';
import { DIVISIONS, districtsOf } from '../../_models/bangladesh';
import { DeliveryZone } from '../../_models/cart';
import { ErrorCodes, GeneralResponse } from '../../_models/generalResponse';
import { DeliveryAddress, PaymentMethod, PlaceOrder } from '../../_models/order';
import { TakaPipe } from '../../_pipes/taka.pipe';

/**
 * Checkout: who, where, how to pay, place the order.
 *
 * One page rather than a wizard. A furniture order here is a name, a phone
 * number, an address and "cash on delivery" — four steps of chrome around
 * that would be four chances to leave. Everything is on one screen with the
 * basket summary beside it, and the button at the bottom says the total.
 *
 * <b>Guest first.</b> Nothing on this page needs an account. A signed-in
 * customer gets their name and number filled in; everyone else types them,
 * which is most people.
 *
 * <b>The order is placed exactly once.</b> The page mints an idempotency key
 * when it opens and sends it with every attempt. A double-tap, a retry after
 * a timeout, a browser that resends a POST — all reach the API with the same
 * key and are answered with the order already made. See CheckoutService.
 */
@Component({
  selector: 'app-checkout-page',
  imports: [ReactiveFormsModule, RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <h1 class="h3 mb-4">Checkout</h1>

      @if (!cart.loaded()) {
        <p class="text-muted">Loading your basket…</p>
      } @else if (cart.isEmpty()) {
        <div class="text-center py-5">
          <p class="lead mb-1">There is nothing to check out.</p>
          <p class="text-muted mb-4">Your basket is empty.</p>
          <a class="btn btn-dark" routerLink="/products">Browse the collection</a>
        </div>
      } @else {
        @let basket = cart.cart();

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="row g-4">
            <div class="col-12 col-lg-7">
              <!-- ============ Contact ============ -->
              <section class="mb-4">
                <h2 class="h6 text-uppercase text-muted">Contact</h2>

                <div class="row g-3">
                  <div class="col-12 col-md-6">
                    <label class="form-label" for="contactName">Your name</label>
                    <input
                      id="contactName"
                      class="form-control"
                      type="text"
                      autocomplete="name"
                      formControlName="contactName"
                      [class.is-invalid]="invalid('contactName')" />
                    @if (invalid('contactName')) {
                      <div class="invalid-feedback">{{ messageFor('contactName') }}</div>
                    }
                  </div>

                  <div class="col-12 col-md-6">
                    <label class="form-label" for="contactPhone">Mobile number</label>
                    <input
                      id="contactPhone"
                      class="form-control"
                      type="tel"
                      autocomplete="tel"
                      inputmode="numeric"
                      placeholder="01712345678"
                      formControlName="contactPhone"
                      [class.is-invalid]="invalid('contactPhone')" />
                    @if (invalid('contactPhone')) {
                      <div class="invalid-feedback">{{ messageFor('contactPhone') }}</div>
                    } @else {
                      <div class="form-text">The rider will call this number.</div>
                    }
                  </div>

                  <div class="col-12">
                    <label class="form-label" for="contactEmail">
                      Email <span class="text-muted">(optional)</span>
                    </label>
                    <input
                      id="contactEmail"
                      class="form-control"
                      type="email"
                      autocomplete="email"
                      formControlName="contactEmail"
                      [class.is-invalid]="invalid('contactEmail')" />
                    @if (invalid('contactEmail')) {
                      <div class="invalid-feedback">{{ messageFor('contactEmail') }}</div>
                    }
                  </div>
                </div>
              </section>

              <!-- ============ Address ============ -->
              <section class="mb-4" formGroupName="shippingAddress">
                <h2 class="h6 text-uppercase text-muted">Delivery address</h2>

                <div class="row g-3">
                  <div class="col-12 col-md-6">
                    <label class="form-label" for="division">Division</label>
                    <select
                      id="division"
                      class="form-select"
                      formControlName="division"
                      [class.is-invalid]="invalid('shippingAddress.division')">
                      <option value="" disabled>Choose a division</option>
                      @for (division of divisions; track division.name) {
                        <option [value]="division.name">{{ division.name }}</option>
                      }
                    </select>
                    @if (invalid('shippingAddress.division')) {
                      <div class="invalid-feedback">{{ messageFor('shippingAddress.division') }}</div>
                    }
                  </div>

                  <div class="col-12 col-md-6">
                    <label class="form-label" for="district">District</label>
                    <select
                      id="district"
                      class="form-select"
                      formControlName="district"
                      [class.is-invalid]="invalid('shippingAddress.district')">
                      <option value="" disabled>
                        {{ districts().length ? 'Choose a district' : 'Choose a division first' }}
                      </option>
                      @for (district of districts(); track district) {
                        <option [value]="district">{{ district }}</option>
                      }
                    </select>
                    @if (invalid('shippingAddress.district')) {
                      <div class="invalid-feedback">{{ messageFor('shippingAddress.district') }}</div>
                    }
                  </div>

                  <div class="col-12 col-md-6">
                    <label class="form-label" for="upazila">
                      Upazila / thana <span class="text-muted">(optional)</span>
                    </label>
                    <input
                      id="upazila"
                      class="form-control"
                      type="text"
                      autocomplete="address-level3"
                      formControlName="upazila" />
                  </div>

                  <div class="col-12 col-md-6">
                    <label class="form-label" for="area">
                      Area <span class="text-muted">(optional)</span>
                    </label>
                    <input
                      id="area"
                      class="form-control"
                      type="text"
                      placeholder="Dhanmondi, Bashundhara R/A"
                      formControlName="area" />
                  </div>

                  <div class="col-12">
                    <label class="form-label" for="addressLine">House, road, flat</label>
                    <input
                      id="addressLine"
                      class="form-control"
                      type="text"
                      autocomplete="street-address"
                      placeholder="House 12, Road 3, Flat 4B"
                      formControlName="addressLine"
                      [class.is-invalid]="invalid('shippingAddress.addressLine')" />
                    @if (invalid('shippingAddress.addressLine')) {
                      <div class="invalid-feedback">
                        {{ messageFor('shippingAddress.addressLine') }}
                      </div>
                    }
                  </div>

                  <div class="col-12 col-md-8">
                    <label class="form-label" for="landmark">
                      Landmark <span class="text-muted">(optional)</span>
                    </label>
                    <input
                      id="landmark"
                      class="form-control"
                      type="text"
                      placeholder="Opposite Popular Diagnostic"
                      formControlName="landmark" />
                    <!-- Not a nicety. Street numbering is inconsistent across
                         much of the country and riders navigate by "beside the
                         Jame Masjid". Without it there is a phone call. -->
                    <div class="form-text">How the rider finds the building.</div>
                  </div>

                  <div class="col-12 col-md-4">
                    <label class="form-label" for="postcode">
                      Postcode <span class="text-muted">(optional)</span>
                    </label>
                    <input
                      id="postcode"
                      class="form-control"
                      type="text"
                      inputmode="numeric"
                      autocomplete="postal-code"
                      formControlName="postcode" />
                  </div>
                </div>
              </section>

              <section class="mb-4">
                <label class="form-label" for="deliveryNote">
                  Delivery note <span class="text-muted">(optional)</span>
                </label>
                <textarea
                  id="deliveryNote"
                  class="form-control"
                  rows="2"
                  placeholder="A floor, a time, a gate code"
                  formControlName="deliveryNote"></textarea>
              </section>

              <!-- ============ Payment ============ -->
              <section class="mb-4">
                <h2 class="h6 text-uppercase text-muted">Payment</h2>

                @if (methodsLoading()) {
                  <p class="small text-muted mb-0">Checking payment options for your area…</p>
                } @else if (!methods().length) {
                  <div class="alert alert-warning py-2 small mb-0" role="alert">
                    No payment method is available for this address. Please call us and we
                    will arrange it.
                  </div>
                } @else {
                  @for (method of methods(); track method.code) {
                    <div class="form-check border rounded p-3 ps-5 mb-2">
                      <input
                        class="form-check-input"
                        type="radio"
                        formControlName="paymentMethodCode"
                        [id]="'pay-' + method.code"
                        [value]="method.code" />
                      <label class="form-check-label w-100" [for]="'pay-' + method.code">
                        <span class="fw-semibold">{{ method.displayName }}</span>
                        @if (method.surcharge > 0) {
                          <span class="text-muted"> · +{{ method.surcharge | taka }}</span>
                        }
                        @if (method.description; as description) {
                          <span class="d-block small text-muted">{{ description }}</span>
                        }
                      </label>
                    </div>
                  }
                }
              </section>
            </div>

            <!-- ============ Summary ============ -->
            <div class="col-12 col-lg-5">
              <div class="border rounded p-3 wh-summary">
                <h2 class="h6 text-uppercase text-muted">Your order</h2>

                <ul class="list-unstyled small mb-3">
                  @for (line of basket.lines; track line.id) {
                    <li class="d-flex justify-content-between gap-2 py-1">
                      <span class="text-truncate">
                        {{ line.quantity }} &times; {{ line.productNameEn }}
                        <span class="text-muted">{{ line.variantName }}</span>
                      </span>
                      <span class="flex-shrink-0">{{ line.lineTotal | taka }}</span>
                    </li>
                  }
                </ul>

                <dl class="row small mb-0">
                  <dt class="col-7 fw-normal">Subtotal</dt>
                  <dd class="col-5 text-end">{{ basket.totals.subtotal | taka }}</dd>

                  @if (basket.totals.discountTotal > 0) {
                    <dt class="col-7 fw-normal">Discount</dt>
                    <dd class="col-5 text-end">&minus;{{ basket.totals.discountTotal | taka }}</dd>
                  }

                  <dt class="col-7 fw-normal">Delivery</dt>
                  <dd class="col-5 text-end">
                    @if (basket.totals.deliveryPending) {
                      <span class="text-muted">enter your address</span>
                    } @else if (basket.totals.deliveryWaived) {
                      <span class="text-success">Free</span>
                    } @else {
                      {{ basket.totals.deliveryFee | taka }}
                    }
                  </dd>

                  @if (surcharge(); as extra) {
                    <dt class="col-7 fw-normal">Payment charge</dt>
                    <dd class="col-5 text-end">{{ extra | taka }}</dd>
                  }
                </dl>

                <hr />

                <div class="d-flex justify-content-between align-items-baseline">
                  <span class="fw-semibold">Total</span>
                  <span class="h5 mb-0">{{ total() | taka }}</span>
                </div>

                @if (basket.totals.vatAmount > 0) {
                  <p class="small text-muted mb-3">
                    {{ basket.totals.pricesIncludeVat ? 'Includes' : 'Plus' }} VAT of
                    {{ basket.totals.vatAmount | taka }}
                  </p>
                }

                @if (failure()) {
                  <div class="alert alert-danger py-2 small" role="alert">{{ failure() }}</div>
                }

                <button
                  class="btn btn-dark w-100 btn-lg"
                  type="submit"
                  [disabled]="placing() || !methods().length || basket.hasUnavailableLines">
                  {{ placing() ? 'Placing your order…' : 'Place order · ' + (total() | taka) }}
                </button>

                <p class="small text-muted text-center mt-2 mb-0">
                  We will confirm by SMS to the number above.
                </p>
              </div>
            </div>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    @media (min-width: 992px) {
      .wh-summary {
        position: sticky;
        top: 5rem;
      }
    }
  `
})
export class CheckoutPage implements OnInit {
  protected readonly cart = inject(CartService);
  private readonly checkout = inject(CheckoutService);
  private readonly account = inject(AccountService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly divisions = DIVISIONS;

  protected readonly form = this.formBuilder.nonNullable.group({
    contactName: ['', [Validators.required, Validators.maxLength(120)]],
    contactPhone: ['', [Validators.required, Validators.maxLength(20)]],
    contactEmail: ['', [Validators.email, Validators.maxLength(256)]],
    shippingAddress: this.formBuilder.nonNullable.group({
      division: ['', Validators.required],
      district: ['', Validators.required],
      upazila: ['', Validators.maxLength(80)],
      area: ['', Validators.maxLength(120)],
      addressLine: ['', [Validators.required, Validators.maxLength(400)]],
      landmark: ['', Validators.maxLength(200)],
      postcode: ['', Validators.maxLength(10)]
    }),
    deliveryNote: ['', Validators.maxLength(500)],
    paymentMethodCode: ['', Validators.required]
  });

  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly methodsLoading = signal(false);
  protected readonly placing = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** Per-field messages the API sent back, keyed by control path. */
  private readonly fieldErrors = signal<Record<string, string[]>>({});

  private readonly division = signal('');
  private readonly chosenMethod = signal('');

  protected readonly districts = computed(() => districtsOf(this.division()));

  /** What the chosen payment method adds. Zero for cash on delivery. */
  protected readonly surcharge = computed(
    () => this.methods().find(m => m.code === this.chosenMethod())?.surcharge ?? 0
  );

  /**
   * The figure on the button.
   *
   * The basket's total plus the payment method's charge — the one sum the
   * client does make, because the API's cart total cannot know which method
   * will be chosen. The API recomputes everything at placement and the
   * confirmation page shows its figure, not this one.
   */
  protected readonly total = computed(() => this.cart.cart().totals.grandTotal + this.surcharge());

  /**
   * One key per visit to this page.
   *
   * Minted in the field initialiser so it exists before the first submit and
   * survives a failed attempt. Replaced only after an order is placed.
   */
  private idempotencyKey = this.checkout.newIdempotencyKey();

  constructor() {
    this.seo.apply({ title: 'Checkout', canonicalPath: '/checkout', noIndex: true });

    this.cart.ensureLoaded();

    // A signed-in customer should not have to type what the shop already
    // knows. Runs when the session restore lands, which may be after the
    // form is on screen.
    effect(() => {
      const user = this.account.user();

      if (user && !this.form.controls.contactName.dirty) {
        this.form.patchValue({
          contactName: user.fullName ?? '',
          contactPhone: user.phoneNumber,
          contactEmail: user.email ?? ''
        });
      }
    });
  }

  ngOnInit(): void {
    const address = this.form.controls.shippingAddress;

    // Changing division empties the district: a Sylhet district under a
    // Dhaka division is an address nobody can deliver to.
    address.controls.division.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(division => {
        this.division.set(division);
        address.controls.district.setValue('');
      });

    this.form.controls.paymentMethodCode.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(code => this.chosenMethod.set(code));

    // The district decides the delivery zone, and the zone decides both the
    // delivery charge and which payment methods apply. So a district change
    // does two things: tells the basket where it is going (the summary
    // updates), and asks the API what ways of paying that address may use.
    address.valueChanges
      .pipe(
        debounceTime(150),
        distinctUntilChanged((a, b) => a.district === b.district && a.upazila === b.upazila),
        switchMap(value => {
          if (!value.division || !value.district) {
            return of(null);
          }

          const zone = this.resolveZone(value.district, value.upazila);

          if (this.cart.cart().deliveryZone !== zone) {
            this.cart.setDeliveryZone(zone).pipe(catchError(() => of(null))).subscribe();
          }

          this.methodsLoading.set(true);

          return this.checkout
            .getPaymentMethods(this.toAddress(value))
            .pipe(catchError(() => of([] as PaymentMethod[])));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(methods => {
        this.methodsLoading.set(false);

        if (methods === null) {
          return;
        }

        this.methods.set(methods);

        // Keep the choice if it is still offered; otherwise pick the first,
        // which is the shop's preferred order rather than alphabetical.
        const current = this.form.controls.paymentMethodCode.value;

        if (!methods.some(m => m.code === current)) {
          this.form.controls.paymentMethodCode.setValue(methods[0]?.code ?? '');
        }
      });
  }

  protected invalid(path: string): boolean {
    const control = this.form.get(path);

    return (
      (!!control?.invalid && (control.touched || control.dirty)) || !!this.fieldErrors()[path]
    );
  }

  protected messageFor(path: string): string {
    const fromServer = this.fieldErrors()[path];

    if (fromServer?.length) {
      return fromServer[0];
    }

    switch (path) {
      case 'contactName':
        return 'Enter your name.';
      case 'contactPhone':
        return 'Enter the mobile number the rider should call.';
      case 'contactEmail':
        return 'That does not look like an email address.';
      case 'shippingAddress.division':
        return 'Choose a division.';
      case 'shippingAddress.district':
        return 'Choose a district.';
      case 'shippingAddress.addressLine':
        return 'Enter the house and road.';
      default:
        return 'Please check this field.';
    }
  }

  protected submit(): void {
    this.failure.set(null);
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.placing()) {
      return;
    }

    this.placing.set(true);

    const value = this.form.getRawValue();

    const dto: PlaceOrder = {
      contactName: value.contactName.trim(),
      contactPhone: value.contactPhone.trim(),
      contactEmail: this.blankToNull(value.contactEmail),
      shippingAddress: this.toAddress(value.shippingAddress),
      paymentMethodCode: value.paymentMethodCode,
      deliveryNote: this.blankToNull(value.deliveryNote)
    };

    this.checkout
      .placeOrder(dto, this.idempotencyKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: placed => {
          // The API has retired the basket. Forget it here before navigating,
          // so the header does not show "3" over a basket that is now an order.
          this.cart.forget();
          this.idempotencyKey = this.checkout.newIdempotencyKey();

          if (placed.redirectUrl) {
            // A gateway that takes the customer away to pay. Not used by cash
            // on delivery; here for bKash in Phase 5.
            window.location.assign(placed.redirectUrl);
            return;
          }

          this.router.navigate(['/checkout/confirmation', placed.orderNumber], {
            // The phone is what lets a guest read the order back. Router
            // state rather than the URL, so the number is not in the address
            // bar, the history or a shared link.
            state: { contactPhone: dto.contactPhone, alreadyPlaced: placed.alreadyPlaced }
          });
        },
        error: (error: HttpErrorResponse) => {
          this.placing.set(false);

          const body = error.error as GeneralResponse | undefined;

          this.fieldErrors.set(body?.errors ?? {});

          switch (body?.errorCode) {
            case ErrorCodes.validationFailed:
              this.failure.set(body?.message ?? 'Please correct the highlighted fields.');
              this.form.markAllAsTouched();
              break;

            case ErrorCodes.cartEmpty:
            case ErrorCodes.lineNotPurchasable:
              // The basket changed under the page — something sold out, or a
              // second tab checked it out. Re-read it and let the page fall
              // through to whichever state it is now in.
              this.cart.refresh().subscribe();
              this.failure.set(body?.message ?? 'Your basket has changed. Please review it.');
              break;

            default:
              // A 409 and a 400 have already been toasted by the interceptor;
              // repeating the sentence beside the button keeps it readable
              // after the toast has gone.
              this.failure.set(body?.message ?? 'We could not place your order. Please try again.');
              break;
          }
        }
      });
  }

  /**
   * Which zone an address falls in, for pricing the summary.
   *
   * Mirrors `DeliveryZoneResolver` on the API: Dhaka district is inside Dhaka
   * except for the five outlying upazilas. The API applies its own copy at
   * placement and its answer is the one that is charged; this exists only so
   * the delivery line and the total on the button match that answer before
   * the customer presses it.
   */
  private resolveZone(district: string, upazila: string | undefined): DeliveryZone {
    const outlying = ['savar', 'dhamrai', 'nawabganj', 'dohar', 'keraniganj'];

    if (district.trim().toLowerCase() !== 'dhaka') {
      return 'OutsideDhaka';
    }

    return outlying.includes((upazila ?? '').trim().toLowerCase()) ? 'OutsideDhaka' : 'InsideDhaka';
  }

  private toAddress(value: {
    division?: string;
    district?: string;
    upazila?: string;
    area?: string;
    addressLine?: string;
    landmark?: string;
    postcode?: string;
  }): DeliveryAddress {
    return {
      division: value.division ?? '',
      district: value.district ?? '',
      upazila: this.blankToNull(value.upazila),
      area: this.blankToNull(value.area),
      addressLine: (value.addressLine ?? '').trim(),
      landmark: this.blankToNull(value.landmark),
      postcode: this.blankToNull(value.postcode)
    };
  }

  private blankToNull(value: string | undefined): string | null {
    const trimmed = (value ?? '').trim();

    return trimmed.length ? trimmed : null;
  }
}
