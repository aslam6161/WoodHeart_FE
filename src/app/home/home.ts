import { Component, ChangeDetectionStrategy, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CategoryTree, StorefrontProduct } from '../_models/catalog';
import { CatalogService } from '../_services/catalog.service';
import { SeoService } from '../_services/seo.service';
import { ProductCard } from '../catalog/product-card/product-card';

const ArrivalCount = 8;

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="py-5 bg-light border-bottom">
      <div class="container text-center">
        <h1 class="display-5 fw-semibold">Interiors, made in Bangladesh</h1>
        <p class="lead text-muted mb-4">
          Beds, wardrobes, dining sets, mirrors and lighting — plus interior design consultation.
        </p>
        <a class="btn btn-dark btn-lg" routerLink="/products">Browse the collection</a>
      </div>
    </section>

    @if (categories().length) {
      <section class="container py-5">
        <h2 class="h5 mb-3">Shop by room</h2>

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
        <div class="d-flex justify-content-between align-items-end mb-3">
          <h2 class="h5 mb-0">New arrivals</h2>
          <a class="small" routerLink="/products">See all</a>
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
