import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AccountService } from '../_services/account.service';
import { CartService } from '../_services/cart.service';

/** The storefront header. */
@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top">
      <div class="container">
        <a class="navbar-brand fw-semibold" routerLink="/">WoodHeart</a>

        <button
          class="navbar-toggler"
          type="button"
          [attr.aria-expanded]="menuOpen()"
          aria-label="Toggle navigation"
          (click)="toggleMenu()">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" [class.show]="menuOpen()">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <a class="nav-link" routerLink="/products" routerLinkActive="active">Shop</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" routerLink="/consultation" routerLinkActive="active">
                Consultation
              </a>
            </li>
          </ul>

          <ul class="navbar-nav">
            @if (account.isStaff()) {
              <li class="nav-item">
                <a class="nav-link" routerLink="/admin">Admin</a>
              </li>
            }

            @if (account.isAuthenticated()) {
              <li class="nav-item">
                <a class="nav-link" routerLink="/account/bookings">Bookings</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" routerLink="/account/quotations">Quotations</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" routerLink="/account">
                  {{ account.user()?.fullName ?? 'Account' }}
                </a>
              </li>
              <li class="nav-item">
                <button class="btn btn-link nav-link" type="button" (click)="signOut()">
                  Sign out
                </button>
              </li>
            } @else {
              <li class="nav-item">
                <a class="nav-link" routerLink="/login">Sign in</a>
              </li>
            }

            <li class="nav-item">
              <a class="nav-link" routerLink="/cart" routerLinkActive="active">
                Basket
                @if (cart.itemCount(); as count) {
                  <!-- The count, not a dot. A customer comparing three sofas
                       wants to know it is three, and a badge that only says
                       "something" sends them to the basket page to find out. -->
                  <span class="badge rounded-pill text-bg-dark ms-1 align-text-top">
                    {{ count }}
                    <span class="visually-hidden">items in basket</span>
                  </span>
                }
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `
})
export class Nav {
  protected readonly account = inject(AccountService);
  protected readonly cart = inject(CartService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);

  constructor() {
    // The badge is the first thing on every page that needs the basket, so
    // the header is where it is fetched. A no-op on the server and after the
    // first call; see CartService.
    this.cart.ensureLoaded();
  }

  protected toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  /**
   * Signs out, and revokes the session server-side.
   *
   * Clearing the token locally is only half of it. Without the request the
   * refresh cookie keeps working for another thirty days, so "sign out" on a
   * shared machine would mean nothing at all.
   */
  protected signOut(): void {
    this.account.logout().subscribe(() => this.router.navigateByUrl('/'));
  }
}
