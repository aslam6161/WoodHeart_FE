import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StorefrontProduct } from '../_models/catalog';
import { Pagination } from '../_models/pagination';
import { CatalogService } from '../_services/catalog.service';
import { SeoService } from '../_services/seo.service';
import { ProductCard } from '../catalog/product-card/product-card';
import { HeroSlider } from './hero-slider/hero-slider';

/** One screenful at a time — two rows of four on a desktop grid. */
const PageSize = 8;
const HeroCount = 3;

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, HeroSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The band below is for an empty shop, and only for an empty shop: with
         nothing to put in it a carousel is three blank slides, and a sentence
         about what the workshop makes is worth more than that. -->
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

    @if (products().length) {
      <section class="container py-5">
        <div class="text-center">
          <h2 class="wh-section-title">The collection</h2>
          <p class="wh-section-lead">
            Newest first, and it keeps going as you scroll.
            <a routerLink="/products">Filter and sort</a>
          </p>
        </div>

        <div class="row row-cols-2 row-cols-md-4 g-3">
          @for (product of products(); track product.id) {
            <div class="col">
              <app-product-card [product]="product" />
            </div>
          }
        </div>

        <!-- A real button, which is also what the observer watches. Scrolling
             towards it fetches the next page before it is on screen; pressing
             it does the same thing, so a keyboard, a reader, or a browser
             without IntersectionObserver is never stranded at the bottom of a
             page that will only grow for a mouse. -->
        @if (hasMore()) {
          <div class="text-center pt-4">
            <button
              #more
              class="btn btn-outline-secondary"
              type="button"
              [disabled]="loading()"
              (click)="loadMore()">
              {{ loading() ? 'Loading…' : 'Show more pieces' }}
            </button>
          </div>
        }

        <p class="visually-hidden" role="status" aria-live="polite">
          Showing {{ products().length }} of {{ total() }} pieces
        </p>
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

  protected readonly products = signal<StorefrontProduct[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);

  private readonly page = signal(1);
  private readonly pages = signal(1);
  private readonly flagged = signal<StorefrontProduct[]>([]);

  /** There is a page after the one we are showing. */
  protected readonly hasMore = computed(() => this.page() < this.pages());

  private readonly more = viewChild<ElementRef<HTMLElement>>('more');
  private observer: IntersectionObserver | null = null;

  /**
   * What the hero shows.
   *
   * The shop's own choice first. Nothing is flagged featured on a fresh
   * install, though, and an empty hero on the landing page is a worse answer
   * than a recent piece — so it falls back to the first of the newest, which
   * the first page has already fetched. The slider decides the order within
   * them: photographed pieces lead.
   */
  protected readonly featured = computed(() =>
    this.flagged().length > 0 ? this.flagged() : this.products().slice(0, HeroCount)
  );

  /** True once there is anything to put in it. */
  protected readonly hasHero = computed(() => this.featured().length > 0);

  constructor() {
    // Re-aimed whenever the button appears or goes away, and built on first
    // use so the server — which has no viewport and no observer — skips it.
    effect(() => {
      const button = this.more()?.nativeElement;

      if (typeof IntersectionObserver === 'undefined') {
        return;
      }

      this.observer ??= new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            this.loadMore();
          }
        },
        // Fetches a screenful early, so the next row is usually in place
        // before the reader arrives at the gap where it goes.
        { rootMargin: '400px 0px' }
      );

      this.observer.disconnect();

      if (button) {
        this.observer.observe(button);
      }
    });

    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  /**
   * The next page, appended.
   *
   * Guarded on both sides: the flag stops the observer firing twice for one
   * gap, and ids already on the page are dropped. That second guard is not
   * theoretical — publishing a piece while somebody is scrolling shifts
   * everything down a place, and a repeated id in a `@for` block whose
   * `track` is that id is a runtime error, not a duplicate tile.
   */
  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) {
      return;
    }

    this.loading.set(true);

    this.catalog
      .search({
        pageNumber: this.page() + 1,
        pageSize: PageSize,
        sortBy: 'RecentlyPublished'
      })
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(page => {
        this.loading.set(false);

        // A failed or empty page ends the scroll rather than leaving a button
        // that asks again for the same thing.
        if (!page?.result?.length) {
          this.pages.set(this.page());
          return;
        }

        this.append(page.result);
        this.readPaging(page.pagination);
      });
  }

  private append(batch: StorefrontProduct[]): void {
    this.products.update(current => {
      const seen = new Set(current.map(product => product.id));
      return [...current, ...batch.filter(product => !seen.has(product.id))];
    });
  }

  private readPaging(pagination: Pagination | undefined): void {
    // No header means no way to know there is another page, so what is on the
    // screen is treated as the whole catalogue rather than scrolled forever.
    if (!pagination) {
      this.pages.set(this.page());
      this.total.set(this.products().length);
      return;
    }

    this.page.set(pagination.currentPage);
    this.pages.set(pagination.totalPages);
    this.total.set(pagination.totalItems);
  }

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

    // The first page only. The rest arrive as the reader scrolls, so the
    // landing page stays one screenful of work for a phone on mobile data
    // however large the catalogue grows.
    this.catalog
      .search({ pageNumber: 1, pageSize: PageSize, sortBy: 'RecentlyPublished' })
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(page => {
        this.products.set(page?.result ?? []);
        this.readPaging(page?.pagination);
      });
  }
}
