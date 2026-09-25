import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../../../_services/account.service';

@Component({
  selector: 'app-admin-navbar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Sits on the canvas rather than being a bar of its own: the template
         has no banded header, and one less horizontal rule leaves the cards
         below to define the page. -->
    <header class="wh-topbar">
      <button
        class="wh-topbar__toggle"
        type="button"
        aria-label="Toggle sidebar"
        (click)="toggleSidebar.emit()">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
        </svg>
      </button>

      <span class="wh-topbar__title">WoodHeart Admin</span>

      <div class="wh-topbar__right">
        <a class="wh-topbar__link" routerLink="/">View store</a>

        <span class="wh-topbar__who">
          <span class="wh-topbar__avatar">{{ initial() }}</span>
          <span class="d-none d-sm-inline">{{ account.user()?.fullName ?? 'Staff' }}</span>
        </span>

        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="signOut()">
          Sign out
        </button>
      </div>
    </header>
  `,
  styles: `
    .wh-topbar {
      align-items: center;
      display: flex;
      gap: 1rem;
      padding: 1rem 1.5rem 0.5rem;
    }

    .wh-topbar__toggle {
      align-items: center;
      background-color: var(--wh-surface);
      border: 0;
      border-radius: 0.75rem;
      color: var(--wh-text);
      display: inline-flex;
      height: 2.25rem;
      justify-content: center;
      width: 2.25rem;
    }

    .wh-topbar__toggle:hover {
      color: var(--wh-primary);
    }

    .wh-topbar__toggle svg {
      fill: currentColor;
      height: 1.125rem;
      width: 1.125rem;
    }

    .wh-topbar__title {
      color: var(--wh-heading);
      font-size: 1.125rem;
      font-weight: 600;
    }

    .wh-topbar__right {
      align-items: center;
      display: flex;
      gap: 1rem;
      margin-left: auto;
    }

    .wh-topbar__link {
      color: var(--wh-muted);
      font-size: 0.875rem;
      text-decoration: none;
    }

    .wh-topbar__link:hover {
      color: var(--wh-primary);
    }

    .wh-topbar__who {
      align-items: center;
      color: var(--wh-text);
      display: flex;
      font-size: 0.875rem;
      gap: 0.5rem;
    }

    .wh-topbar__avatar {
      align-items: center;
      background-color: var(--wh-lilac);
      border-radius: 50%;
      color: var(--wh-lilac-ink);
      display: inline-flex;
      font-size: 0.8125rem;
      font-weight: 600;
      height: 2rem;
      justify-content: center;
      width: 2rem;
    }
  `
})
export class AdminNavbar {
  protected readonly account = inject(AccountService);
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();

  /** First letter of whoever is signed in, for the avatar chip. */
  protected initial(): string {
    return (this.account.user()?.fullName ?? 'S').charAt(0).toUpperCase();
  }

  /**
   * Signs out and leaves the panel.
   *
   * Navigating away is not cosmetic: `staffGuard` only runs on navigation, so
   * staying put would leave the admin looking at a fully rendered dashboard
   * they are no longer signed in to, with every button behind it now a 401.
   *
   * The navigation happens on completion rather than in parallel, but the
   * service has already cleared the local session synchronously and swallows
   * network failures — so a dropped connection still ends at the storefront.
   */
  protected signOut(): void {
    this.account.logout().subscribe(() => this.router.navigateByUrl('/'));
  }
}
