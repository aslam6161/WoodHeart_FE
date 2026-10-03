import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryTree } from '../../_models/catalog';

/**
 * The category panel in the filter sidebar: one level at a time.
 *
 * <b>It used to render the whole tree.</b> Six rooms, twenty-four rows, and a
 * zero against every room — because a product belongs to a leaf category and
 * the rooms are branches. On a phone that is a screenful of nothing before the
 * first photograph. A customer who wants a wardrobe does not need to be shown
 * mirror cabinets to find one.
 *
 * So it shows one level: the rooms, then the room you pick, then its children
 * if it has any, to whatever depth the admin has built. The row at the top
 * walks back up.
 *
 * <b>Where it is in the tree is read from the URL, not kept here.</b> The
 * selected category decides which level is open, so the panel is in the right
 * place when the page is server-rendered, when a link is shared, and when the
 * back button is pressed — none of which a local "open" flag survives. Picking
 * a room both filters the listing and steps into it, which is the one click
 * the old list needed two of.
 */
@Component({
  selector: 'app-category-filter',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="wh-cats" aria-label="Categories">
      @if (focus(); as current) {
        <a
          class="wh-cats__back"
          [routerLink]="['/products']"
          [queryParams]="{ category: parent()?.slug ?? null, page: null }"
          queryParamsHandling="merge">
          <svg class="wh-cats__chev" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.5" />
          </svg>
          {{ parent()?.nameEn ?? 'All products' }}
        </a>

        <!-- The room itself, and a way to buy from all of it. Without this row
             there is no way to ask for "everything in the bedroom" once you
             have stepped inside one. -->
        <a
          class="wh-cats__current"
          [class.wh-cats__row--on]="current.slug === selectedSlug()"
          [routerLink]="['/products']"
          [queryParams]="{ category: current.slug, page: null }"
          queryParamsHandling="merge">
          <span>All {{ current.nameEn }}</span>
          <span class="wh-cats__count">{{ count(current) }}</span>
        </a>
      } @else {
        <a
          class="wh-cats__row wh-cats__row--all"
          [class.wh-cats__row--on]="!selectedSlug()"
          [routerLink]="['/products']"
          [queryParams]="{ category: null, page: null }"
          queryParamsHandling="merge">
          <span>All products</span>
          <span class="wh-cats__count">{{ total() }}</span>
        </a>
      }

      <ul class="wh-cats__list">
        @for (item of items(); track item.id) {
          <li>
            <a
              class="wh-cats__row"
              [class.wh-cats__row--on]="item.slug === selectedSlug()"
              [class.wh-cats__row--empty]="count(item) === 0"
              [routerLink]="['/products']"
              [queryParams]="{ category: item.slug, page: null }"
              queryParamsHandling="merge">
              <span>{{ item.nameEn }}</span>
              <span class="wh-cats__count">{{ count(item) }}</span>

              @if (item.children.length) {
                <svg class="wh-cats__chev wh-cats__chev--in" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" />
                </svg>
              }
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    .wh-cats__list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .wh-cats__row,
    .wh-cats__back,
    .wh-cats__current {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgb(0 0 0 / 6%);
      color: var(--wh-ink, #5f5b57);
      text-decoration: none;
    }

    .wh-cats__row > span:first-child,
    .wh-cats__current > span:first-child {
      flex: 1 1 auto;
    }

    .wh-cats__row:hover,
    .wh-cats__back:hover,
    .wh-cats__current:hover {
      color: var(--wh-accent, #e99c2e);
    }

    .wh-cats__row--on {
      color: var(--wh-accent, #e99c2e);
      font-weight: 500;
    }

    /* Still listed, still clickable — an empty shelf is information. It just
       does not compete with the ones that have something on them. */
    .wh-cats__row--empty {
      color: var(--wh-quiet, #7a756f);
    }

    .wh-cats__back {
      color: var(--wh-quiet, #7a756f);
      font-size: 0.875rem;
    }

    .wh-cats__current {
      font-weight: 500;
    }

    .wh-cats__count {
      color: var(--wh-quiet, #7a756f);
      font-size: 0.8125rem;
    }

    .wh-cats__chev {
      width: 0.875rem;
      height: 0.875rem;
      flex: 0 0 auto;
    }

    .wh-cats__chev--in {
      color: var(--wh-quiet, #7a756f);
    }
  `
})
export class CategoryFilter {
  readonly categories = input.required<CategoryTree[]>();
  readonly selectedSlug = input<string | null>(null);

  /** Root to selected, which is the only state this panel has. */
  private readonly path = computed(() => pathTo(this.categories(), this.selectedSlug()));

  /**
   * The level that is open.
   *
   * The selected category when it has children, otherwise its parent — so
   * choosing a leaf leaves its siblings on screen instead of emptying the
   * panel and stranding the customer one click from everything.
   */
  protected readonly focus = computed(() => {
    const path = this.path();
    const selected = path.at(-1);

    if (!selected) {
      return null;
    }

    return selected.children.length ? selected : (path.at(-2) ?? null);
  });

  /** Where the back row goes. Null means out to the whole catalogue. */
  protected readonly parent = computed(() => {
    const focus = this.focus();
    return focus ? (this.path()[this.path().indexOf(focus) - 1] ?? null) : null;
  });

  protected readonly items = computed(() => this.focus()?.children ?? this.categories());

  protected readonly total = computed(() =>
    this.categories().reduce((sum, category) => sum + rollup(category), 0)
  );

  protected count(category: CategoryTree): number {
    return rollup(category);
  }
}

/**
 * A category's own products plus everything below it.
 *
 * The API counts what is filed directly against a category, and products are
 * filed against leaves, so every room's own count is zero. The listing already
 * searches a category <i>and its descendants</i>, so this is the number that
 * matches what the click actually returns — which the raw count did not.
 */
function rollup(category: CategoryTree): number {
  return category.children.reduce((sum, child) => sum + rollup(child), category.productCount);
}

/** The chain from a root down to `slug`, or empty when nothing matches. */
function pathTo(categories: CategoryTree[], slug: string | null): CategoryTree[] {
  if (!slug) {
    return [];
  }

  for (const category of categories) {
    if (category.slug === slug) {
      return [category];
    }

    const below = pathTo(category.children, slug);

    if (below.length) {
      return [category, ...below];
    }
  }

  return [];
}
