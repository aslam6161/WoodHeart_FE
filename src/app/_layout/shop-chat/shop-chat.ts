import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ShopChatAction, ShopChatMessage, ShopChatTurn } from '../../_models/assistant';
import { AssistantService } from '../../_services/assistant.service';
import { CartService } from '../../_services/cart.service';
import { CatalogService } from '../../_services/catalog.service';
import { ToastService } from '../../_services/toast.service';
import { ProductCard } from '../../catalog/product-card/product-card';

/** How much of the conversation travels with each question. */
const HistoryTurns = 6;

/**
 * The chat window, on every storefront page.
 *
 * <b>It answers from the shop, not from the internet.</b> Delivery, returns,
 * payment and lead times come from the shop's own settings, and the products it
 * shows are rendered from the database by slug — so a price in this window is
 * the price at checkout.
 *
 * <b>It proposes; it never acts.</b> "Add to basket" is a button the customer
 * presses, and pressing it runs the same cart code as the product page. The
 * model cannot put anything in a basket, cannot read one, and cannot look up an
 * order — asked where an order is, it offers the tracking page, which already
 * knows how to ask for a number safely.
 *
 * <b>A piece with more than one option is never added blind.</b> The list API
 * carries no variant id, and guessing which wood and which size somebody meant
 * is how a shop builds the wrong wardrobe. Those open the product page instead.
 */
