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
import { Router, RouterLink } from '@angular/router';
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

    <!-- Sits under the hero rather than inside it: the hero already asks for
         a click, and two calls to action in one band means neither is the
         obvious one. -->
    <section class="wh-find">
      <div class="container">
        <form class="wh-find__form" role="search" (submit)="onSearch($event)">
          <label class="visually-hidden" for="home-search">Search the catalogue</label>

          <input
            id="home-search"
            class="form-control form-control-lg wh-find__input"
            type="search"
            name="q"
            autocomplete="off"
            placeholder="Search beds, wardrobes, sofas…" />

          <!-- A real submit button, not an icon with a click handler. It gives
               the on-screen keyboard its Go key, which is how most of this
               audience submits anything. -->
          <button class="btn btn-dark btn-lg wh-find__go" type="submit">Search</button>
        </form>
      </div>
    </section>

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
  `,
  styles: `
    .wh-find {
      padding: 2.5rem 0 0.5rem;
    }

    .wh-find__form {
      display: flex;
      gap: 0.5rem;
      max-width: 34rem;
      margin: 0 auto;
    }

    .wh-find__input {
      flex: 1 1 auto;
      min-width: 0;
    }

    .wh-find__go {
      flex: 0 0 auto;
    }
  `
})
export class Home implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

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

  /**
   * Hands the term to the listing rather than searching here.
   *
   * The listing already keeps every piece of its state in the query string, so
   * a search from this page produces exactly the URL a search from that page
   * does — one that can be shared, bookmarked and gone back to. A second
   * search implementation on the home page would be a second set of rules
   * about sorting, paging and what an empty term means.
   *
   * An empty box goes to the whole catalogue, which is what "search for
   * nothing" honestly means, and is more use than refusing to move.
   */
  protected onSearch(event: Event): void {
    event.preventDefault();

    const raw = new FormData(event.target as HTMLFormElement).get('q');
    const term = typeof raw === 'string' ? raw.trim() : '';

    this.router.navigate(['/products'], {
      queryParams: term ? { q: term } : {}
    });
  }

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
