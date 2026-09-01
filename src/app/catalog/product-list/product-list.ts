import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { CategoryTree, ProductQuery, ProductSort, StorefrontProduct } from '../../_models/catalog';
import { Pagination } from '../../_models/pagination';
import { CatalogService } from '../../_services/catalog.service';
import { SeoService } from '../../_services/seo.service';
import { ProductCard } from '../product-card/product-card';
import { CategoryFilter } from '../category-filter/category-filter';

const PageSize = 24;

/** The sorts offered to a customer, in the order the select shows them. */
const SortOptions: ReadonlyArray<{ value: ProductSort; label: string }> = [
  { value: 'RecentlyPublished', label: 'New arrivals' },
  { value: 'PriceLowToHigh', label: 'Price: low to high' },
  { value: 'PriceHighToLow', label: 'Price: high to low' }
];

/**
 * The shop listing: filters on the left, a grid of cards on the right.
 *
 * <b>Every piece of state lives in the query string</b> — category, search,
 * price range, sort, page. Nothing is held in a field the URL does not
 * describe. Three things fall out of that, and all three are the point: a
 * filtered listing can be shared and bookmarked; the back button steps through
 * filters the way a customer expects; and the server can render the exact page
 * the customer asked for, because the request URL contains the whole request.
 */
