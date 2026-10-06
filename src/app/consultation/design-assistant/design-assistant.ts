import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StorefrontProduct } from '../../_models/catalog';
import { ConsultationApiService } from '../../_services/consultation.service';
import { ProductCard } from '../../catalog/product-card/product-card';

/**
 * Ask the designer, before booking one.
 *
 * <b>It sits above the booking cards, not instead of them.</b> A customer who
 * knows what they want books an hour; a customer who does not know what to ask
 * for leaves. This is for the second one, and every answer it gives ends at the
 * same place — the pieces the shop actually makes, and the designer who can
 * come and measure the room.
 *
 * <b>What the model says and what the shop charges are kept apart.</b> The
 * answer is prose; the pieces beneath it are the storefront's own product
 * cards, rendered from the database by the slugs the model chose. So a model
 * that misremembers a price cannot quote it to a customer, and a piece it
 * invented matches nothing and never appears.
 *
 * <b>It hides itself when there is no model configured.</b> The shop asks the
 * API before rendering anything, so a deployment with no key shows a
 * consultation page with nothing broken on it rather than a box that fails
 * when somebody finally types into it.
 */
@Component({
  selector: 'app-design-assistant',
  imports: [RouterLink, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offered()) {
      <section class="wh-ask border rounded p-4 p-md-5 mb-4">
        <h2 class="h5 mb-1">Not sure what you need?</h2>
        <p class="text-muted small mb-3">
          Describe the room — its size, what it is for, what you have already — and we will
          suggest pieces from the workshop. Bangla or English.
        </p>

        <!-- Not a <form>, for the same reason as the chat window: its default
             action is to navigate, and nothing here wants that. ask() is the
             only way in. -->
        <div class="wh-ask__form">
          <label class="visually-hidden" for="design-question">Describe your room</label>

          <textarea
            #question
            id="design-question"
            class="form-control"
            name="question"
            rows="2"
            maxlength="600"
            [disabled]="thinking()"
            placeholder="A 10 by 12 bedroom for two, budget around 80,000…"></textarea>

          <button
            class="btn btn-dark mt-2"
            type="button"
            [disabled]="thinking()"
            (click)="ask($event)">
            {{ thinking() ? 'Thinking…' : 'Ask the designer' }}
          </button>
        </div>

        <!-- Announced, because the answer arrives below a control the customer
             has just used and a screen reader would otherwise say nothing for
             the several seconds it takes. -->
        <div aria-live="polite">
          @if (error(); as message) {
            <p class="alert alert-warning mt-3 mb-0" role="alert">{{ message }}</p>
          }

          @if (reply(); as answer) {
            <div class="wh-ask__reply mt-4">
              @for (paragraph of paragraphs(answer); track $index) {
                <p>{{ paragraph }}</p>
              }
            </div>

            @if (products().length) {
              <div class="row row-cols-2 row-cols-md-4 g-3 mt-1">
                @for (product of products(); track product.id) {
                  <div class="col">
                    <app-product-card [product]="product" />
                  </div>
                }
              </div>
            }

            <!-- The point of the whole thing. A suggestion is a start; the
                 shop sells the hour that follows it. -->
            <p class="small text-muted mt-3 mb-0">
              Suggestions from the catalogue, not a survey of your room.
              <a routerLink="/consultation">Book a designer</a> to have it measured properly.
            </p>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .wh-ask {
      background: var(--wh-band, #f8f9fd);
      border-color: rgb(0 0 0 / 8%) !important;
    }

    .wh-ask__reply p:last-child {
      margin-bottom: 0;
    }

    .wh-ask__form textarea {
      resize: vertical;
    }
  `
})
export class DesignAssistant implements OnInit {
  private readonly consultations = inject(ConsultationApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly question = viewChild<ElementRef<HTMLTextAreaElement>>('question');

  protected readonly offered = signal(false);
  protected readonly thinking = signal(false);
  protected readonly reply = signal<string | null>(null);
  protected readonly products = signal<StorefrontProduct[]>([]);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.consultations
      .adviceOffered()
      .pipe(
        catchError(() => of(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(offered => this.offered.set(offered));
  }

  protected ask(event: Event): void {
    event.preventDefault();

    const asked = this.question()?.nativeElement.value.trim() ?? '';

    // Nothing typed is not a question. Sending it would spend a call to be told
    // so by something that charges for the privilege.
    if (asked.length < 3 || this.thinking()) {
      return;
    }

    this.thinking.set(true);
    this.error.set(null);

    this.consultations
      .askDesigner(asked)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.thinking.set(false);

          if (!response.isSuccess || !response.data) {
            // The API's own sentence. It distinguishes "switched off" from
            // "took too long", and those deserve different replies.
            this.error.set(response.message || 'The designer could not answer just now.');
            return;
          }

          this.reply.set(response.data.reply);
          this.products.set(response.data.products ?? []);
        },
        error: () => {
          this.thinking.set(false);
          this.error.set('The designer could not answer just now. Please try again.');
        }
      });
  }

  /**
   * The reply, split for reading.
   *
   * A model returns prose with blank lines in it, and a single `<p>` renders
   * that as one wall of text. Split rather than rendered as HTML: this string
   * comes from a third party by way of a customer's own question, and the one
   * safe thing to do with it is show it as text.
   */
  protected paragraphs(reply: string): string[] {
    return reply
      .split(/\n{2,}|\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}
