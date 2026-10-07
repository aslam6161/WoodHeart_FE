import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContactDetails, ContactTopic } from '../../_models/contact';
import { ContactService } from '../../_services/contact.service';

/** The topics, in the order they are offered. */
const Topics: { value: ContactTopic; label: string }[] = [
  { value: 'General', label: 'A general question' },
  { value: 'Product', label: 'A piece in the catalogue' },
  { value: 'Order', label: 'An order I have placed' },
  { value: 'Delivery', label: 'Delivery' },
  { value: 'Consultation', label: 'Design work or a quotation' },
  { value: 'Complaint', label: 'Something went wrong' }
];

/**
 * Contact us.
 *
 * <b>The shop's own details come first, and the form second.</b> Most people
 * arriving here want a telephone number, not a textarea: a message is the slow
 * way to ask something somebody could answer in thirty seconds. So the number
 * is at the top, it dials when tapped, and the form is for when the showroom is
 * shut.
 *
 * <b>Nothing is printed that the shop has not filled in.</b> Every detail is
 * optional on the way in and left out when absent, because "Address: —" reads
 * as a page that failed to load rather than a shop that has not got round to it.
 *
 * <b>The self-service routes are offered before the form.</b> "Where is my
 * order" is answered faster by the tracking page than by anybody in the
 * showroom, and a message asking it costs the shop a reply to say so.
 */
