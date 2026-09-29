import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CategoryTree, StorefrontProduct } from '../_models/catalog';
import { CatalogService } from '../_services/catalog.service';
import { SeoService } from '../_services/seo.service';
import { ProductCard } from '../catalog/product-card/product-card';
import { HeroSlider } from './hero-slider/hero-slider';

const ArrivalCount = 8;
const HeroCount = 3;

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, HeroSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The slider needs photographed products to be worth anything. Until
         the shop has some, the flat band below says the same thing and says it
         immediately — which is better than three slides of placeholder tiles
         fading into one another. -->
    @if (hasHero()) {
      <app-hero-slider [products]="featured()" />
    } @else {
      <section class="wh-band py-5">
        <div class="container text-center py-lg-4">
          <h1 class="display-5 fw-normal mb-3">Interiors, made in Bangladesh</h1>
          <p class="lead text-muted mb-4">
            Beds, wardrobes, dining sets, mirrors and lighting — plus interior design consultation.
          </p>
          <a class="btn btn-dark btn-lg" routerLink="/products">Browse the collection</a>
        </div>
      </section>
    }

    @if (categories().length) {
      <section class="container py-5 text-center">
        <h2 class="wh-section-title">Shop by room</h2>
        <p class="wh-section-lead">Every piece made here, to order.</p>

        <div class="row row-cols-2 row-cols-md-4 g-3">
          @for (category of categories(); track category.id) {
            <div class="col">
              <a
                class="btn btn-outline-secondary w-100 text-start"
                routerLink="/products"
                [queryParams]="{ category: category.slug }">
                {{ category.nameEn }}
                <span class="text-muted small d-block">{{ category.productCount }} products</span>
              </a>
            </div>
          }
        </div>
      </section>
    }

    @if (arrivals().length) {
      <section class="container pb-5">
        <div class="text-center">
          <h2 class="wh-section-title">New arrivals</h2>
          <p class="wh-section-lead">
            The most recent pieces off the workshop floor.
            <a routerLink="/products">See all</a>
          </p>
        </div>

        <div class="row row-cols-2 row-cols-md-4 g-3">
          @for (product of arrivals(); track product.id) {
            <div class="col">
              <app-product-card [product]="product" />
            </div>
          }
        </div>
      </section>
    }
  `
})
export class Home implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categories = signal<CategoryTree[]>([]);
  protected readonly arrivals = signal<StorefrontProduct[]>([]);

  private readonly flagged = signal<StorefrontProduct[]>([]);

  /**
   * What the hero shows.
   *
   * The shop's own choice first. Nothing is flagged featured on a fresh
   * install, though, and an empty hero on the landing page is a worse answer
   * than a recent piece — so it falls back to the newest arrivals. Either way
   * the slider itself keeps only the ones with a photograph, because a hero
   * slide is mostly its picture.
   */
  protected readonly featured = computed(() =>
    this.flagged().length > 0 ? this.flagged() : this.arrivals().slice(0, HeroCount)
  );

  /** True once there is at least one featured or recent piece with a photo. */
  protected readonly hasHero = computed(() =>
    this.featured().some(product => !!product.primaryImagePath)
  );

  ngOnInit(): void {
    this.seo.apply({
      title: 'Interiors, made in Bangladesh',
      description:
        'Handmade beds, wardrobes, sofas, dining sets and lighting, plus interior design consultation. WoodHeart, Bangladesh.',
      canonicalPath: '/'
    });

    this.seo.setJsonLd(null);

    // Both failures collapse to an empty list rather than an error panel. This
    // is the page a customer lands on from a search result: an apology where
    // the furniture should be costs more than a shorter page, and the header,
    // hero and navigation still work.
    // Featured pieces carry the hero. Asked for separately rather than
    // filtered out of the arrivals, because "what the shop wants to show" and
    // "what it made most recently" are different questions and the shop
    // answers the first one itself, with a flag on the product.
    this.catalog
      .search({ pageSize: HeroCount, isFeatured: true })
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => this.flagged.set(result?.result ?? []));

    this.catalog
      .getCategories()
      .pipe(
        catchError(() => of([] as CategoryTree[])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(categories => this.categories.set(categories));

    this.catalog
      .search({ pageSize: ArrivalCount, sortBy: 'RecentlyPublished' })
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(page => this.arrivals.set(page?.result ?? []));
  }
}
