import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StorefrontProduct } from '../../_models/catalog';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { MediaUrlService } from '../../_services/media-url.service';

/**
 * One product card.
 *
 * Presentational: it takes a product and emits nothing. Every listing that
 * shows products — the category listing, a collection, "related products",
 * and the featured grid on the home page — renders this, so a change to how a
 * price or an offer badge reads happens once.
 */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="wh-card">
      <!-- The tile, the title and the action bar are three separate links
           rather than one anchor wrapping the lot. Nesting a link inside a link
           is invalid, and a single card-sized anchor gives a screen reader one
           enormous target whose name is the whole card. -->
      <div class="wh-tile">
        <a
          class="wh-tile__link"
          [routerLink]="['/products', product().slug]"
          tabindex="-1"
          aria-hidden="true">
          @if (imageUrl(); as url) {
            <img
              [src]="url"
              [srcset]="srcset()"
              sizes="(min-width: 992px) 300px, (min-width: 768px) 33vw, 50vw"
              [alt]="product().primaryImageAlt ?? product().nameEn"
              width="400"
              height="300"
              loading="lazy"
              decoding="async" />
          } @else {
            <!-- A neutral tile is deliberate: a broken image is worse than an
                 honest blank, and a stock photograph of someone else's
                 furniture is worse than both. -->
            <div class="wh-tile__empty" aria-hidden="true">
              <span>{{ initial() }}</span>
            </div>
          }
        </a>

        <span class="wh-tile__wash" aria-hidden="true"></span>

        @if (product().isOnOffer && product().discountPercent) {
          <span class="wh-flag">-{{ product().discountPercent }}%</span>
        }

        <!-- Slides up on hover, and appears on keyboard focus too: a control
             that only exists for a pointer is a control nobody navigating by
             keyboard can reach. -->
        <a class="wh-tile__bar" [routerLink]="['/products', product().slug]">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5c5 0 8.7 3.6 10 7-1.3 3.4-5 7-10 7S3.3 15.4 2 12c1.3-3.4 5-7 10-7zm0 2.5A4.5 4.5 0 1016.5 12 4.5 4.5 0 0012 7.5zm0 2A2.5 2.5 0 119.5 12 2.5 2.5 0 0112 9.5z" />
          </svg>
          <!-- Not "add to cart", which is what the template says. Almost
               everything this shop sells has a wood and a size to choose, and
               the list API carries no variant id, so there is nothing a card
               could honestly put in a basket. -->
          {{ product().variantCount > 1 ? 'Choose options' : 'View this piece' }}
        </a>
      </div>

      <div class="wh-card__body">
        <p class="wh-card__eyebrow">{{ product().categoryNameEn }}</p>

        <h3 class="wh-card__title">
          <a [routerLink]="['/products', product().slug]">{{ product().nameEn }}</a>
        </h3>

        @if (product().nameBn; as bn) {
          <p class="wh-card__bn">{{ bn }}</p>
        }

        <p class="wh-card__price">
          @if (product().variantCount > 1) {
            <span class="wh-card__from">from </span>
          }
          <span class="wh-price">{{ product().fromPrice | taka }}</span>

          @if (product().isOnOffer && product().compareAtPrice) {
            <s class="wh-card__was">{{ product().compareAtPrice | taka }}</s>
          }
        </p>

        @if (product().leadTimeDays; as days) {
          <p class="wh-card__lead">Made to order - about {{ days }} working days</p>
        }
      </div>
    </article>
  `,
  styles: `
    .wh-card {
      height: 100%;
      text-align: center;
    }

    .wh-tile {
      position: relative;
      /* A fixed ratio, so a grid of cards does not reflow as images arrive.
         The row heights are settled before the first byte of any image. */
      aspect-ratio: 4 / 3;
      overflow: hidden;
      background: var(--wh-tile, #f8f9fc);
    }

    .wh-tile__link {
      display: block;
      height: 100%;
    }

    .wh-tile img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s linear;
    }

    /* The template scales to 1.3. At that size a bed shot tight in its frame
       loses its own headboard, so this stops at 1.12: enough to feel alive,
       little enough to still show the piece being sold. */
    .wh-card:hover .wh-tile img {
      transform: scale(1.12);
    }

    .wh-tile__empty {
      display: grid;
      place-items: center;
      height: 100%;
      color: #b9ada0;
      font-size: 2.5rem;
      font-weight: 600;
    }

    .wh-tile__wash {
      position: absolute;
      inset: 0;
      background: rgb(106 119 129 / 10%);
      opacity: 0;
      transition: opacity 0.3s linear;
      pointer-events: none;
    }

    .wh-card:hover .wh-tile__wash {
      opacity: 1;
    }

    .wh-flag {
      position: absolute;
      top: 0.625rem;
      inset-inline-end: 0;
      min-width: 3.75rem;
      padding: 0.25rem 0.5rem;
      background: #d8924c;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .wh-tile__bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: -0.875rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 2.5rem;
      background: #33383c;
      color: #fff;
      font-size: 0.8125rem;
      text-decoration: none;
      opacity: 0;
      visibility: hidden;
      transition:
        bottom 0.3s linear,
        opacity 0.3s linear;
    }

    .wh-tile__bar svg {
      width: 1rem;
      height: 1rem;
      fill: currentColor;
    }

    .wh-card:hover .wh-tile__bar,
    .wh-tile__bar:focus-visible {
      opacity: 1;
      visibility: visible;
      bottom: 0;
    }

    .wh-tile__bar:hover,
    .wh-tile__bar:focus {
      color: #fff;
    }

    /* Touch has no hover: on a phone the bar would either never appear or,
       with emulated hover, appear only after a tap meant to open the product.
       The tile itself is a link there, so the bar is simply gone. */
    @media (hover: none) {
      .wh-tile__bar {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .wh-tile img,
      .wh-tile__wash,
      .wh-tile__bar {
        transition: none;
      }

      .wh-card:hover .wh-tile img {
        transform: none;
      }
    }

    .wh-card__body {
      padding: 1.25rem 0.5rem 0;
    }

    .wh-card__eyebrow {
      margin-bottom: 0.25rem;
      color: var(--wh-quiet, #7a756f);
      font-size: 0.8125rem;
    }

    .wh-card__title {
      margin-bottom: 0.25rem;
      font-size: 1rem;
      font-weight: 500;
    }

    .wh-card__title a {
      color: var(--wh-ink, #5f5b57);
      text-decoration: none;
      transition: color 0.3s linear;
    }

    .wh-card:hover .wh-card__title a {
      color: var(--wh-accent, #e99c2e);
    }

    .wh-card__bn,
    .wh-card__lead {
      margin-bottom: 0.25rem;
      color: var(--wh-quiet, #7a756f);
      font-size: 0.8125rem;
    }

    .wh-card__price {
      margin-bottom: 0.25rem;
    }

    .wh-card__from,
    .wh-card__was {
      color: var(--wh-quiet, #7a756f);
      font-size: 0.875rem;
    }

    .wh-card__was {
      margin-inline-start: 0.375rem;
    }
  `
})
export class ProductCard {
  private readonly media = inject(MediaUrlService);

  readonly product = input.required<StorefrontProduct>();

  /**
   * The fallback `src`, for a browser that ignores `srcset`.
   *
   * 400x300 rather than the largest available: this is what an old browser
   * downloads, and it is better for it to get a slightly soft card than four
   * megabytes.
   */
  protected readonly imageUrl = computed(() =>
    this.media.image(this.product().primaryImagePath, {
      width: 400,
      height: 300,
      fit: 'fill'
    })
  );

  /**
   * Cropped to 4:3 at every width, matching the CSS box below.
   *
   * Cropping rather than fitting is deliberate on a card: a grid of
   * photographs at nine different aspect ratios reads as a mistake, whatever
   * the individual pictures look like.
   */
  protected readonly srcset = computed(() =>
    this.media.srcset(this.product().primaryImagePath, 4 / 3)
  );

  protected readonly initial = computed(() => this.product().nameEn.charAt(0).toUpperCase());
}
