import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountService } from '../../_services/account.service';
import { CartService } from '../../_services/cart.service';
import { ToastService } from '../../_services/toast.service';
import { SeoService } from '../../_services/seo.service';
import { ErrorCodes, GeneralResponse } from '../../_models/generalResponse';

/**
 * Create an account.
 *
 * Four fields, and the email is optional. The phone number is the login
 * handle and the channel every SMS goes to; an email is something a good
 * share of this audience does not check, so demanding one would turn
 * customers away at the door for a field the shop barely uses.
 *
 * The password rule is length alone — eight characters — because that is the
 * server's rule. A form that adds "one capital and one symbol" on top of what
 * the API enforces manufactures a refusal the server would not have made.
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-6 col-lg-5">
          <h1 class="h4 mb-1">Create an account</h1>
          <p class="text-muted small mb-4">
            See your orders in one place and check out faster next time.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="mb-3">
              <label class="form-label" for="fullName">Your name</label>
              <input
                id="fullName"
                class="form-control"
                type="text"
                autocomplete="name"
                formControlName="fullName"
                [class.is-invalid]="invalid('fullName')" />
              @if (invalid('fullName')) {
                <div class="invalid-feedback">{{ messageFor('fullName') }}</div>
              }
            </div>

            <div class="mb-3">
              <label class="form-label" for="phoneNumber">Mobile number</label>
              <input
                id="phoneNumber"
                class="form-control"
                type="tel"
                autocomplete="tel"
                inputmode="numeric"
                placeholder="01712345678"
                formControlName="phoneNumber"
                [class.is-invalid]="invalid('phoneNumber')" />
              @if (invalid('phoneNumber')) {
                <div class="invalid-feedback">{{ messageFor('phoneNumber') }}</div>
              }
              <div class="form-text">You will sign in with this number.</div>
            </div>

            <div class="mb-3">
              <label class="form-label" for="email">
                Email <span class="text-muted fw-normal">(optional)</span>
              </label>
              <input
                id="email"
                class="form-control"
                type="email"
                autocomplete="email"
                formControlName="email"
                [class.is-invalid]="invalid('email')" />
              @if (invalid('email')) {
                <div class="invalid-feedback">{{ messageFor('email') }}</div>
              }
            </div>

            <div class="mb-3">
              <label class="form-label" for="password">Password</label>
              <input
                id="password"
                class="form-control"
                type="password"
                autocomplete="new-password"
                formControlName="password"
                [class.is-invalid]="invalid('password')" />
              @if (invalid('password')) {
                <div class="invalid-feedback">{{ messageFor('password') }}</div>
              } @else {
                <div class="form-text">At least 8 characters.</div>
              }
            </div>

            @if (failure()) {
              <div class="alert alert-danger py-2 small" role="alert">{{ failure() }}</div>
            }

            <button class="btn btn-dark w-100" type="submit" [disabled]="busy()">
              {{ busy() ? 'Creating your account…' : 'Create account' }}
            </button>
          </form>

          <p class="small text-muted mt-4 mb-0">
            Already have one? <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl }">Sign in</a>.
          </p>
        </div>
      </div>
    </div>
  `
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly account = inject(AccountService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** Same contract as the sign-in page: a same-site path, or the account. */
  protected readonly returnUrl: string = (() => {
    const requested = String(this.router.parseUrl(this.router.url).queryParams['returnUrl'] ?? '');

    return /^\/(?!\/)/.test(requested) ? requested : '/account/orders';
  })();

  protected readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    phoneNumber: ['', [Validators.required]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]]
  });

  private readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    this.seo.apply({
      title: 'Create an account',
      description: 'Create a WoodHeart account to see your orders and check out faster.',
      canonicalPath: '/register',
      noIndex: true
    });
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

    switch (control) {
      case 'fullName':
        return 'Enter your name.';
      case 'phoneNumber':
        return 'Enter your mobile number.';
      case 'email':
        return 'That does not look like an email address.';
      default:
        return 'Use at least 8 characters.';
    }
  }

  protected submit(): void {
    this.failure.set(null);
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.busy.set(true);

    this.account
      .register({
        fullName: value.fullName.trim(),
        phoneNumber: value.phoneNumber.trim(),
        email: value.email.trim() || undefined,
        password: value.password,
        deviceLabel: typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 120)
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.success('Welcome to WoodHeart.');
          // The basket they filled as a guest is theirs now; ask the API for
          // it again under the new identity rather than showing the old copy.
          this.cart.refresh().subscribe();
          this.router.navigateByUrl(this.returnUrl);
        },
        error: (error: HttpErrorResponse) => {
          this.busy.set(false);

          const body = error.error as GeneralResponse | undefined;

          this.fieldErrors.set(body?.errors ?? {});

          if (body?.errorCode === ErrorCodes.phoneTaken) {
            this.fieldErrors.update(errors => ({
              ...errors,
              phoneNumber: ['An account already exists on this number. Sign in instead.']
            }));
            return;
          }

          this.failure.set(body?.message ?? 'We could not create your account. Please try again.');
        }
      });
  }
}