@Component({
  selector: 'app-shop-chat',
  imports: [ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offered()) {
      <!-- Rendered only in the browser: the server has nobody to chat to, and a
           floating panel in the first paint is a shift the reader has to wait
           out. -->
      @if (ready()) {
        <div class="wh-chat">
          @if (open()) {
            <section
              class="wh-chat__panel"
              role="dialog"
              aria-label="Ask WoodHeart"
              aria-modal="false">
              <header class="wh-chat__head">
                <span>Ask WoodHeart</span>
                <button
                  class="wh-chat__x"
                  type="button"
                  aria-label="Close the chat"
                  (click)="close()">&times;</button>
              </header>

              <div class="wh-chat__log" #log aria-live="polite">
                @for (message of messages(); track $index) {
                  <div
                    class="wh-chat__msg"
                    [class.wh-chat__msg--mine]="message.fromCustomer">
                    @for (paragraph of paragraphs(message.text); track $index) {
                      <p>{{ paragraph }}</p>
                    }
                  </div>

                  @if (message.products?.length) {
                    <div class="wh-chat__products">
                      @for (product of message.products; track product.id) {
                        <app-product-card [product]="product" />
                      }
                    </div>
                  }

                  @if (message.actions?.length) {
                    <div class="wh-chat__actions">
                      @for (action of message.actions; track $index) {
                        <button
                          class="btn btn-sm btn-outline-dark"
                          type="button"
                          [disabled]="working()"
                          (click)="run(action)">
                          {{ action.label }}
                        </button>
                      }
                    </div>
                  }
                }

                @if (thinking()) {
                  <p class="wh-chat__thinking">Typing…</p>
                }
              </div>

              <form class="wh-chat__ask" (submit)="send($event)">
                <label class="visually-hidden" for="wh-chat-input">Your question</label>

                <input
                  #input
                  id="wh-chat-input"
                  class="form-control"
                  type="text"
                  maxlength="600"
                  autocomplete="off"
                  [disabled]="thinking()"
                  placeholder="Delivery, payment, what we make…" />

                <button class="btn btn-dark" type="submit" [disabled]="thinking()">Send</button>
              </form>
            </section>
          }

          <button
            class="wh-chat__fab"
            type="button"
            [attr.aria-expanded]="open()"
            aria-controls="wh-chat-input"
            (click)="toggle()">
            {{ open() ? 'Close' : 'Ask us' }}
          </button>
        </div>
      }
    }
  `,
  styles: `
    .wh-chat {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 1040;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
    }

    .wh-chat__fab {
      border: 0;
      border-radius: 999px;
      padding: 0.625rem 1.25rem;
      background: var(--wh-accent, #e99c2e);
      color: #fff;
      font-weight: 500;
      box-shadow: 0 2px 10px rgb(0 0 0 / 20%);
    }

    .wh-chat__panel {
      display: flex;
      flex-direction: column;
      width: min(23rem, calc(100vw - 2rem));
      height: min(32rem, calc(100vh - 7rem));
      background: #fff;
      border: 1px solid rgb(0 0 0 / 10%);
      border-radius: 0.5rem;
      box-shadow: 0 8px 30px rgb(0 0 0 / 18%);
      overflow: hidden;
    }

    .wh-chat__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0.875rem;
      border-bottom: 1px solid rgb(0 0 0 / 8%);
      font-weight: 600;
      font-size: 0.9375rem;
    }

    .wh-chat__x {
      border: 0;
      background: none;
      font-size: 1.5rem;
      line-height: 1;
      color: var(--wh-quiet, #7a756f);
    }

    .wh-chat__log {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 0.875rem;
      font-size: 0.9375rem;
    }

    .wh-chat__msg {
      margin-bottom: 0.625rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.75rem;
      background: var(--wh-band, #f8f9fd);
      max-width: 90%;
    }

    .wh-chat__msg p:last-child {
      margin-bottom: 0;
    }

    /* The customer's own words, pushed right and tinted, so a glance tells you
       who said what without reading either. */
    .wh-chat__msg--mine {
      margin-left: auto;
      background: #efe3d2;
    }

    .wh-chat__products {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
      margin-bottom: 0.625rem;
    }

    .wh-chat__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-bottom: 0.875rem;
    }

    .wh-chat__thinking {
      color: var(--wh-quiet, #7a756f);
      font-size: 0.875rem;
      margin: 0;
    }

    .wh-chat__ask {
      display: flex;
      gap: 0.375rem;
      padding: 0.625rem;
      border-top: 1px solid rgb(0 0 0 / 8%);
    }

    @media (max-width: 575.98px) {
      .wh-chat__panel {
        height: min(26rem, calc(100vh - 8rem));
      }
    }
  `
})
export class ShopChat implements OnInit {
  private readonly assistant = inject(AssistantService);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  protected readonly offered = signal(false);
  protected readonly ready = signal(false);
  protected readonly open = signal(false);
  protected readonly thinking = signal(false);
  protected readonly working = signal(false);
  protected readonly messages = signal<ShopChatMessage[]>([]);

  constructor() {
    afterNextRender(() => this.ready.set(true));
  }

  ngOnInit(): void {
    this.assistant
      .offered()
      .pipe(
        catchError(() => of(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(offered => this.offered.set(offered));
  }

  protected toggle(): void {
    this.open.update(open => !open);

    if (this.open() && this.messages().length === 0) {
      this.messages.set([
        {
          fromCustomer: false,
          text:
            'Hello. Ask me about delivery, payment, how long something takes, ' +
            'or what the workshop makes.'
        }
      ]);
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  protected send(event: Event): void {
    event.preventDefault();

    const field = this.input()?.nativeElement;
    const question = field?.value.trim() ?? '';

    if (question.length < 2 || this.thinking()) {
      return;
    }

    if (field) {
      field.value = '';
    }

    this.messages.update(list => [...list, { fromCustomer: true, text: question }]);
    this.thinking.set(true);
    this.scroll();

    this.assistant
      .chat(question, this.history())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.thinking.set(false);

          if (!response.isSuccess || !response.data) {
            // The API's own sentence. "Busy, try again in a moment" and
            // "switched off" are different, and both are better than a shrug.
            this.say(response.message || 'Sorry — I could not answer just now.');
            return;
          }

          this.messages.update(list => [
            ...list,
            {
              fromCustomer: false,
              text: response.data!.reply,
              products: response.data!.products,
              actions: response.data!.actions
            }
          ]);

          this.scroll();
        },
        error: () => {
          this.thinking.set(false);
          this.say('Sorry — I could not answer just now. Please try again.');
        }
      });
  }

  /**
   * Carries out what the customer pressed.
   *
   * Every branch is the storefront's own code. The assistant chose which button
   * to show; it has no part in what happens now.
   */
  protected run(action: ShopChatAction): void {
    switch (action.kind) {
      case 'view_product':
        if (action.slug) {
          this.go(['/products', action.slug]);
        }
        break;

      case 'add_to_basket':
        if (action.slug) {
          this.addToBasket(action.slug);
        }
        break;

      case 'view_basket':
        this.go(['/cart']);
        break;

      case 'checkout':
        this.go(['/checkout']);
        break;

      case 'track_order':
        this.go(['/track']);
        break;

      case 'book_consultation':
        this.go(['/consultation']);
        break;
    }
  }

  /**
   * Adds a piece, but only when there is no choice to get wrong.
   *
   * The basket takes a variant, and a product with a wood and a size has
   * several. Picking one on the customer's behalf is how a workshop builds a
   * teak bed for somebody who wanted mahogany — so anything with options opens
   * its own page, where the choice is made deliberately.
   */
  private addToBasket(slug: string): void {
    this.working.set(true);

    this.catalog
      .getProduct(slug)
      .pipe(
        switchMap(product => {
          if (!product) {
            return of(null);
          }

          const variants = product.variants ?? [];

          if (variants.length !== 1) {
            this.go(['/products', slug]);
            return of(null);
          }

          return this.cart.add(variants[0].id, 1);
        }),
        catchError(() => {
          this.say('I could not add that just now. The product page will work.');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        this.working.set(false);

        if (result) {
          this.toast.success('Added to your basket.');
          this.say('Added to your basket.');
        }
      });
  }

  private go(commands: unknown[]): void {
    this.close();
    void this.router.navigate(commands);
  }

  private say(text: string): void {
    this.messages.update(list => [...list, { fromCustomer: false, text }]);
    this.scroll();
  }

  /** The tail of the conversation, which is all the model is given. */
  private history(): ShopChatTurn[] {
    return this.messages()
      .slice(-HistoryTurns)
      .map(message => ({ fromCustomer: message.fromCustomer, text: message.text }));
  }

  private scroll(): void {
    queueMicrotask(() => {
      const element = this.log()?.nativeElement;

      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  protected paragraphs(text: string): string[] {
    return text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}
