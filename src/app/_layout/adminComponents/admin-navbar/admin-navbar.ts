import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../../../_services/account.service';

@Component({
  selector: 'app-admin-navbar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar bg-white border-bottom px-3">
      <div class="d-flex align-items-center gap-3 w-100">
        <button
          class="btn btn-outline-secondary btn-sm"
          type="button"
          aria-label="Toggle sidebar"
          (click)="toggleSidebar.emit()">
          ☰
        </button>

        <span class="fw-semibold">WoodHeart Admin</span>

        <div class="ms-auto d-flex align-items-center gap-3">
          <a class="small link-secondary text-decoration-none" routerLink="/">View store</a>
          <span class="small text-muted">{{ account.user()?.fullName ?? 'Staff' }}</span>
          <button class="btn btn-sm btn-outline-secondary" type="button" (click)="signOut()">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  `
})
export class AdminNavbar {
  protected readonly account = inject(AccountService);
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();

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
