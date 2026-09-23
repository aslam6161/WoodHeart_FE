import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { QuotationApiService } from '../../_services/quotation.service';
import { SeoService } from '../../_services/seo.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import {
  QUOTATION_STATUS_CLASS,
  QUOTATION_STATUS_LABELS,
  Quotation,
  QuotationStatus
} from '../../_models/quotations';

/**
 * The customer's quotation: what the designer proposed, and the two answers.
 *
 * <b>A price, presented as one.</b> This is the page a family reads before
 * spending several lakh taka, so every figure that makes up the total is on
 * it — the goods, the discount, the VAT rate it was worked out at, the
 * delivery — and the made-to-measure lines read in the designer's own words
 * because that is what they will be billed for.
 *
 * <b>The phone is asked for on the page, never carried in the URL.</b> A URL
 * ends up in browser history, in a proxy log and in a referrer header, and the
 * phone number is the other half of the credential. A guessed quotation number
 * on its own discloses nothing.
 *
 * <b>Accepting is not paying.</b> It tells the shop yes; the order and the
 * payment come afterwards, and the page says so rather than letting somebody
 * think money has changed hands.
 *
 * <b>A date that has passed is said plainly.</b> The shop would rather re-quote
 * than be held to timber prices from last month, and a customer who reads a
 * dead price as live is a customer who feels cheated later.
 */
