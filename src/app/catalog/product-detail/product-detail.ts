import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import {
  StorefrontMedia,
  StorefrontProduct,
  StorefrontProductDetail,
  StorefrontVariant
} from '../../_models/catalog';
import { CatalogService } from '../../_services/catalog.service';
import { SeoService } from '../../_services/seo.service';
import { ServerResponseService } from '../../_services/server-response.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { ProductCard } from '../product-card/product-card';

/**
 * A product page.
 *
 * Addressed by slug, because the slug is the URL — an id-addressed product page
 * would need a redirect to the canonical address on every request, or it would
 * split the page's ranking across two URLs.
 *
 * <b>This page's SEO is not decoration.</b> It is how a furniture shop in Dhaka
 * is found at all, so the title, description, canonical, share card and
 * structured data all come from the server-rendered HTML rather than being
 * filled in after hydration, and a slug that does not exist answers a real 404
 * rather than 200 with an apology on it.
 */
@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, TakaPipe, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notFound()) {
      <div class="container py-5 text-center">
        <h1 class="h4">We could not find that product</h1>
        <p class="text-muted">It may have been discontinued, or the link may be out of date.</p>
        <a class="btn btn-dark" routerLink="/products">Browse the collection</a>
      </div>
    } @else if (product(); as item) {
      <div class="container py-4">
        <nav aria-label="Breadcrumb">
          <ol class="breadcrumb small">
            <li class="breadcrumb-item"><a routerLink="/">Home</a></li>
            <li class="breadcrumb-item"><a routerLink="/products">Shop</a></li>

            @for (crumb of item.breadcrumbs; track crumb.slug) {
              <li class="breadcrumb-item">
                <a routerLink="/products" [queryParams]="{ category: crumb.slug }">
                  {{ crumb.nameEn }}
                </a>
              </li>
            }

            <li class="breadcrumb-item active" aria-current="page">{{ item.nameEn }}</li>
          </ol>
        </nav>

        <div class="row g-4">
          <div class="col-12 col-lg-7">
            @if (activeImage(); as image) {
              @if (image.mediaType === 'Video') {
                <video
                  class="w-100 rounded border"
                  controls
                  preload="metadata"
                  [poster]="videoPoster(image)"
                  [src]="videoUrl(image)"></video>
              } @else {
                <img
                  class="w-100 rounded border"
                  [src]="heroUrl(image)"
                  [srcset]="heroSrcset(image)"
                  sizes="(min-width: 992px) 640px, 100vw"
                  [alt]="image.altText ?? item.nameEn"
                  [attr.width]="image.width"
                  [attr.height]="image.height"
                  fetchpriority="high" />
              }
            } @else {
              <div class="wh-hero-empty rounded border" aria-hidden="true">
                <span>{{ item.nameEn.charAt(0).toUpperCase() }}</span>
              </div>
            }

            @if (gallery().length > 1) {
              <div class="d-flex gap-2 mt-2 flex-wrap">
                @for (image of gallery(); track image.id) {
                  <button
                    class="btn p-0 border rounded wh-thumb-button"
                    type="button"
                    [class.border-dark]="image.id === activeImageId()"
                    [attr.aria-label]="image.caption ?? 'View image'"
                    [attr.aria-pressed]="image.id === activeImageId()"
                    (click)="activeImageId.set(image.id)">
                    <img
                      [src]="thumbUrl(image)"
                      [alt]="image.altText ?? ''"
                      width="72"
                      height="72"
                      loading="lazy" />
                  </button>
                }
              </div>
            }
          </div>

          <div class="col-12 col-lg-5">
            <p class="small text-muted mb-1">{{ item.categoryNameEn }}</p>

            <h1 class="h3 mb-1">{{ item.nameEn }}</h1>

            @if (item.nameBn; as bn) {
              <p class="text-muted mb-3">{{ bn }}</p>
            }

            <p class="h4 mb-1">
              {{ price() | taka }}

              @if (compareAtPrice(); as was) {
                <s class="h6 text-muted ms-2">{{ was | taka }}</s>
              }
            </p>

            @if (item.productType === 'MadeToOrder' && item.leadTimeDays) {
              <p class="small text-muted">
                Made to order &middot; about {{ item.leadTimeDays }} working days
              </p>
            }

            @if (item.shortDescriptionEn; as summary) {
              <p class="mt-3">{{ summary }}</p>
            }

            @if (item.variants.length > 1) {
              <div class="mt-3">
                <h2 class="h6 text-uppercase text-muted">Options</h2>

                <!-- Whole variants rather than one picker per option
                     (wood, size, finish). Independent pickers let a customer
                     assemble a combination that was never built, and then need
                     disabling rules to walk it back. Every button here is a row
                     that exists, with the price it actually costs. -->
                <div class="d-flex flex-wrap gap-2">
                  @for (variant of item.variants; track variant.id) {
                    <button
                      class="btn btn-sm"
                      type="button"
                      [class.btn-dark]="variant.id === selectedVariantId()"
                      [class.btn-outline-secondary]="variant.id !== selectedVariantId()"
                      [attr.aria-pressed]="variant.id === selectedVariantId()"
                      (click)="selectedVariantId.set(variant.id)">
                      {{ variant.variantName }}
                    </button>
                  }
                </div>

                @if (selectedVariant(); as variant) {
                  <p class="small text-muted mt-2 mb-0">SKU {{ variant.sku }}</p>
                }
              </div>
            }

            <div class="d-grid gap-2 mt-4">
              <!-- Disabled until the basket exists in Phase 2. Shown rather
                   than hidden so the page reads as finished furniture retail
                   and the layout does not move when it is wired up. -->
              <button class="btn btn-dark btn-lg" type="button" disabled>
                Add to basket (coming soon)
              </button>
              <a class="btn btn-outline-dark" routerLink="/consultation">
                Ask about this product
              </a>
            </div>

            @if (item.deliverySurcharge) {
              <p class="small text-muted mt-3 mb-0">
                Delivery surcharge {{ item.deliverySurcharge | taka }}
              </p>
            }
          </div>
        </div>

        @if (item.descriptionEn || item.descriptionBn) {
          <section class="mt-5">
            <h2 class="h5">Description</h2>

            @if (item.descriptionEn; as text) {
              <p class="mb-2">{{ text }}</p>
            }

            @if (item.descriptionBn; as text) {
              <p class="text-muted mb-0" lang="bn">{{ text }}</p>
            }
          </section>
        }

        @if (specifications().length) {
          <section class="mt-5">
            <h2 class="h5">Specifications</h2>

            <div class="table-responsive">
              <table class="table table-sm w-auto">
                <tbody>
                  @for (spec of specifications(); track spec.label) {
                    <tr>
                      <th scope="row" class="fw-normal text-muted pe-4">{{ spec.label }}</th>
                      <td>{{ spec.value }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (related().length) {
          <section class="mt-5">
            <h2 class="h5 mb-3">You may also like</h2>

            <div class="row row-cols-2 row-cols-md-4 g-3">
              @for (other of related(); track other.id) {
                <div class="col">
                  <app-product-card [product]="other" />
                </div>
              }
            </div>
          </section>
        }
      </div>
    } @else if (failed()) {
      <div class="container py-5 text-center">
        <h1 class="h4">We could not load that product</h1>
        <p class="text-muted">Please refresh the page and try again.</p>
      </div>
    }
  `,
  styles: `
    .wh-hero-empty {
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      background: #f7f4f0;
      color: #b9ada0;
      font-size: 5rem;
      font-weight: 600;
    }

    .wh-thumb-button {
      width: 72px;
      height: 72px;
      overflow: hidden;
    }

    .wh-thumb-button img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `
})
export class ProductDetail implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly serverResponse = inject(ServerResponseService);
  private readonly media = inject(MediaUrlService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the route by `withComponentInputBinding`. */
  readonly slug = input.required<string>();

  /**
   * The slug as a stream, converted in a field initializer because
   * `toObservable` needs an injection context and `ngOnInit` is not one.
   *
   * It has to be a stream at all because the router reuses this component
   * instance for /products/a to /products/b — which is exactly the navigation
   * "You may also like" produces. Reading the input once in `ngOnInit` would
   * leave the first product on screen for ever.
   */
  private readonly slug$ = toObservable(this.slug);

  protected readonly product = signal<StorefrontProductDetail | null>(null);
  protected readonly related = signal<StorefrontProduct[]>([]);
  protected readonly notFound = signal(false);
  protected readonly failed = signal(false);

  protected readonly selectedVariantId = signal<number | null>(null);
  protected readonly activeImageId = signal<number | null>(null);

  protected readonly selectedVariant = computed<StorefrontVariant | null>(() => {
    const item = this.product();

    if (!item) {
      return null;
    }

    const id = this.selectedVariantId();

    return (
      item.variants.find(variant => variant.id === id) ??
      item.variants.find(variant => variant.isDefault) ??
      item.variants[0] ??
      null
    );
  });

  /**
   * The price shown, which follows the selected variant.
   *
   * Falls back to `fromPrice` only when a product somehow has no variants. The
   * backend's invariant is that every product has at least one, so this branch
   * should be unreachable — but a page that renders no price at all is a page
   * that sells nothing, so it does not throw.
   */
  protected readonly price = computed(
    () => this.selectedVariant()?.price ?? this.product()?.fromPrice ?? 0
  );

  protected readonly compareAtPrice = computed(() => {
    const variant = this.selectedVariant();

    return variant?.isOnOffer ? (variant.compareAtPrice ?? null) : null;
  });

  /**
   * Images and video. A PDF assembly guide is not something to put in a gallery.
   */
  protected readonly gallery = computed<StorefrontMedia[]>(
    () =>
      this.product()?.media.filter(
        media => media.mediaType === 'Image' || media.mediaType === 'Video'
      ) ?? []
  );

  protected readonly activeImage = computed<StorefrontMedia | null>(() => {
    const items = this.gallery();
    const id = this.activeImageId();

    return (
      items.find(item => item.id === id) ??
      items.find(item => item.isPrimary) ??
      // A photograph before a video when nothing is selected. Landing on a
      // product page and being shown a black player where the furniture should
      // be is the wrong first impression, and the primary is always an image.
      items.find(item => item.mediaType === 'Image') ??
      items[0] ??
      null
    );
  });

  protected readonly specifications = computed(() => {
    const item = this.product();

    if (!item) {
      return [];
    }

    const dimensions = [item.lengthCm, item.widthCm, item.heightCm];

    return [
      { label: 'Material', value: item.material },
      { label: 'Finish', value: item.finishType },
      {
        label: 'Dimensions',
        // Only when all three are known: "180 × ? × 120 cm" is worse than
        // saying nothing, and a partial figure is the one a customer measures
        // their room against.
        value: dimensions.every(value => value !== null && value !== undefined)
          ? `${dimensions[0]} × ${dimensions[1]} × ${dimensions[2]} cm`
          : null
      },
      { label: 'Weight', value: item.weightKg ? `${item.weightKg} kg` : null },
      { label: 'Warranty', value: item.warrantyMonths ? `${item.warrantyMonths} months` : null },
      { label: 'Assembly', value: item.assemblyRequired ? 'Required on delivery' : null },
      { label: 'Brand', value: item.brandNameEn }
    ].filter((spec): spec is { label: string; value: string } => !!spec.value);
  });

  ngOnInit(): void {
    this.slug$
      .pipe(
        tap(() => this.reset()),
        switchMap(slug =>
          this.catalog.getProduct(slug).pipe(
            catchError((error: { status?: number }) => {
              if (error.status === 404) {
                this.notFound.set(true);
              } else {
                this.failed.set(true);
              }

              return of(null);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(item => this.onProduct(item));
  }

  private reset(): void {
    this.product.set(null);
    this.related.set([]);
    this.notFound.set(false);
    this.failed.set(false);
    this.selectedVariantId.set(null);
    this.activeImageId.set(null);
  }

  private onProduct(item: StorefrontProductDetail | null): void {
    if (!item) {
      if (this.notFound()) {
        this.applyNotFoundSeo();
      }

      return;
    }

    this.product.set(item);
    this.selectedVariantId.set(
      item.variants.find(variant => variant.isDefault)?.id ?? item.variants[0]?.id ?? null
    );

    this.applySeo(item);

    this.catalog
      .getRelated(item.slug)
      .pipe(
        catchError(() => of([] as StorefrontProduct[])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(others => this.related.set(others));
  }

  private applySeo(item: StorefrontProductDetail): void {
    this.seo.apply({
      title: item.seo.title,
      description: item.seo.description,
      canonicalPath: item.seo.canonicalPath,
      imagePath: item.seo.ogImagePath,
      type: 'product'
    });

    this.seo.setJsonLd(this.productSchema(item));
  }

  private applyNotFoundSeo(): void {
    // The status is what stops this being a soft 404 — a 200 with "not found"
    // on it gets indexed and then competes with the real product pages.
    this.serverResponse.notFound();

    this.seo.apply({
      title: 'Product not found',
      canonicalPath: `/products/${this.slug()}`,
      noIndex: true
    });

    this.seo.setJsonLd(null);
  }

  private productSchema(item: StorefrontProductDetail): Record<string, unknown> {
    const prices = item.variants.map(variant => variant.price);
    const image = item.seo.ogImagePath ? [this.seo.media(item.seo.ogImagePath)] : undefined;

    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: item.nameEn,
      description: item.seo.description ?? item.shortDescriptionEn ?? undefined,
      sku: item.variants.find(variant => variant.isDefault)?.sku,
      category: item.categoryNameEn,
      material: item.material ?? undefined,
      image,
      brand: item.brandNameEn ? { '@type': 'Brand', name: item.brandNameEn } : undefined,
      // AggregateOffer when there is a range to state, a single Offer when
      // there is not. Sending an AggregateOffer whose low and high are equal is
      // valid and reads, in a search result, as a product with one price
      // described in the most confusing way available.
      offers:
        prices.length > 1
          ? {
              '@type': 'AggregateOffer',
              priceCurrency: item.currency,
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              offerCount: prices.length,
              url: this.seo.absolute(item.seo.canonicalPath)
            }
          : {
              '@type': 'Offer',
              priceCurrency: item.currency,
              price: prices[0] ?? item.fromPrice,
              url: this.seo.absolute(item.seo.canonicalPath)
            },
      // Only when there are real reviews. An aggregateRating with a count of
      // zero is a structured-data error, and inventing one is the kind of thing
      // that gets rich results turned off for a whole domain.
      aggregateRating:
        item.reviewCount > 0 && item.averageRating
          ? {
              '@type': 'AggregateRating',
              ratingValue: item.averageRating,
              reviewCount: item.reviewCount
            }
          : undefined
    };
  }

  // The hero is the largest thing on the page and the Largest Contentful Paint
  // on every product URL, so it gets a full srcset and fetchpriority="high".
  protected heroUrl(media: StorefrontMedia): string | null {
    return media.externalUrl ?? this.media.image(media.storagePath, { width: 1024, fit: 'limit' });
  }

  protected heroSrcset(media: StorefrontMedia): string | null {
    // No aspect ratio, so `c_limit`: the whole photograph, uncropped. A card
    // can crop a sofa; the page selling it cannot.
    return media.externalUrl ? null : this.media.srcset(media.storagePath);
  }

  protected thumbUrl(media: StorefrontMedia): string | null {
    if (media.externalUrl) {
      return media.externalUrl;
    }

    // A video's thumbnail is a still from its first frame, not the video.
    return media.mediaType === 'Video'
      ? this.media.videoPoster(media.storagePath, 144)
      : this.media.image(media.storagePath, { width: 144, height: 144, fit: 'fill' });
  }

  protected videoUrl(media: StorefrontMedia): string | null {
    return media.externalUrl ?? this.media.video(media.storagePath);
  }

  protected videoPoster(media: StorefrontMedia): string | null {
    return media.externalUrl ? null : this.media.videoPoster(media.storagePath, 1024);
  }
}
