import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { OrderService } from '../../_services/order.service';
import { SeoService } from '../../_services/seo.service';
import { OrderDetail } from '../../_models/order';
import { OrderDetailCard } from '../order-detail-card/order-detail-card';

/**
 * "Where is my order?" — for the customer with no account.
 *
 * Most orders here are placed as a guest, and those customers still need to
 * see where their sofa is. They have two things: the order number from the
 * confirmation SMS, and the phone it was sent to. Both are asked for, because
 * an order number alone is a series anybody could walk.
 *
 * A wrong pair is answered with "we could not find that order", the same
 * whether the number exists or not — the page is not a way to discover which
 * numbers are real. The API rate-limits it tightly for the same reason, so a
 * 429 here is shown as "slow down", not as an error.
 *
 * The number can arrive in the query string (`/track?order=WH-…`), which is
 * how the confirmation page and the SMS link land here with half the form
 * already filled.
 */
@Component({
  selector: 'app-track-order',
  imports: [ReactiveFormsModule, RouterLink, OrderDetailCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-9">
          <h1 class="h3 mb-1">Track your order</h1>
          <p class="text-muted small mb-4">
            Enter the order number from your confirmation SMS and the mobile number you gave us.
          </p>

          <form class="row g-2 align-items-end mb-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="col-12 col-sm-5">
              <label class="form-label" for="orderNumber">Order number</label>
              <input
                id="orderNumber"
                class="form-control font-monospace"
                type="text"
                autocomplete="off"
                placeholder="WH-2609-00042"
                formControlName="orderNumber"
                [class.is-invalid]="invalid('orderNumber')" />
              @if (invalid('orderNumber')) {
                <div class="invalid-feedback">Enter the order number.</div>
              }
            </div>

            <div class="col-12 col-sm-4">
              <label class="form-label" for="contactPhone">Mobile number</label>
              <input
                id="contactPhone"
                class="form-control"
                type="tel"
                inputmode="numeric"
                autocomplete="tel"
                placeholder="01712345678"
                formControlName="contactPhone"
                [class.is-invalid]="invalid('contactPhone')" />
              @if (invalid('contactPhone')) {
                <div class="invalid-feedback">Enter the mobile number on the order.</div>
              }
            </div>

            <div class="col-12 col-sm-3 d-grid">
              <button class="btn btn-dark" type="submit" [disabled]="busy()">
                {{ busy() ? 'Looking…' : 'Find order' }}
              </button>
            </div>
          </form>

          @if (notFound()) {
            <div class="alert alert-warning small" role="alert">
              We could not find an order with that number and mobile number. Check both against
              your SMS — the number starts with <span class="font-monospace">WH-</span>.
            </div>
          }

          @if (order(); as detail) {
            <h2 class="h5 mb-3">
              Order <span class="font-monospace">{{ detail.orderNumber }}</span>
            </h2>
            <app-order-detail-card [order]="detail" />
          }

          @if (!account.isAuthenticated()) {
            <p class="small text-muted mt-4 mb-0">
              Have an account? <a routerLink="/account/orders">Sign in</a> to see all your orders
              without typing anything.
            </p>
          }
        </div>
      </div>
    </div>
  `
})
export class TrackOrder {
  private readonly formBuilder = inject(FormBuilder);
  private readonly orders = inject(OrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly account = inject(AccountService);

  protected readonly busy = signal(false);
  protected readonly notFound = signal(false);
  protected readonly order = signal<OrderDetail | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    orderNumber: [
      this.route.snapshot.queryParamMap.get('order')?.trim().toUpperCase() ?? '',
      [Validators.required, Validators.maxLength(24)]
    ],
    contactPhone: ['', [Validators.required, Validators.maxLength(20)]]
  });

  constructor() {
    this.seo.apply({
      title: 'Track your order',
      description: 'See where your WoodHeart order is, with your order number and mobile number.',
      canonicalPath: '/track'
    });
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);

    return !!field?.invalid && (field.touched || field.dirty);
  }

  protected submit(): void {
    this.notFound.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.busy.set(true);

    this.orders
      .lookup({
        orderNumber: value.orderNumber.trim().toUpperCase(),
        contactPhone: value.contactPhone.trim()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => {
          this.busy.set(false);
          this.order.set(detail);
          this.notFound.set(detail === null);
        },
        // 429 and 5xx are already toasted or redirected by the interceptor.
        error: () => this.busy.set(false)
      });
  }
}
