import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CartService } from '../../_services/cart.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { SeoService } from '../../_services/seo.service';
import { CartLine, DeliveryZone, MAX_QUANTITY_PER_LINE } from '../../_models/cart';
import { TakaPipe } from '../../_pipes/taka.pipe';

/**
 * The basket page.
 *
 * <b>Every number on it comes from the API.</b> The lines, the VAT, the
 * delivery charge and the total are whatever `GET /api/cart` last answered;
 * changing a quantity replaces the whole basket with the API's reply rather
 * than adjusting a figure locally. It is the same rule as the invoice — the
 * client is never the thing that decides what a customer pays.
 *
 * Delivery is asked about here rather than at checkout, because it is the
 * figure most likely to change the customer's mind. A basket that says
 * "৳45,000 plus delivery" and a checkout that says "৳49,500" is the moment an
 * order is abandoned; asking "inside or outside Dhaka?" on this page makes
 * the total on the button the total they will pay.
 */
@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <h1 class="h3 mb-4">Your basket</h1>

      @if (!cart.loaded()) {
        <p class="text-muted">Loading your basket…</p>
      } @else if (cart.isEmpty()) {
        <div class="text-center py-5">
          <p class="lead mb-1">Your basket is empty.</p>
          <p class="text-muted mb-4">Nothing in it yet — the collection is a click away.</p>
          <a class="btn btn-dark" routerLink="/products">Browse the collection</a>
        </div>
      } @else {
        @let basket = cart.cart();

        @if (basket.hasPriceChanges) {
          <!-- Said once, here, rather than left for the customer to notice a
               number that is not the one they remember. -->
          <div class="alert alert-warning py-2 small" role="status">
            One or more prices have changed since you added them. The prices shown are
            what you will be charged.
          </div>
        }

        @if (basket.hasUnavailableLines) {
          <div class="alert alert-danger py-2 small" role="alert">
            Something in your basket is no longer available. Remove it to continue to
            checkout.
          </div>
        }

        <div class="row g-4">
          <div class="col-12 col-lg-8">
            <ul class="list-unstyled mb-0">
              @for (line of basket.lines; track line.id) {
                <li
                  class="d-flex gap-3 py-3 border-bottom"
                  [class.opacity-50]="!line.isAvailable">
                  <a
                    class="flex-shrink-0"
                    [routerLink]="['/products', line.productSlug]"
                    tabindex="-1"
                    aria-hidden="true">
                    @if (thumb(line); as src) {
                      <img
                        class="rounded border wh-thumb"
                        [src]="src"
                        alt=""
                        width="96"
                        height="96"
                        loading="lazy" />
                    } @else {
                      <div class="rounded border wh-thumb wh-thumb-empty">
                        {{ line.productNameEn.charAt(0).toUpperCase() }}
                      </div>
                    }
                  </a>

                  <div class="flex-grow-1 min-w-0">
                    <a
                      class="fw-semibold text-dark text-decoration-none"
                      [routerLink]="['/products', line.productSlug]">
                      {{ line.productNameEn }}
                    </a>
                    <div class="small text-muted">{{ line.variantName }}</div>

                    @if (!line.isAvailable) {
                      <div class="small text-danger">No longer available</div>
                    } @else if (line.leadTimeDays) {
                      <div class="small text-muted">
                        Made to order &middot; about {{ line.leadTimeDays }} working days
                      </div>
                    }

                    <div class="d-flex flex-wrap align-items-center gap-3 mt-2">
                      <div
                        class="input-group input-group-sm wh-qty"
                        role="group"
                        [attr.aria-label]="'Quantity of ' + line.productNameEn">
                        <button
                          class="btn btn-outline-secondary"
                          type="button"
                          aria-label="One fewer"
                          [disabled]="busyLine() === line.id || line.quantity <= 1"
                          (click)="setQuantity(line, line.quantity - 1)">
                          &minus;
                        </button>
                        <span class="form-control text-center" aria-live="polite">
                          {{ line.quantity }}
                        </span>
                        <button
                          class="btn btn-outline-secondary"
                          type="button"
                          aria-label="One more"
                          [disabled]="
                            busyLine() === line.id ||
                            !line.isAvailable ||
                            line.quantity >= maxQuantity
                          "
                          (click)="setQuantity(line, line.quantity + 1)">
                          +
                        </button>
                      </div>

                      <button
                        class="btn btn-link btn-sm text-muted p-0"
                        type="button"
                        [disabled]="busyLine() === line.id"
                        (click)="remove(line)">
                        Remove
                      </button>
                    </div>
                  </div>

                  <div class="text-end flex-shrink-0">
                    <div class="fw-semibold">{{ line.lineTotal | taka }}</div>

                    @if (line.quantity > 1) {
                      <div class="small text-muted">{{ line.unitPrice | taka }} each</div>
                    }

                    @if (line.priceChanged) {
                      <div class="small text-warning-emphasis">
                        was {{ line.unitPriceAtAdd | taka }}
                      </div>
                    }
                  </div>
                </li>
              }
            </ul>
          </div>

          <div class="col-12 col-lg-4">
            <div class="border rounded p-3 wh-summary">
              <h2 class="h6 text-uppercase text-muted">Summary</h2>

              <fieldset class="mb-3">
                <legend class="small fw-semibold mb-1">Delivering to</legend>
                <div class="btn-group w-100" role="group">
                  <input
                    type="radio"
                    class="btn-check"
                    id="zone-inside"
                    name="zone"
                    [checked]="basket.deliveryZone === 'InsideDhaka'"
                    [disabled]="zoneBusy()"
                    (change)="chooseZone('InsideDhaka')" />
                  <label class="btn btn-outline-dark btn-sm" for="zone-inside">Inside Dhaka</label>

                  <input
                    type="radio"
                    class="btn-check"
                    id="zone-outside"
                    name="zone"
                    [checked]="basket.deliveryZone === 'OutsideDhaka'"
                    [disabled]="zoneBusy()"
                    (change)="chooseZone('OutsideDhaka')" />
                  <label class="btn btn-outline-dark btn-sm" for="zone-outside">
                    Outside Dhaka
                  </label>
                </div>
              </fieldset>

              <dl class="row small mb-0">
                <dt class="col-7 fw-normal">
                  Subtotal ({{ basket.totals.itemCount }}
                  {{ basket.totals.itemCount === 1 ? 'item' : 'items' }})
                </dt>
                <dd class="col-5 text-end">{{ basket.totals.subtotal | taka }}</dd>

                @if (basket.totals.discountTotal > 0) {
                  <dt class="col-7 fw-normal">Discount</dt>
                  <dd class="col-5 text-end">&minus;{{ basket.totals.discountTotal | taka }}</dd>
                }

                <dt class="col-7 fw-normal">Delivery</dt>
                <dd class="col-5 text-end">
                  @if (basket.totals.deliveryPending) {
                    <span class="text-muted">choose an area</span>
                  } @else if (basket.totals.deliveryWaived) {
                    <span class="text-success">Free</span>
                  } @else {
                    {{ basket.totals.deliveryFee | taka }}
                  }
                </dd>

                @if (basket.totals.deliveryOverridden) {
                  <dd class="col-12 text-muted mb-0">Delivery adjusted by WoodHeart.</dd>
                }
              </dl>

              <hr />

              <div class="d-flex justify-content-between align-items-baseline">
                <span class="fw-semibold">Total</span>
                <span class="h5 mb-0">{{ basket.totals.grandTotal | taka }}</span>
              </div>

              <!-- The VAT figure is inside the total, and this line says so.
                   Printing it as a row above the total, as an exclusive-VAT
                   shop would, invites a reader to add it on twice. -->
              @if (basket.totals.vatAmount > 0) {
                <p class="small text-muted mb-3">
                  {{ basket.totals.pricesIncludeVat ? 'Includes' : 'Plus' }} VAT of
                  {{ basket.totals.vatAmount | taka }}
                </p>
              }

              <a
                class="btn btn-dark w-100"
                routerLink="/checkout"
                [class.disabled]="basket.hasUnavailableLines"
                [attr.aria-disabled]="basket.hasUnavailableLines || null">
                Continue to checkout
              </a>

              @if (basket.totals.deliveryPending) {
                <p class="small text-muted text-center mt-2 mb-0">
                  Delivery is added once we know where it is going.
                </p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .wh-thumb {
      width: 96px;
      height: 96px;
      object-fit: cover;
    }

    .wh-thumb-empty {
      display: grid;
      place-items: center;
      background: #f7f4f0;
      color: #b9ada0;
      font-size: 2rem;
      font-weight: 600;
    }

    .wh-qty {
      width: auto;
    }

    .wh-qty .form-control {
      width: 2.75rem;
      flex: 0 0 auto;
    }

    .min-w-0 {
      min-width: 0;
    }

    @media (min-width: 992px) {
      .wh-summary {
        position: sticky;
        top: 5rem;
      }
    }
  `
})
export class CartPage {
  protected readonly cart = inject(CartService);
  private readonly media = inject(MediaUrlService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /** The line whose request is in flight, so its own buttons wait and the rest do not. */
  protected readonly busyLine = signal<number | null>(null);
  protected readonly zoneBusy = signal(false);
  protected readonly maxQuantity = MAX_QUANTITY_PER_LINE;

  constructor() {
    this.seo.apply({
      title: 'Your basket',
      canonicalPath: '/cart',
      // Every visitor's basket is different and none of them belongs in a
      // search result.
      noIndex: true
    });

    this.cart.ensureLoaded();
  }

  protected setQuantity(line: CartLine, quantity: number): void {
    if (quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
      return;
    }

    this.busyLine.set(line.id);

    this.cart
      .updateLine(line.id, quantity)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busyLine.set(null),
        error: () => this.busyLine.set(null)
      });
  }

  protected remove(line: CartLine): void {
    this.busyLine.set(line.id);

    this.cart
      .removeLine(line.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busyLine.set(null),
        error: () => this.busyLine.set(null)
      });
  }

  protected chooseZone(zone: DeliveryZone): void {
    this.zoneBusy.set(true);

    this.cart
      .setDeliveryZone(zone)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.zoneBusy.set(false),
        error: () => this.zoneBusy.set(false)
      });
  }

  protected thumb(line: CartLine): string | null {
    return this.media.image(line.primaryImagePath, { width: 192, height: 192, fit: 'fill' });
  }
}
