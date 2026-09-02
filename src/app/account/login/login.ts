import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { ToastService } from '../../_services/toast.service';
import { SeoService } from '../../_services/seo.service';
import { GeneralResponse } from '../../_models/generalResponse';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Sign in with a mobile number.
 *
 * The handle is a phone number rather than an email because that is what this
 * market has: a large share of customers shop without an email address they
 * check, and the number is already how the delivery rider reaches them.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-6 col-lg-5">
          <h1 class="h4 mb-1">Sign in</h1>
          <p class="text-muted small mb-4">Use the mobile number registered with WoodHeart.</p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="mb-3">
              <label class="form-label" for="phoneNumber">Mobile number</label>
              <input
                id="phoneNumber"
                class="form-control"
                type="tel"
                autocomplete="username"
                inputmode="numeric"
                placeholder="01712345678"
                formControlName="phoneNumber"
                [class.is-invalid]="invalid('phoneNumber')" />
              @if (invalid('phoneNumber')) {
                <div class="invalid-feedback">{{ messageFor('phoneNumber') }}</div>
              }
            </div>

            <div class="mb-3">
              <label class="form-label" for="password">Password</label>
              <input
                id="password"
                class="form-control"
                type="password"
                autocomplete="current-password"
                formControlName="password"
                [class.is-invalid]="invalid('password')" />
              @if (invalid('password')) {
                <div class="invalid-feedback">{{ messageFor('password') }}</div>
              }
            </div>

            @if (failure()) {
              <!-- Not a toast. A sign-in failure belongs beside the form the
                   person is looking at, and it must survive long enough to be
                   read on a slow connection. -->
              <div class="alert alert-danger py-2 small" role="alert">{{ failure() }}</div>
            }

            <button class="btn btn-dark w-100" type="submit" [disabled]="busy()">
              {{ busy() ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>

          <p class="small text-muted mt-4 mb-0">
            Shopping as a guest is fine — <a routerLink="/products">browse the catalogue</a>.
          </p>
        </div>
      </div>
    </div>
  `
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);

  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);

  /**
   * Where to go after signing in.
   *
   * Read from the query string the guards set. Only a same-site path is
   * honoured — see {@link safeReturnUrl}.
   */
  private readonly returnUrl =
    this.router.parseUrl(this.router.url).queryParams['returnUrl'] ?? '/admin';

  protected readonly form = this.formBuilder.nonNullable.group({
    phoneNumber: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  /** Per-field messages the API sent back, keyed by control name. */
  private readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    this.seo.apply({
      title: 'Sign in',
      description: 'Sign in to your WoodHeart account.',
      canonicalPath: '/login',
      // A sign-in page has nothing to offer a search result, and indexing it
      // spends crawl budget that belongs to the catalogue.
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

    return control === 'phoneNumber' ? 'Enter your mobile number.' : 'Enter your password.';
  }

  protected submit(): void {
    this.failure.set(null);
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);

    this.account
      .login({
        ...this.form.getRawValue(),
        // Labels the session so a future "your devices" screen has something to
        // show. Never trusted by the server.
        deviceLabel: typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 120)
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.success('Signed in.');
          this.router.navigateByUrl(this.safeReturnUrl());
        },
        error: (error: HttpErrorResponse) => {
          this.busy.set(false);

          const body = error.error as GeneralResponse | undefined;

          this.fieldErrors.set(body?.errors ?? {});
          this.failure.set(body?.message ?? 'We could not sign you in. Please try again.');
        }
      });
  }

  /**
   * Refuses to send the visitor to another site after signing in.
   *
   * `returnUrl` comes from the query string, so a link like
   * `/login?returnUrl=https://evil.example/` would otherwise turn this form
   * into an open redirect on a page that has just handled a password — the
   * exact shape of a credential-phishing hop.
   */
  private safeReturnUrl(): string {
    const requested = String(this.returnUrl);

    // A single leading slash and nothing that starts another scheme or host.
    return /^\/(?!\/)/.test(requested) ? requested : '/admin';
  }
}
