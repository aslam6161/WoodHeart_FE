import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminPaymentMethodService } from '../../_services/admin/admin-payment-method.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { CHARGE_TYPE_LABELS, PaymentMethodConfig } from '../../_models/payment-methods';

/**
 * How the shop takes money: which methods, where, and at what extra cost.
 *
 * <b>Every row says what a customer would actually see.</b> A method can be
 * switched on and still reach nobody — nothing implements it, it is offered in
 * neither zone, or its gateway has no key. The API refuses those, but a row
 * that merely said "on" would leave somebody wondering why the checkout
 * disagreed, so each condition is on the row in words.
 *
 * <b>Live is called out.</b> Sandbox and live look identical from a shop's
 * side right up to the moment somebody's money moves, and a method quietly
 * left in sandbox after go-live takes no payments at all.
 */
@Component({
  selector: 'app-admin-payment-method-list',
  imports: [RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
      <h1 class="h4 mb-0">Payment methods</h1>
    </div>
    <p class="text-muted small mb-3">
      How customers may pay, and what each way costs them. Methods arrive with the
      code that serves them — they are configured here, never created here.
    </p>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      <div class="row g-3">
        @for (method of methods(); track method.code) {
          <div class="col-12 col-xl-6">
            <div class="border rounded p-3 h-100">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <h2 class="h6 mb-0">{{ method.displayNameEn }}</h2>
                <span class="badge text-bg-light font-monospace fw-normal">{{ method.code }}</span>

                @if (method.isEnabled) {
                  <span class="badge text-bg-success fw-normal">On</span>
                } @else {
                  <span class="badge text-bg-secondary fw-normal">Off</span>
                }

                @if (method.mode === 'Live') {
                  <span class="badge text-bg-dark fw-normal">Live</span>
                } @else {
                  <!-- Not a warning while it is off; it becomes one the moment
                       somebody switches it on and expects money to arrive. -->
                  <span
                    class="badge fw-normal"
                    [class]="method.isEnabled ? 'text-bg-warning' : 'text-bg-light'">
                    Sandbox
                  </span>
                }

                <a
                  class="btn btn-sm btn-outline-dark ms-auto"
                  [routerLink]="['/admin/payment-methods', method.code]">
                  Configure
                </a>
              </div>

              @if (method.descriptionEn) {
                <p class="small text-muted mb-2">{{ method.descriptionEn }}</p>
              }

              <dl class="row mb-0 small gy-1">
                <dt class="col-5 fw-normal text-muted">Offered</dt>
                <dd class="col-7 mb-0">{{ zones(method) }}</dd>

                <dt class="col-5 fw-normal text-muted">Order size</dt>
                <dd class="col-7 mb-0">{{ band(method) }}</dd>

                <dt class="col-5 fw-normal text-muted">Charge</dt>
                <dd class="col-7 mb-0">
                  @if (method.chargeType === 'None') {
                    <span class="text-muted">None</span>
                  } @else if (method.chargeType === 'Fixed') {
                    {{ method.chargeValue | taka }}
                  } @else {
                    {{ method.chargeValue }}% of the order
                  }
                </dd>

                @if (method.needsCredentials) {
                  <dt class="col-5 fw-normal text-muted">Merchant account</dt>
                  <dd class="col-7 mb-0">
                    @if (method.credentialsUnreadable) {
                      <span class="text-danger">Stored, but unreadable</span>
                    } @else if (method.hasCredentials) {
                      Stored
                    } @else {
                      <span class="text-muted">Nothing stored</span>
                    }
                  </dd>
                }
              </dl>

              @if (!method.isImplemented) {
                <!-- The row exists ahead of the class that will serve it. The
                     checkout skips such a method in silence, so the screen has
                     to say it out loud. -->
                <div class="alert alert-secondary small mt-3 mb-0" role="note">
                  Nothing in the shop can take money this way yet, so it cannot be
                  switched on. It is here so the day it is built is a toggle rather
                  than a release.
                </div>
              } @else if (method.isEnabled && method.credentialsUnreadable) {
                <div class="alert alert-danger small mt-3 mb-0" role="alert">
                  The stored merchant credentials can no longer be read — almost always
                  a key lost with a redeployment. Enter them again before the next
                  customer tries to pay.
                </div>
              } @else if (method.isEnabled && method.mode === 'Sandbox') {
                <div class="alert alert-warning small mt-3 mb-0" role="alert">
                  This is switched on but pointed at the gateway's sandbox. No real
                  money will move.
                </div>
              }
            </div>
          </div>
        }
      </div>

      <p class="form-text mt-3">
        Cash on delivery cannot be removed and no method can be added from here. A
        method is half a configuration row and half a class in the shop's code, and
        one without the other reaches no customer.
      </p>
    }
  `
})
export class AdminPaymentMethodList {
  private readonly api = inject(AdminPaymentMethodService);

  protected readonly methods = signal<PaymentMethodConfig[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.api.getAll().subscribe({
      next: methods => {
        this.methods.set(methods);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  protected chargeLabel(method: PaymentMethodConfig): string {
    return CHARGE_TYPE_LABELS[method.chargeType] ?? method.chargeType;
  }

  /**
   * Where it is offered, in words.
   *
   * "Nowhere" is a real answer and the API refuses to let a method be enabled
   * in that state — but a method switched off can sit there, and the row
   * should say so rather than leaving two empty ticks to be read.
   */
  protected zones(method: PaymentMethodConfig): string {
    if (method.availableInsideDhaka && method.availableOutsideDhaka) {
      return 'Everywhere';
    }

    if (method.availableInsideDhaka) {
      return 'Inside Dhaka only';
    }

    return method.availableOutsideDhaka ? 'Outside Dhaka only' : 'Nowhere';
  }

  /** The floor and the ceiling, said the way somebody would say them. */
  protected band(method: PaymentMethodConfig): string {
    const floor = method.minOrderAmount;
    const ceiling = method.maxOrderAmount;

    if (floor && ceiling) {
      return `৳${floor.toLocaleString('en-US')} to ৳${ceiling.toLocaleString('en-US')}`;
    }

    if (ceiling) {
      return `Up to ৳${ceiling.toLocaleString('en-US')}`;
    }

    if (floor) {
      return `From ৳${floor.toLocaleString('en-US')}`;
    }

    return 'Any';
  }
}
