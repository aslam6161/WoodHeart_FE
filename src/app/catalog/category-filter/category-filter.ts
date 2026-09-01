import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryTree } from '../../_models/catalog';

/**
 * The category tree in the filter sidebar.
 *
 * Recursive: it imports itself so the tree renders to whatever depth the admin
 * has built, rather than to the two levels the seed happens to have today.
 *
 * Every entry is a real link with the filter in the query string, not a click
 * handler that mutates local state. That is what makes a filtered listing
 * shareable, back-button-able, and — the reason it matters here — server
 * rendered, since the server sees the same URL the customer does.
 */
@Component({
  selector: 'app-category-filter',
  imports: [RouterLink, CategoryFilter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list-unstyled mb-0" [class.ms-3]="depth() > 0">
      @for (category of categories(); track category.id) {
        <li class="py-1">
          <a
            class="text-decoration-none d-flex justify-content-between align-items-center"
            [class.fw-semibold]="category.slug === selectedSlug()"
            [class.link-dark]="category.slug === selectedSlug()"
            [class.link-secondary]="category.slug !== selectedSlug()"
            [routerLink]="['/products']"
            [queryParams]="{ category: category.slug, page: null }"
            queryParamsHandling="merge">
            <span>{{ category.nameEn }}</span>
            <span class="badge rounded-pill text-bg-light">{{ category.productCount }}</span>
          </a>

          @if (category.children.length) {
            <app-category-filter
              [categories]="category.children"
              [selectedSlug]="selectedSlug()"
              [depth]="depth() + 1" />
          }
        </li>
      }
    </ul>
  `
})
export class CategoryFilter {
  readonly categories = input.required<CategoryTree[]>();
  readonly selectedSlug = input<string | null>(null);
  readonly depth = input(0);
}