@Component({
  selector: 'app-product-list',
  imports: [RouterLink, ProductCard, CategoryFilter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4">
      <div class="row g-4">
        <aside class="col-12 col-lg-3">
          <h2 class="h6 text-uppercase text-muted">Categories</h2>

          <div class="mb-2">
            <a
              class="text-decoration-none"
              [class.fw-semibold]="!categorySlug()"
              [class.link-dark]="!categorySlug()"
              [class.link-secondary]="categorySlug()"
              routerLink="/products"
              [queryParams]="{ category: null, page: null }"
              queryParamsHandling="merge">
              All products
            </a>
          </div>

          @if (categories().length) {
            <app-category-filter [categories]="categories()" [selectedSlug]="categorySlug()" />
          }

          <h2 class="h6 text-uppercase text-muted mt-4">Price</h2>

          <div class="d-flex gap-2 align-items-center">
            <input
              class="form-control form-control-sm"
              type="number"
              min="0"
              inputmode="numeric"
              aria-label="Minimum price in taka"
              placeholder="Min"
              [value]="minPrice() ?? ''"
              (change)="onPrice('min', $event)" />
            <span class="text-muted">-</span>
            <input
              class="form-control form-control-sm"
              type="number"
              min="0"
              inputmode="numeric"
              aria-label="Maximum price in taka"
              placeholder="Max"
              [value]="maxPrice() ?? ''"
              (change)="onPrice('max', $event)" />
          </div>
        </aside>

        <section class="col-12 col-lg-9">
          <div class="d-flex flex-wrap gap-2 justify-content-between align-items-end mb-3">
            <div>
              <h1 class="h4 mb-1">{{ heading() }}</h1>

              @if (pagination(); as page) {
                <p class="small text-muted mb-0">
                  {{ page.totalItems }} {{ page.totalItems === 1 ? 'product' : 'products' }}
                </p>
              }
            </div>

            <div class="d-flex gap-2">
              <!-- A form, so pressing Enter searches. A bare input with a keyup
                   handler misses the on-screen keyboard's Go key, which is how
                   most of this audience submits anything. -->
              <form class="d-flex" role="search" (submit)="onSearch($event)">
                <input
                  class="form-control form-control-sm"
                  type="search"
                  name="q"
                  aria-label="Search products"
                  placeholder="Search"
                  [value]="search() ?? ''" />
              </form>

              <select
                class="form-select form-select-sm w-auto"
                aria-label="Sort products"
                (change)="onSort($event)">
                @for (option of sortOptions; track option.value) {
                  <option [value]="option.value" [selected]="option.value === sort()">
                    {{ option.label }}
                  </option>
                }
              </select>
            </div>
          </div>

          @if (failed()) {
            <div class="alert alert-warning" role="alert">
              We could not load the catalogue just now. Please refresh the page.
            </div>
          } @else if (products().length === 0 && !loading()) {
            <div class="text-center py-5">
              <p class="mb-2">Nothing matches those filters.</p>
              <a class="btn btn-outline-dark btn-sm" routerLink="/products">Clear filters</a>
            </div>
          } @else {
            <div class="row row-cols-2 row-cols-md-3 g-3" [class.wh-loading]="loading()">
              @for (product of products(); track product.id) {
                <div class="col">
                  <app-product-card [product]="product" />
                </div>
              }
            </div>
          }

          @if (pagination(); as page) {
            @if (page.totalPages > 1) {
              <nav class="mt-4" aria-label="Product pages">
                <ul class="pagination justify-content-center">
                  <li class="page-item" [class.disabled]="page.currentPage <= 1">
                    <a
                      class="page-link"
                      routerLink="/products"
                      [queryParams]="{ page: page.currentPage - 1 }"
                      queryParamsHandling="merge">
                      Previous
                    </a>
                  </li>

                  <li class="page-item disabled">
                    <span class="page-link">
                      Page {{ page.currentPage }} of {{ page.totalPages }}
                    </span>
                  </li>

                  <li class="page-item" [class.disabled]="page.currentPage >= page.totalPages">
                    <a
                      class="page-link"
                      routerLink="/products"
                      [queryParams]="{ page: page.currentPage + 1 }"
                      queryParamsHandling="merge">
                      Next
                    </a>
                  </li>
                </ul>
              </nav>
            }
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    /* The previous results stay readable while the next page loads. Blanking
       the grid would make every filter click flash an empty catalogue. */
    .wh-loading {
      opacity: 0.45;
      transition: opacity 0.15s ease-in-out;
      pointer-events: none;
    }
  `
})
export class ProductList implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sortOptions = SortOptions;

  protected readonly categories = signal<CategoryTree[]>([]);
  protected readonly products = signal<StorefrontProduct[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly categorySlug = signal<string | null>(null);
  protected readonly search = signal<string | null>(null);
  protected readonly minPrice = signal<number | null>(null);
  protected readonly maxPrice = signal<number | null>(null);
  protected readonly sort = signal<ProductSort>('RecentlyPublished');
  protected readonly heading = signal('Shop all');

  ngOnInit(): void {
    // Categories first, then the listing: the URL names a category by slug —
    // because a slug is readable and stable — while the API filters by id, and
    // the tree is the only thing that maps one to the other. Chained rather
    // than run in parallel for that reason, not for tidiness.
    this.catalog
      .getCategories()
      .pipe(
        catchError(() => of([] as CategoryTree[])),
        tap(categories => this.categories.set(categories)),
        switchMap(() => this.route.queryParamMap),
        switchMap(params => {
          const query = this.readQuery(params);

          this.loading.set(true);
          this.failed.set(false);
          this.applySeo(params);

          return this.catalog.search(query).pipe(
            catchError(() => {
              this.failed.set(true);
              return of(null);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        this.loading.set(false);

        if (!result) {
          this.products.set([]);
          this.pagination.set(null);
          return;
        }

        this.products.set(result.result ?? []);
        this.pagination.set(result.pagination ?? null);
      });
  }

  // ---------------------------------------------------------------------------

  private readQuery(params: ParamMap): ProductQuery {
    const slug = params.get('category');
    const category = slug ? findBySlug(this.categories(), slug) : null;

    this.categorySlug.set(slug);
    this.search.set(params.get('q'));
    this.minPrice.set(toNumber(params.get('min')));
    this.maxPrice.set(toNumber(params.get('max')));
    this.sort.set(toSort(params.get('sort')));
    this.heading.set(category?.nameEn ?? (params.get('q') ? 'Search results' : 'Shop all'));

    return {
      pageNumber: toNumber(params.get('page')) ?? 1,
      pageSize: PageSize,
      // A slug in the URL that matches nothing leaves categoryId null, so the
      // customer gets the whole catalogue rather than an error. A stale link to
      // a category an admin has since renamed should still sell something.
      categoryId: category?.id ?? null,
      includeDescendantCategories: true,
      search: this.search(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      sortBy: this.sort()
    };
  }

  private applySeo(params: ParamMap): void {
    const canonicalQuery = params.keys
      .filter(key => key !== 'q')
      .sort()
      .map(key => `${key}=${encodeURIComponent(params.get(key) ?? '')}`)
      .join('&');

    this.seo.apply({
      title: this.heading() === 'Shop all' ? 'Shop all furniture' : this.heading(),
      description:
        'Beds, wardrobes, sofas, dining and lighting - made in Bangladesh by WoodHeart.',
      // Self-referencing and page-aware, so page 2 is its own canonical rather
      // than claiming to be page 1. The search term is left out on purpose:
      // every search is a distinct URL, and pointing them all at one canonical
      // is the tidy-looking version of the same mistake as indexing them.
      canonicalPath: canonicalQuery ? `/products?${canonicalQuery}` : '/products',
      // A search results page is thin, near-duplicate content that competes
      // with the category pages for the same terms.
      noIndex: !!params.get('q')
    });

    // Nothing on a listing is a Product in the structured-data sense, and
    // leaving the previous page's block in place would describe this one as
    // whichever product the customer last looked at.
    this.seo.setJsonLd(null);
  }

  // A filter change always resets the page. Staying on page 4 after narrowing
  // to a category with two pages shows an empty grid, which reads as "no stock".
  private navigate(params: Record<string, string | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...params, page: null },
      queryParamsHandling: 'merge'
    });
  }

  protected onSearch(event: Event): void {
    event.preventDefault();

    const value = new FormData(event.target as HTMLFormElement).get('q');

    this.navigate({ q: typeof value === 'string' && value.trim() ? value.trim() : null });
  }

  protected onSort(event: Event): void {
    this.navigate({ sort: (event.target as HTMLSelectElement).value });
  }

  protected onPrice(key: 'min' | 'max', event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();

    this.navigate({ [key]: raw === '' ? null : raw });
  }
}

function findBySlug(categories: CategoryTree[], slug: string): CategoryTree | null {
  for (const category of categories) {
    if (category.slug === slug) {
      return category;
    }

    const found = findBySlug(category.children, slug);

    if (found) {
      return found;
    }
  }

  return null;
}

function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);

  // `Number.isFinite`, not `!isNaN`: `?page=Infinity` parses to a number that
  // is not a page, and it would reach the API as a filter nobody can satisfy.
  return Number.isFinite(parsed) ? parsed : null;
}

function toSort(value: string | null): ProductSort {
  const match = SortOptions.find(option => option.value === value);

  // An unknown sort is ignored rather than passed through. The API answers a
  // bad enum with a 400, and a customer who has edited the URL should get
  // products back, not a validation error.
  return match?.value ?? 'RecentlyPublished';
}