@Component({
  selector: 'app-quotation-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-8">
          @if (quotation(); as detail) {
            <div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
              <div>
                <h1 class="h4 mb-1">Your quotation</h1>
                <div class="font-monospace small text-muted">{{ detail.quotationNumber }}</div>
              </div>
              <span class="badge fw-normal" [class]="statusClass(detail)">
                {{ statusLabel(detail) }}
              </span>
            </div>

            @if (detail.hasLapsed && detail.status !== 'Converted') {
              <div class="alert alert-warning small" role="alert">
                This quotation stood until
                {{ detail.validUntil | date: 'd MMMM yyyy' : '+0600' }} and has now passed.
                Please telephone us and we will price it again — materials move, and we
                would rather quote you afresh than surprise you.
              </div>
            }

            <div class="border rounded p-4 mb-3">
              @for (line of detail.lines; track line.id) {
                <div class="d-flex gap-3 py-2" [class.border-top]="!$first">
                  <div class="flex-grow-1">
                    <div>{{ line.description }}</div>
                    <div class="small text-muted">
                      {{ line.quantity }} &times; {{ line.unitPrice | taka }}
                      @if (!line.holdsStock) {
                        <!-- Made for them. Worth saying, because it is why it
                             takes weeks rather than days. -->
                        &middot; made to measure
                      }
                      @if (line.leadTimeDays) {
                        &middot; about {{ line.leadTimeDays }} days
                      }
                    </div>
                  </div>
                  <div class="text-end text-nowrap">{{ line.lineTotal | taka }}</div>
                </div>
              }

              <dl class="row mb-0 gy-1 small border-top pt-3 mt-2">
                <dt class="col-7 fw-normal text-muted">Goods</dt>
                <dd class="col-5 text-end mb-0">{{ detail.subtotal | taka }}</dd>

                @if (detail.discountTotal > 0) {
                  <dt class="col-7 fw-normal text-muted">Discount</dt>
                  <dd class="col-5 text-end mb-0 text-success">
                    &minus;{{ detail.discountTotal | taka }}
                  </dd>
                }

                <dt class="col-7 fw-normal text-muted">
                  VAT at {{ detail.vatRatePercent }}%
                  @if (detail.pricesIncludeVat) {
                    <span class="text-muted">(included above)</span>
                  }
                </dt>
                <dd class="col-5 text-end mb-0">{{ detail.vatAmount | taka }}</dd>

                <dt class="col-7 fw-normal text-muted">Delivery</dt>
                <dd class="col-5 text-end mb-0">
                  @if (detail.deliveryFee > 0) {
                    {{ detail.deliveryFee | taka }}
                  } @else {
                    <span class="text-success">Free</span>
                  }
                </dd>

                <dt class="col-7 fw-semibold border-top pt-2">Total</dt>
                <dd class="col-5 text-end fw-semibold border-top pt-2 mb-0">
                  {{ detail.grandTotal | taka }}
                </dd>
              </dl>

              <p class="small text-muted mb-0 mt-3">
                Valid until {{ detail.validUntil | date: 'd MMMM yyyy' : '+0600' }}. If you
                accept, this is exactly what your order will come to — we do not price it
                again. Only the charge for the way you choose to pay is added at that
                point.
              </p>
            </div>

            @if (detail.notes) {
              <div class="border rounded p-4 mb-3">
                <h2 class="h6 text-uppercase text-muted small mb-2">From your designer</h2>
                <p class="mb-0 small">{{ detail.notes }}</p>
              </div>
            }

            @if (detail.shippingAddress; as address) {
              <div class="border rounded p-4 mb-3">
                <h2 class="h6 text-uppercase text-muted small mb-2">Delivering to</h2>
                <p class="mb-0 small">
                  {{ address.addressLine }}<br />
                  @if (address.area) {
                    {{ address.area }},
                  }
                  {{ address.district }}
                  <!-- Not "Dhaka, Dhaka": in the capital the district and the
                       division are the same word, and saying it twice reads
                       as a mistake on the shop's part. -->
                  @if (address.division !== address.district) {
                    , {{ address.division }}
                  }
                </p>
              </div>
            }

            @if (refusal(); as message) {
              <div class="alert alert-warning small" role="alert">{{ message }}</div>
            }

            @if (detail.orderNumber) {
              <div class="alert alert-success small" role="alert">
                Thank you — this became order
                <span class="font-monospace">{{ detail.orderNumber }}</span
                >. You can follow it on the
                <a routerLink="/track">order tracking page</a>.
              </div>
            } @else if (detail.status === 'Accepted') {
              <div class="alert alert-success small" role="alert">
                Thank you. We have your acceptance and will be in touch shortly to
                arrange the order and the payment.
              </div>
            } @else if (detail.status === 'Declined') {
              <p class="small text-muted mb-0">
                You turned this one down. If you have changed your mind, please telephone
                us — we can quote it again.
              </p>
            } @else if (detail.canAnswer) {
              @if (declining()) {
                <div class="border rounded p-4">
                  <h2 class="h6 mb-2">Turn this quotation down?</h2>
                  <p class="small text-muted">
                    Telling us why helps — most of the time we can do something about it.
                  </p>
                  <form
                    class="row g-2 align-items-end"
                    [formGroup]="declineForm"
                    (ngSubmit)="decline()"
                    novalidate>
                    <div class="col-12 col-sm-7">
                      <label class="form-label" for="reason">Reason (optional)</label>
                      <input id="reason" class="form-control" type="text" formControlName="reason" />
                    </div>
                    <div class="col-12 col-sm-5 d-flex gap-2">
                      <button class="btn btn-outline-danger" type="submit" [disabled]="busy()">
                        {{ busy() ? 'Sending…' : 'Yes, turn it down' }}
                      </button>
                      <button class="btn btn-link" type="button" (click)="declining.set(false)">
                        Keep it
                      </button>
                    </div>
                  </form>
                </div>
              } @else {
                <div class="d-flex flex-wrap gap-2 wh-answer">
                  <button class="btn btn-dark" type="button" [disabled]="busy()" (click)="accept()">
                    {{ busy() ? 'Sending…' : 'Accept this quotation' }}
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    (click)="declining.set(true)">
                    No, thank you
                  </button>
                </div>
                <!-- Accepting is an answer, not a payment. Said before the
                     press, not discovered after it. -->
                <p class="small text-muted mt-2 mb-0">
                  Accepting tells us to go ahead. Nothing is charged now — we will
                  telephone you to arrange the order and how you would like to pay.
                </p>
              }
            } @else {
              <p class="small text-muted mb-0">
                This quotation can no longer be answered here. Please telephone us and we
                will pick it up from where it stands.
              </p>
            }
          } @else {
            <h1 class="h4 mb-1">Find your quotation</h1>
            <p class="text-muted small mb-4">
              Enter the quotation number we sent you and the mobile number it was written
              for.
            </p>

            <form
              class="row g-2 align-items-end mb-3"
              [formGroup]="lookupForm"
              (ngSubmit)="lookup()"
              novalidate>
              <div class="col-12 col-sm-5">
                <label class="form-label" for="quotationNumber">Quotation number</label>
                <input
                  id="quotationNumber"
                  class="form-control font-monospace"
                  type="text"
                  autocomplete="off"
                  placeholder="WHQ-2609-00042"
                  formControlName="quotationNumber" />
              </div>
              <div class="col-12 col-sm-4">
                <label class="form-label" for="phone">Mobile number</label>
                <input
                  id="phone"
                  class="form-control"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  placeholder="01712345678"
                  formControlName="phone" />
              </div>
              <div class="col-12 col-sm-3 d-grid">
                <button class="btn btn-dark" type="submit" [disabled]="busy()">
                  {{ busy() ? 'Looking…' : 'Find it' }}
                </button>
              </div>
            </form>

            @if (notFound()) {
              <div class="alert alert-warning small" role="alert">
                We could not find a quotation with that number and mobile number. Check
                both against the message we sent — the number starts with
                <span class="font-monospace">WHQ-</span>.
              </div>
            }

            @if (!account.isAuthenticated()) {
              <p class="small text-muted mb-0">
                Have an account? <a routerLink="/account/quotations">Sign in</a> to see
                every quotation we have written you without typing anything.
              </p>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class QuotationPage {
  private readonly api = inject(QuotationApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly account = inject(AccountService);

  protected readonly quotation = signal<Quotation | null>(null);
  protected readonly busy = signal(false);
  protected readonly notFound = signal(false);
  protected readonly declining = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected readonly lookupForm = this.formBuilder.nonNullable.group({
    quotationNumber: ['', [Validators.required, Validators.maxLength(30)]],
    phone: ['', [Validators.required, Validators.maxLength(20)]]
  });

  protected readonly declineForm = this.formBuilder.nonNullable.group({
    reason: ['', Validators.maxLength(500)]
  });

  /** Remembered from the lookup, so answering does not ask for it again. */
  private phone: string | null = null;

  constructor() {
    const number = this.route.snapshot.paramMap.get('quotationNumber');

    this.seo.apply({
      title: 'Your quotation',
      canonicalPath: number ? `/quotation/${number}` : '/quotation/find',
      noIndex: true
    });

    if (number) {
      this.lookupForm.controls.quotationNumber.setValue(number);

      // A signed-in customer needs nothing else; the API knows whose it is.
      // A guest falls through to the form.
      if (this.account.isAuthenticated()) {
        this.fetch(number, null);
      }
    }
  }

  protected statusLabel(quotation: Quotation): string {
    return QUOTATION_STATUS_LABELS[quotation.status] ?? quotation.status;
  }

  protected statusClass(quotation: Quotation): string {
    return QUOTATION_STATUS_CLASS[quotation.status as QuotationStatus] ?? 'text-bg-secondary';
  }

  protected lookup(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();

      return;
    }

    const value = this.lookupForm.getRawValue();

    this.fetch(value.quotationNumber.trim().toUpperCase(), value.phone.trim());
  }

  protected accept(): void {
    const quotation = this.quotation();

    if (!quotation) {
      return;
    }

    this.answer(this.api.accept(quotation.quotationNumber, { phone: this.phone }));
  }

  protected decline(): void {
    const quotation = this.quotation();

    if (!quotation) {
      return;
    }

    this.answer(
      this.api.decline(quotation.quotationNumber, {
        phone: this.phone,
        reason: this.declineForm.getRawValue().reason.trim() || null
      })
    );
  }

  private answer(request: ReturnType<QuotationApiService['accept']>): void {
    this.busy.set(true);
    this.refusal.set(null);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.busy.set(false);
        this.declining.set(false);

        if (response.isSuccess && response.data) {
          this.quotation.set(response.data);

          return;
        }

        // "This one has run out of date", "it has already been answered" —
        // each is about the figures on this page and belongs beside them.
        this.refusal.set(response.message || 'We could not record that answer.');
      },
      error: () => {
        this.busy.set(false);
        this.refusal.set('We could not reach the shop. Please try again.');
      }
    });
  }

  private fetch(quotationNumber: string, phone: string | null): void {
    this.busy.set(true);
    this.notFound.set(false);

    this.api
      .get(quotationNumber, phone)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: quotation => {
          this.busy.set(false);
          this.quotation.set(quotation);
          this.notFound.set(quotation === null && phone !== null);
          this.phone = phone;
        },
        error: () => this.busy.set(false)
      });
  }
}
