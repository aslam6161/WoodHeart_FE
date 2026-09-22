import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CartService } from '../../_services/cart.service';
import { CartCoupon } from '../../_models/cart';
import { GeneralResponse, couponReason } from '../../_models/generalResponse';

/**
 * The discount-code box, on the basket and again at checkout.
 *
 * <b>A refused code says why, beside the box.</b> The API has already worked
 * out the reason — expired, below the minimum, for a first order, fully
 * claimed — and every one of those tells the customer something they can act
 * on. "That code cannot be used" is the answer that makes somebody try it
 * three more times and then telephone the shop.
 *
 * <b>A code that stops applying stays visible.</b> Someone who takes the sofa
 * out of their basket and puts it back should not have to find their code
 * again, so a coupon that no longer qualifies is listed with its reason rather
 * than quietly removed.
 *
 * The component owns no totals. Applying or removing replaces the basket with
 * whatever the API answered, and the summary beside it redraws from that.
 */
@Component({
  selector: 'app-coupon-box',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wh-coupon">
      <label class="small fw-semibold d-block mb-1" [attr.for]="inputId">Discount code</label>

      <div class="input-group input-group-sm">
        <input
          class="form-control text-uppercase"
          type="text"
          autocomplete="off"
          spellcheck="false"
          maxlength="40"
          placeholder="e.g. EID25"
          [id]="inputId"
          [ngModel]="code()"
          [disabled]="busy()"
          (ngModelChange)="onType($event)"
          (keyup.enter)="apply()" />
        <button
          class="btn btn-outline-dark"
          type="button"
          [disabled]="busy() || code().trim().length === 0"
          (click)="apply()">
          {{ busy() ? 'Checking…' : 'Apply' }}
        </button>
      </div>

      @if (error(); as message) {
        <p class="small text-danger mt-1 mb-0" role="alert">{{ message }}</p>
      }

      @if (coupons().length > 0) {
        <ul class="list-unstyled mt-2 mb-0">
          @for (coupon of coupons(); track coupon.code) {
            <li class="d-flex align-items-start gap-2 small py-1">
              <span
                class="badge flex-shrink-0"
                [class.text-bg-success]="coupon.isApplied"
                [class.text-bg-secondary]="!coupon.isApplied">
                {{ coupon.code }}
              </span>

              <span class="flex-grow-1 min-w-0">
                @if (coupon.isApplied) {
                  <span class="text-success">Applied</span>
                } @else {
                  <span class="text-danger">{{ reasonFor(coupon) }}</span>
                }
              </span>

              <button
                class="btn btn-link btn-sm text-muted p-0 flex-shrink-0"
                type="button"
                [attr.aria-label]="'Remove ' + coupon.code"
                [disabled]="busy()"
                (click)="remove(coupon.code)">
                Remove
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
  `
})
export class CouponBox {
  private readonly cart = inject(CartService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Unique per instance, because the basket page and the checkout page each
   * render one and a duplicated id would point both labels at the first box.
   */
  protected readonly inputId = `coupon-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly coupons = computed(() => this.cart.cart().coupons);

  protected onType(value: string): void {
    this.code.set(value);

    // The message belonged to the code they have just changed.
    this.error.set(null);
  }

  protected apply(): void {
    const code = this.code().trim();

    if (code.length === 0 || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    this.cart
      .applyCoupon(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.code.set('');
        },
        error: (failure: HttpErrorResponse) => {
          this.busy.set(false);

          const body = failure.error as GeneralResponse | undefined;

          // The code the engine gave, worded for a customer; the API's own
          // message is the fallback, and a network failure falls through to
          // something neutral rather than blaming the code.
          this.error.set(
            couponReason(body?.errorCode, body?.message ?? 'We could not check that code just now.')
          );
        }
      });
  }

  protected remove(code: string): void {
    this.busy.set(true);
    this.error.set(null);

    this.cart
      .removeCoupon(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busy.set(false),
        error: () => this.busy.set(false)
      });
  }

  protected reasonFor(coupon: CartCoupon): string {
    return couponReason(coupon.reason, 'Not applying to this basket.');
  }
}
