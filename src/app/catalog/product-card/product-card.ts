import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StorefrontProduct } from '../../_models/catalog';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { SeoService } from '../../_services/seo.service';

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
    <article class="card h-100 wh-card">
      <a class="text-decoration-none text-reset" [routerLink]="['/products', product().slug]">
        <div class="wh-thumb">
          @if (imageUrl(); as url) {
            <img
              [src]="url"
              [alt]="product().primaryImageAlt ?? product().nameEn"
              loading="lazy"
              decoding="async" />
          } @else {
            <!-- No media pipeline yet, so most products have no image. A
                 neutral tile is deliberate: a broken <img> is worse than an
                 honest blank, and a stock photograph of someone else's
                 furniture is worse than both. -->
            <div class="wh-thumb-empty" aria-hidden="true">
              <span>{{ initial() }}</span>
            </div>
          }

          @if (product().isOnOffer && product().discountPercent) {
            <span class="badge text-bg-danger wh-badge">−{{ product().discountPercent }}%</span>
          }
        </div>

        <div class="card-body">
          <p class="small text-muted mb-1">{{ product().categoryNameEn }}</p>

          <h3 class="h6 card-title mb-1">{{ product().nameEn }}</h3>

          @if (product().nameBn; as bn) {
            <p class="small text-muted mb-2">{{ bn }}</p>
          }

          <p class="mb-1">
            <!-- "from" only when there is more than one variant to choose
                 between. On a single-variant product it reads as a hedge. -->
            @if (product().variantCount > 1) {
              <span class="small text-muted">from </span>
            }
            <span class="fw-semibold">{{ product().fromPrice | taka }}</span>

            @if (product().isOnOffer && product().compareAtPrice) {
              <s class="small text-muted ms-1">{{ product().compareAtPrice | taka }}</s>
            }
          </p>

          @if (product().leadTimeDays; as days) {
            <p class="small text-muted mb-0">Made to order · about {{ days }} working days</p>
          }
        </div>
      </a>
    </article>
  `,
  styles: `
    .wh-card {
      transition: box-shadow 0.15s ease-in-out;
    }

    .wh-card:hover {
      box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 10%);
    }

    .wh-thumb {
      position: relative;
      /* A fixed ratio, so a grid of cards does not reflow as images arrive.
         The row heights are settled before the first byte of any image. */
      aspect-ratio: 4 / 3;
      overflow: hidden;
      background: #f7f4f0;
    }

    .wh-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .wh-thumb-empty {
      display: grid;
      place-items: center;
      height: 100%;
      color: #b9ada0;
      font-size: 2.5rem;
      font-weight: 600;
    }

    .wh-badge {
      position: absolute;
      top: 0.5rem;
      inset-inline-start: 0.5rem;
    }
  `
})
export class ProductCard {
  private readonly seo = inject(SeoService);

  readonly product = input.required<StorefrontProduct>();

  protected readonly imageUrl = computed(() => {
    const path = this.product().primaryImagePath;
    return path ? this.seo.media(path) : null;
  });

  protected readonly initial = computed(() => this.product().nameEn.charAt(0).toUpperCase());
}
