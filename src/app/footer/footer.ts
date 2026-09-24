import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeaturesService } from '../_services/features.service';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="bg-light border-top mt-5 py-4">
      <div class="container">
        <div class="row gy-3">
          <div class="col-12 col-md-4">
            <h6 class="fw-semibold">WoodHeart</h6>
            <p class="text-muted small mb-0">
              Home interior furniture and interior design consultation, made in Bangladesh.
            </p>
          </div>

          <div class="col-6 col-md-4">
            <h6 class="fw-semibold">Shop</h6>
            <ul class="list-unstyled small mb-0">
              <li>
                <a class="link-secondary text-decoration-none" routerLink="/products">
                  All products
                </a>
              </li>
              @if (features.features().consultations) {
                <li>
                  <a class="link-secondary text-decoration-none" routerLink="/consultation">
                    Consultation
                  </a>
                </li>
              }
            </ul>
          </div>

          <div class="col-6 col-md-4">
            <h6 class="fw-semibold">Help</h6>
            <ul class="list-unstyled small mb-0">
              <li>
                <a class="link-secondary text-decoration-none" routerLink="/track">Track your order</a>
              </li>
              <li>
                <!-- A quotation is read weeks after it was sent, usually from
                     an SMS somebody has since scrolled past. This is the way
                     back to it without an account. -->
                <a class="link-secondary text-decoration-none" routerLink="/quotation/find">
                  Find your quotation
                </a>
              </li>
              <li>
                <a class="link-secondary text-decoration-none" routerLink="/contact">Contact us</a>
              </li>
            </ul>
          </div>
        </div>

        <hr />

        <p class="text-muted small mb-0">© {{ year }} WoodHeart. All rights reserved.</p>
      </div>
    </footer>
  `
})
export class Footer {
  protected readonly year = new Date().getFullYear();

  // The header hides the same link. Leaving it here would mean a customer who
  // scrolled past the top of the page found the one door still open.
  protected readonly features = inject(FeaturesService);
}
