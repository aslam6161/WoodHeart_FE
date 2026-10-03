import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AccountService } from '../../../_services/account.service';

interface NavItem {
  label: string;
  path: string;
  /** The `d` of a single 24x24 path. See the note on `items`. */
  icon: string;
  /** Null means every staff role sees it. */
  requiresAdmin?: boolean;
}

@Component({
  selector: 'app-admin-sidebar',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="wh-sidebar" [class.wh-sidebar--collapsed]="collapsed()">
      <div class="wh-sidebar__brand">
        <span class="wh-sidebar__mark">W</span>
        @if (!collapsed()) {
          <span class="wh-sidebar__name">WoodHeart</span>
        }
      </div>

      <nav class="wh-sidebar__nav">
        @for (item of visibleItems(); track item.path) {
          <a
            class="wh-sidebar__link"
            routerLinkActive="wh-sidebar__link--active"
            [routerLinkActiveOptions]="{ exact: item.path === '/admin' }"
            [routerLink]="item.path"
            [title]="item.label">
            <svg class="wh-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path [attr.d]="item.icon" />
            </svg>

            @if (!collapsed()) {
              <span class="wh-sidebar__label">{{ item.label }}</span>
            }
          </a>
        }
      </nav>
    </aside>
  `,
  styles: `
    /* The flex item in the admin shell is this component's host element, not
       the <aside> inside it — so without this the white rail stops at the end
       of the menu and the canvas shows through beneath it. */
    :host {
      display: flex;
    }

    .wh-sidebar {
      background-color: var(--wh-surface);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      padding: 1rem 0.75rem;
      transition: width 0.15s ease;
      width: 230px;
    }

    .wh-sidebar--collapsed {
      width: 76px;
    }

    .wh-sidebar__brand {
      align-items: center;
      display: flex;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
      padding: 0 0.5rem;
    }

    .wh-sidebar__mark {
      align-items: center;
      background-color: var(--wh-primary);
      border-radius: 0.625rem;
      color: #fff;
      display: inline-flex;
      font-weight: 600;
      height: 2rem;
      justify-content: center;
      width: 2rem;
    }

    .wh-sidebar__name {
      color: var(--wh-heading);
      font-weight: 600;
    }

    .wh-sidebar__nav {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .wh-sidebar__link {
      align-items: center;
      /* Matches the template's pill: rounded far enough to read as a chip
         rather than a highlighted table row. */
      border-radius: 1rem;
      color: var(--wh-muted);
      display: flex;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      text-decoration: none;
      transition:
        background-color 0.12s ease,
        color 0.12s ease;
    }

    .wh-sidebar__link:hover {
      background-color: var(--wh-line);
      color: var(--wh-heading);
    }

    .wh-sidebar__link--active,
    .wh-sidebar__link--active:hover {
      background-color: var(--wh-primary);
      color: #fff;
    }

    .wh-sidebar__icon {
      fill: currentColor;
      flex-shrink: 0;
      height: 1.25rem;
      width: 1.25rem;
    }

    .wh-sidebar__label {
      font-size: 0.9375rem;
      white-space: nowrap;
    }

    /* Centred icons once the labels are gone, so a collapsed rail does not
       read as a list with its text cut off. */
    .wh-sidebar--collapsed .wh-sidebar__link,
    .wh-sidebar--collapsed .wh-sidebar__brand {
      justify-content: center;
      padding-left: 0;
      padding-right: 0;
    }

    /* The sidebar is a navigation aid, not content. On a phone the admin gets
       the screen instead. */
    @media (max-width: 767.98px) {
      .wh-sidebar {
        display: none;
      }
    }
  `
})
export class AdminSidebar {
  private readonly account = inject(AccountService);

  readonly collapsed = input(false);

  /**
   * The menu.
   *
   * <b>Icons are path data rather than an icon font or a sprite.</b> Twelve
   * shapes did not justify a dependency, a webfont request on every admin page
   * load, or a build step; bound as an attribute they also need no sanitiser.
   * And they make the collapsed rail genuinely usable, which a column of first
   * letters never was.
   */
  private readonly items: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/admin',
      icon: 'M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10-3h8v11h-8V10z'
    },
    {
      label: 'Products',
      path: '/admin/products',
      icon: 'M12 2l9 5v10l-9 5-9-5V7l9-5zm0 2.3L5.2 8 12 11.7 18.8 8 12 4.3z'
    },
    {
      label: 'Categories',
      path: '/admin/categories',
      icon: 'M3 4h8l10 10-8 8L3 12V4zm4 2.5a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6z'
    },
    {
      label: 'Brands',
      path: '/admin/brands',
      icon: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z'
    },
    {
      label: 'Orders',
      path: '/admin/orders',
      icon: 'M6 2h12v20l-3-2-3 2-3-2-3 2V2zm3 5h6v2H9V7zm0 4h6v2H9v-2z'
    },
    {
      label: 'Stock',
      path: '/admin/inventory/stock',
      icon: 'M4 5h16v4H4V5zm0 5.5h16v4H4v-4zM4 16h16v4H4v-4z'
    },
    {
      label: 'Discounts',
      path: '/admin/discounts',
      icon: 'M5 5h14v14H5V5zm3.2 1.8a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2zm7.6 6.4a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2zM7.6 16.2l8-9.6 1.6 1.3-8 9.6-1.6-1.3z'
    },
    {
      label: 'Consultations',
      path: '/admin/consultations',
      icon: 'M7 2v2h10V2h2v2h3v18H2V4h3V2h2zm13 8H4v10h16V10z'
    },
    {
      label: 'Quotations',
      path: '/admin/quotations',
      icon: 'M6 2h8l4 4v16H6V2zm7 1.6V7h3.4L13 3.6zM8 11h8v2H8v-2zm0 4h8v2H8v-2z'
    },
    {
      label: 'Notifications',
      path: '/admin/notifications',
      icon: 'M12 2a6 6 0 016 6v4l2 3H4l2-3V8a6 6 0 016-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z'
    },
    {
      label: 'Payments',
      path: '/admin/payment-methods',
      icon: 'M2 5h20v4H2V5zm0 6h20v8H2v-8zm3 4h5v2H5v-2z',
      requiresAdmin: true
    },
    {
      label: 'Settings',
      path: '/admin/settings',
      icon: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM9.2 2h5.6l.5 2.6 2.3 1 2.4-1.1 2.8 4.8-2 1.7a8 8 0 010 1.9l2 1.7-2.8 4.8-2.4-1.1-2.3 1-.5 2.7H9.2l-.5-2.7-2.3-1-2.4 1.1L1.2 14.6l2-1.7a8 8 0 010-1.9l-2-1.7L4 4.5l2.4 1.1 2.3-1L9.2 2z',
      requiresAdmin: true
    }

    // Everything below arrives with the phase that builds it. Listing a link
    // to a page that does not exist is worse than an incomplete menu: it reads
    // as a broken admin panel rather than an unfinished one.
  ];

  protected visibleItems(): NavItem[] {
    const isAdmin = this.account.isAdmin();

    return this.items.filter(item => !item.requiresAdmin || isAdmin);
  }
}
