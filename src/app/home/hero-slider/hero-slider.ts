import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { StorefrontProduct } from '../../_models/catalog';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { MediaUrlService } from '../../_services/media-url.service';

/** How long a slide holds before the next one fades in. */
const DwellMs = 6000;

/**
 * The home page's fading hero.
 *
 * <b>Real products, not a decorated banner.</b> The template's slides are
 * invented furniture with lorem ipsum under them; these are whatever the shop
 * has marked featured, at the price it is actually asking, so the hero is
 * merchandising rather than scenery and nobody has to remember to update it.
 *
 * <b>It renders as a complete, readable first slide with no JavaScript.</b>
 * The page is server-rendered and this is the first thing a customer sees, so
 * the markup is a plain list of slides with one visible; advancing is an
 * enhancement that begins after hydration. A crawler, a reader with scripting
 * off, and a slow phone all get the first piece and its price.
 */
@Component({
  selector: 'app-hero-slider',
  imports: [RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="wh-hero wh-band"
      aria-roledescription="carousel"
      aria-label="Featured pieces"
      (mouseenter)="hold()"
      (mouseleave)="resume()"
      (focusin)="hold()"
      (focusout)="resume()">
      <div class="container">
        @for (item of slides(); track item.product.id; let i = $index) {
          <div
            class="wh-hero__slide"
            [class.wh-hero__slide--on]="i === index()"
            [attr.aria-hidden]="i === index() ? null : 'true'"
            [attr.inert]="i === index() ? null : ''"
            role="group"
            aria-roledescription="slide"
            [attr.aria-label]="i + 1 + ' of ' + slides().length">
            <div class="row align-items-center g-4">
              <div class="col-12 col-md-7 order-2 order-md-1">
                <p class="wh-hero__eyebrow">{{ item.product.categoryNameEn }}</p>

                <h2 class="wh-hero__title">{{ item.product.nameEn }}</h2>

                @if (item.product.nameBn; as bn) {
                  <p class="wh-hero__bn">{{ bn }}</p>
                }

                @if (item.product.shortDescriptionEn; as blurb) {
                  <p class="wh-hero__blurb">{{ blurb }}</p>
                }

                <p class="wh-hero__price">
                  <span class="wh-price">{{ item.product.fromPrice | taka }}</span>

                  @if (item.product.isOnOffer && item.product.compareAtPrice) {
                    <s class="wh-hero__was">{{ item.product.compareAtPrice | taka }}</s>
                  }
                </p>

                <div class="wh-hero__actions">
                  <a class="btn btn-dark btn-lg" [routerLink]="['/products', item.product.slug]">
                    {{ item.product.variantCount > 1 ? 'Choose options' : 'View this piece' }}
                  </a>
                  <a class="btn btn-lg wh-hero__quiet" routerLink="/products">
                    Browse the collection
                  </a>
                </div>
              </div>

              <div class="col-12 col-md-5 order-1 order-md-2">
                @if (item.image; as url) {
                  <img
                    class="wh-hero__img"
                    [src]="url"
                    [alt]="item.product.primaryImageAlt ?? item.product.nameEn"
                    width="560"
                    height="420"
                    [attr.loading]="i === 0 ? 'eager' : 'lazy'"
                    [attr.fetchpriority]="i === 0 ? 'high' : null"
                    decoding="async" />
                }
              </div>
            </div>
          </div>
        }

        @if (slides().length > 1) {
          <div class="wh-hero__dots">
            @for (item of slides(); track item.product.id; let i = $index) {
              <button
                type="button"
                class="wh-hero__dot"
                [class.wh-hero__dot--on]="i === index()"
                [attr.aria-current]="i === index() ? 'true' : null"
                [attr.aria-label]="'Show ' + item.product.nameEn"
                (click)="show(i)"></button>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .wh-hero {
      position: relative;
      overflow: hidden;
      padding: 3rem 0 2.5rem;
    }

    /* Every slide stays in the flow, stacked into one grid cell, so the band is
       as tall as its tallest slide and nothing jumps as they change. Absolute
       positioning would collapse the section to nothing on the server, where no
       slide has been measured yet. */
    .container {
      display: grid;
    }

    .wh-hero__slide {
      grid-area: 1 / 1;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 0.6s ease-in-out,
        visibility 0.6s;
    }

    .wh-hero__slide--on {
      opacity: 1;
      visibility: visible;
    }

    .wh-hero__eyebrow {
      margin-bottom: 0.5rem;
      color: var(--wh-quiet, #7a756f);
      font-size: 0.875rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .wh-hero__title {
      margin-bottom: 0.25rem;
      font-size: clamp(1.75rem, 4vw, 2.75rem);
      font-weight: 500;
      line-height: 1.2;
    }

    .wh-hero__bn {
      margin-bottom: 0.75rem;
      color: var(--wh-quiet, #7a756f);
      font-size: 1.125rem;
    }

    .wh-hero__blurb {
      max-width: 34rem;
      margin-bottom: 1rem;
      color: var(--wh-quiet, #7a756f);
    }

    .wh-hero__price {
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
    }

    .wh-hero__was {
      margin-inline-start: 0.625rem;
      color: var(--wh-quiet, #7a756f);
      font-size: 1.125rem;
    }

    .wh-hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .wh-hero__quiet {
      border: 1px solid transparent;
      color: var(--wh-accent, #e99c2e);
    }

    .wh-hero__quiet:hover {
      border-color: var(--wh-accent, #e99c2e);
      color: var(--wh-accent, #e99c2e);
    }

    .wh-hero__img {
      display: block;
      width: 100%;
      height: auto;
      object-fit: contain;
    }

    .wh-hero__dots {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }

    .wh-hero__dot {
      width: 0.75rem;
      height: 0.75rem;
      padding: 0;
      border: 1px solid var(--wh-quiet, #7a756f);
      border-radius: 50%;
      background: transparent;
      transition:
        background-color 0.3s linear,
        border-color 0.3s linear;
    }

    .wh-hero__dot--on {
      background: var(--wh-accent, #e99c2e);
      border-color: var(--wh-accent, #e99c2e);
    }

    @media (prefers-reduced-motion: reduce) {
      .wh-hero__slide {
        transition: none;
      }
    }
  `
})
export class HeroSlider implements OnDestroy {
  private readonly media = inject(MediaUrlService);

  readonly products = input.required<StorefrontProduct[]>();

  protected readonly index = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;
  private held = false;

  /**
   * At most three, and only pieces that have a photograph.
   *
   * A hero slide is mostly its picture; one showing a placeholder letter the
   * size of a wardrobe is worse than one fewer slide.
   */
  protected readonly slides = computed(() =>
    this.products()
      .filter(product => !!product.primaryImagePath)
      .slice(0, 3)
      .map(product => ({
        product,
        image: this.media.image(product.primaryImagePath, {
          width: 560,
          height: 420,
          fit: 'limit'
        })
      }))
  );

  constructor() {
    // Browser only: there is nothing to advance on the server, and an interval
    // started during a render would keep that render alive.
    afterNextRender(() => this.start());
  }

  ngOnDestroy(): void {
    this.stop();
  }

  protected show(i: number): void {
    this.index.set(i);
    // Restarted, so a slide somebody has just chosen gets its full dwell rather
    // than whatever was left of the previous one's.
    this.start();
  }

  protected hold(): void {
    this.held = true;
  }

  protected resume(): void {
    this.held = false;
  }

  private start(): void {
    this.stop();

    if (this.slides().length < 2) {
      return;
    }

    // Motion nobody asked for, on the page they landed on. A reader who has
    // said they do not want it keeps the first slide and the dots.
    if (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    this.timer = setInterval(() => {
      if (this.held) {
        return;
      }

      this.index.update(current => (current + 1) % this.slides().length);
    }, DwellMs);
  }

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
