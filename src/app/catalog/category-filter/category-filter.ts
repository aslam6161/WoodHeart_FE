import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
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
 *
 * <b>No counts.</b> A number beside every row turns a list of rooms into a
 * table of figures, and the figure a customer wants is already on the listing
 * beside the heading. What survives is the quieter half of it: a category with
 * nothing in it is dimmed, so the eye skips it without having to read a zero.
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

        <!-- The room's own name is the link to all of it. Spelling that out as
             a separate "All Bedroom" row read like a form field; a heading you
             can click reads like a heading. -->
        <a
          class="wh-cats__head"
          [class.wh-cats__head--on]="current.slug === selectedSlug()"
          [routerLink]="['/products']"
          [queryParams]="{ category: current.slug, page: null }"
          queryParamsHandling="merge">
          {{ current.nameEn }}
        </a>
      } @else {
        <a
          class="wh-cats__head"
          [class.wh-cats__head--on]="!selectedSlug()"
          [routerLink]="['/products']"
          [queryParams]="{ category: null, page: null }"
          queryParamsHandling="merge">
          All products
        </a>
      }

      <ul class="wh-cats__list" [class.wh-cats__list--back]="goingBack()">
        @for (item of items(); track item.id; let i = $index) {
          <!-- Each row is a fresh element when the level changes, which is what
               lets a CSS animation run again; the index staggers them so the
               level arrives as a sweep rather than a jump. -->
          <li class="wh-cats__item" [style.--i]="i">
            <a
              class="wh-cats__row"
              [class.wh-cats__row--on]="item.slug === selectedSlug()"
              [class.wh-cats__row--empty]="!hasStock(item)"
              [routerLink]="['/products']"
              [queryParams]="{ category: item.slug, page: null }"
              queryParamsHandling="merge">
              <span>{{ item.nameEn }}</span>

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
    .wh-cats {
      font-size: 0.9375rem;
    }

    .wh-cats__list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .wh-cats__back {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.375rem;
      color: var(--wh-quiet, #7a756f);
      font-size: 0.8125rem;
      text-decoration: none;
      transition: color 0.18s ease;
    }

    .wh-cats__back:hover {
      color: var(--wh-accent, #e99c2e);
    }

    /* The level's own name, set as a heading rather than another row, so the
       eye can tell where it is before reading a word of the list. */
    .wh-cats__head {
      display: block;
      padding-bottom: 0.625rem;
      margin-bottom: 0.375rem;
      border-bottom: 1px solid rgb(0 0 0 / 8%);
      color: var(--wh-ink, #5f5b57);
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-decoration: none;
      transition: color 0.18s ease;
    }

    .wh-cats__head:hover,
    .wh-cats__head--on {
      color: var(--wh-accent, #e99c2e);
    }

    .wh-cats__row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4375rem 0;
      color: var(--wh-ink, #5f5b57);
      line-height: 1.45;
      text-decoration: none;
      transition:
        color 0.18s ease,
        transform 0.18s ease;
    }

    .wh-cats__row > span {
      flex: 1 1 auto;
    }

    /* A couple of pixels, so a pointer gets something back from a row that
       cannot light up a background without looking like a menu. */
    .wh-cats__row:hover {
      color: var(--wh-accent, #e99c2e);
      transform: translateX(3px);
    }

    .wh-cats__row--on {
      color: var(--wh-accent, #e99c2e);
      font-weight: 500;
    }

    /* Still listed, still clickable — an empty shelf is information. It just
       does not compete with the ones that have something on them. */
    .wh-cats__row--empty {
      color: var(--wh-quiet, #7a756f);
      opacity: 0.75;
    }

    .wh-cats__chev {
      width: 0.75rem;
      height: 0.75rem;
      flex: 0 0 auto;
    }

    .wh-cats__chev--in {
      color: var(--wh-quiet, #7a756f);
      transition: transform 0.18s ease;
    }

    .wh-cats__row:hover .wh-cats__chev--in {
      transform: translateX(2px);
    }

    /* Going deeper, the level arrives from the right; coming back out, from
       the left — so the movement says which way you went. */
    @keyframes wh-cats-in {
      from {
        opacity: 0;
        transform: translateX(0.75rem);
      }
    }

    @keyframes wh-cats-out {
      from {
        opacity: 0;
        transform: translateX(-0.75rem);
      }
    }

    .wh-cats__item {
      animation: wh-cats-in 0.26s ease both;
      animation-delay: calc(var(--i, 0) * 28ms);
    }

    .wh-cats__list--back .wh-cats__item {
      animation-name: wh-cats-out;
    }

    @media (prefers-reduced-motion: reduce) {
      .wh-cats__item {
        animation: none;
      }

      .wh-cats__row,
      .wh-cats__row:hover,
      .wh-cats__chev--in {
        transition: none;
        transform: none;
      }
    }
  `
})
export class CategoryFilter {
  readonly categories = input.required<CategoryTree[]>();
  readonly selectedSlug = input<string | null>(null);

  /** Root to selected, which is the only navigation state this panel has. */
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

  /**
   * Which way the last move went, for the animation and nothing else.
   *
   * Direction is the one thing the URL cannot say — `?category=beds` is the
   * same address whether it was reached by stepping in or backing out — so it
   * is remembered here, where being wrong costs an animation playing the wrong
   * way and no more than that.
   */
  protected readonly goingBack = signal(false);
  private lastDepth = -1;

  constructor() {
    effect(() => {
      const depth = this.focus()?.depth ?? -1;

      this.goingBack.set(depth < this.lastDepth);
      this.lastDepth = depth;
    });
  }

  /** Whether anything below this category is actually for sale. */
  protected hasStock(category: CategoryTree): boolean {
    return rollup(category) > 0;
  }
}

/**
 * A category's own products plus everything below it.
 *
 * The API counts what is filed directly against a category, and products are
 * filed against leaves, so every room's own count is zero — which would dim
 * every room on the top level. No number is printed any more, but it still
 * decides what looks empty, so it still has to be right.
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