@Component({
  selector: 'app-contact-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="row g-4 g-lg-5">
        <!-- How to reach a person -->
        <div class="col-12 col-lg-5">
          <h1 class="h3 mb-1">Contact us</h1>
          <p class="text-muted mb-4">
            The showroom answers fastest. Everything else reaches the same people.
          </p>

          <dl class="wh-contact__list mb-4">
            @if (details().phone) {
              <dt>Telephone</dt>
              <dd>
                @if (details().phoneE164) {
                  <!-- Tapping it dials. On the phone most of this audience is
                       using, that is the whole interaction. -->
                  <a class="wh-contact__strong" [href]="'tel:' + details().phoneE164">
                    {{ details().phone }}
                  </a>

                  <a
                    class="wh-contact__also"
                    [href]="'https://wa.me/' + whatsapp()"
                    target="_blank"
                    rel="noopener">
                    WhatsApp
                  </a>
                } @else {
                  <span class="wh-contact__strong">{{ details().phone }}</span>
                }
              </dd>
            }

            @if (details().email) {
              <dt>Email</dt>
              <dd><a [href]="'mailto:' + details().email">{{ details().email }}</a></dd>
            }

            @if (details().address) {
              <dt>Showroom</dt>
              <dd class="wh-contact__address">{{ details().address }}</dd>
            }

            @if (details().hours) {
              <dt>Hours</dt>
              <dd>{{ details().hours }}</dd>
            }
          </dl>

          <div class="wh-contact__self">
            <h2 class="h6">Faster than writing</h2>

            <ul class="list-unstyled small mb-0">
              <li><a routerLink="/track">Track an order</a> — with the number and the phone it was placed on.</li>
              <li><a routerLink="/quotation/find">Find a quotation</a> you were sent.</li>
              <li><a routerLink="/consultation">Book a designer</a> to look at your room.</li>
            </ul>
          </div>
        </div>

        <!-- Or write -->
        <div class="col-12 col-lg-7">
          @if (sent(); as receipt) {
            <!-- Replaces the form rather than sitting above it: a second
                 message, sent because the first looked unsent, is the shop
                 answering the same person twice. -->
            <div class="wh-contact__done" role="status">
              <h2 class="h5">Thank you — we have it.</h2>

              <p class="mb-2">
                We will come back to you on <strong>{{ receipt.replyTo }}</strong>.
              </p>

              @if (receipt.hours) {
                <p class="text-muted small mb-3">{{ receipt.hours }}</p>
              }

              <button class="btn btn-outline-dark btn-sm" type="button" (click)="again()">
                Send another message
              </button>
            </div>
          } @else {
            <div class="wh-contact__form">
              <h2 class="h5 mb-3">Send us a message</h2>

              <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
                <div class="row g-3">
                  <div class="col-12 col-sm-6">
                    <label class="form-label" for="contact-name">Your name</label>
                    <input
                      id="contact-name"
                      class="form-control"
                      type="text"
                      maxlength="120"
                      formControlName="name"
                      [class.is-invalid]="invalid('name')" />
                    @if (invalid('name')) {
                      <div class="invalid-feedback">Please tell us what to call you.</div>
                    }
                  </div>

                  <div class="col-12 col-sm-6">
                    <label class="form-label" for="contact-topic">What is it about?</label>
                    <select id="contact-topic" class="form-select" formControlName="topic">
                      @for (topic of topics; track topic.value) {
                        <option [value]="topic.value">{{ topic.label }}</option>
                      }
                    </select>
                  </div>

                  <div class="col-12 col-sm-6">
                    <label class="form-label" for="contact-phone">Mobile number</label>
                    <input
                      id="contact-phone"
                      class="form-control"
                      type="tel"
                      inputmode="numeric"
                      autocomplete="tel"
                      maxlength="20"
                      placeholder="01712345678"
                      formControlName="phone"
                      [class.is-invalid]="phoneRejected()" />
                    @if (phoneRejected()) {
                      <div class="invalid-feedback d-block">{{ error() }}</div>
                    }
                  </div>

                  <div class="col-12 col-sm-6">
                    <label class="form-label" for="contact-email">Email</label>
                    <input
                      id="contact-email"
                      class="form-control"
                      type="email"
                      autocomplete="email"
                      maxlength="256"
                      formControlName="email"
                      [class.is-invalid]="invalid('email')" />
                    @if (invalid('email')) {
                      <div class="invalid-feedback">That does not look like an email address.</div>
                    }
                  </div>

                  <!-- One of the two, not both. Said once, under the pair,
                       because "required" under each of them would be a lie. -->
                  <div class="col-12">
                    <p class="text-muted small mb-0" [class.text-danger]="noRoute()">
                      Leave a mobile number or an email — whichever you would rather we used.
                    </p>
                  </div>

                  @if (needsReference()) {
                    <div class="col-12 col-sm-6">
                      <label class="form-label" for="contact-reference">
                        Order or quotation number <span class="text-muted">(if you have it)</span>
                      </label>
                      <input
                        id="contact-reference"
                        class="form-control"
                        type="text"
                        maxlength="40"
                        placeholder="WH-2610-00042"
                        formControlName="reference" />
                    </div>
                  }

                  <div class="col-12">
                    <label class="form-label" for="contact-message">Your message</label>
                    <textarea
                      id="contact-message"
                      class="form-control"
                      rows="5"
                      maxlength="2000"
                      formControlName="message"
                      [class.is-invalid]="invalid('message')"></textarea>

                    @if (invalid('message')) {
                      <div class="invalid-feedback">
                        A sentence or two, so we can answer properly.
                      </div>
                    } @else {
                      <div class="form-text">{{ remaining() }} characters left.</div>
                    }
                  </div>
                </div>

                @if (error() && !phoneRejected()) {
                  <div class="alert alert-danger mt-3 mb-0 py-2 small" role="alert">
                    {{ error() }}
                  </div>
                }

                <button class="btn btn-dark mt-3" type="submit" [disabled]="sending()">
                  {{ sending() ? 'Sending…' : 'Send message' }}
                </button>
              </form>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .wh-contact__list dt {
      font-size: 0.8125rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--wh-quiet, #7a756f);
      font-weight: 600;
    }

    .wh-contact__list dd {
      margin-bottom: 1rem;
    }

    .wh-contact__strong {
      font-size: 1.25rem;
      font-weight: 600;
      text-decoration: none;
      color: inherit;
    }

    .wh-contact__also {
      margin-left: 0.75rem;
      font-size: 0.875rem;
    }

    /* The shop types its address as it would write it on an envelope, and the
       line breaks it used are part of the address. */
    .wh-contact__address {
      white-space: pre-line;
    }

    .wh-contact__self,
    .wh-contact__form,
    .wh-contact__done {
      background: var(--wh-band, #f8f9fd);
      border-radius: 0.5rem;
      padding: 1.25rem;
    }

    .wh-contact__self li + li {
      margin-top: 0.375rem;
    }
  `
})
export class ContactPage implements OnInit {
  private readonly contact = inject(ContactService);
  private readonly builder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly topics = Topics;

  protected readonly details = signal<ContactDetails>({});
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal<{ replyTo: string; hours?: string | null } | null>(null);

  /** True once the API has said a message needs a phone or an email. */
  protected readonly noRoute = signal(false);

  protected readonly form = this.builder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: [''],
    email: ['', [Validators.email, Validators.maxLength(256)]],
    topic: ['General' as ContactTopic],
    reference: [''],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]]
  });

  ngOnInit(): void {
    this.contact
      .details()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(details => this.details.set(details));
  }

  /** Digits only: wa.me rejects the leading plus. */
  protected whatsapp(): string {
    return (this.details().phoneE164 ?? '').replace(/\D/g, '');
  }

  /** The reference box appears only where a number would exist to type. */
  protected needsReference(): boolean {
    const topic = this.form.controls.topic.value;

    return topic === 'Order' || topic === 'Delivery' || topic === 'Consultation';
  }

  protected remaining(): number {
    return 2000 - this.form.controls.message.value.length;
  }

  protected invalid(field: 'name' | 'email' | 'message'): boolean {
    const control = this.form.controls[field];

    return control.invalid && (control.touched || control.dirty);
  }

  /** The API's own verdict on the number, which is the only one that counts. */
  protected readonly phoneRejected = signal(false);

  protected submit(): void {
    this.error.set(null);
    this.noRoute.set(false);
    this.phoneRejected.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.sending.set(true);

    this.contact
      .send({
        name: value.name.trim(),
        phone: value.phone.trim() || null,
        email: value.email.trim() || null,
        topic: value.topic,
        reference: this.needsReference() ? value.reference.trim() || null : null,
        message: value.message.trim()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.sending.set(false);

          if (!response.isSuccess || !response.data) {
            // The API's own sentence, against the field that caused it. It
            // distinguishes "leave us something to reply to" from "that mobile
            // number is not valid", and those go in different places.
            this.error.set(response.message ?? 'That could not be sent. Please try again.');
            this.noRoute.set(response.errorCode === 'support.contact.no_reply_route');
            this.phoneRejected.set(response.errorCode === 'common.invalid_phone');
            return;
          }

          this.sent.set(response.data);
        },
        error: () => {
          this.sending.set(false);
          this.error.set('That could not be sent. Please try again.');
        }
      });
  }

  protected again(): void {
    this.form.reset({ topic: 'General' });
    this.sent.set(null);
    this.error.set(null);
    this.noRoute.set(false);
    this.phoneRejected.set(false);
  }
}
