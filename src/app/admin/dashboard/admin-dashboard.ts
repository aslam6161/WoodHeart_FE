import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { AccountService } from '../../_services/account.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { AdminProductListItem } from '../../_models/admin-catalog';

/**
 * What needs attention today.
 *
 * <b>Counts only, and only the ones that mean something now.</b> Phase 1 has no
 * orders and no stock ledger, so a dashboard of revenue tiles would be four
 * zeroes pretending to be information. The two numbers here are real and both
 * are actionable: drafts nobody can buy, and live products with no photograph —
 * which render a blank tile in every listing and are the single most likely
 * reason a product is not selling.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="h4 mb-1">Welcome{{ name() ? ', ' + name() : '' }}</h1>
    <p class="text-muted small mb-4">The catalogue at a glance.</p>

    <div class="row g-3 mb-4">
      <div class="col-12 col-sm-6 col-lg-3">
        <div class="border rounded p-3 h-100">
          <div class="text-uppercase text-muted small">Live products</div>
          <div class="fs-3">{{ liveCount() ?? '—' }}</div>
          <a class="small text-decoration-none" routerLink="/admin/products">Open the catalogue</a>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-lg-3">
        <div class="border rounded p-3 h-100">
          <div class="text-uppercase text-muted small">Drafts</div>
          <div class="fs-3">{{ draftCount() ?? '—' }}</div>
          <!-- A draft is invisible to customers. That is the point of the
               status, and also the most common "why can nobody see this?". -->
          <span class="small text-muted">Not visible to customers</span>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-lg-6">
        <div class="border rounded p-3 h-100">
          <div class="text-uppercase text-muted small">Live products with no photograph</div>
          <div class="fs-3" [class.text-danger]="missingPhotos().length > 0">
            {{ missingPhotos().length }}
          </div>

          @if (missingPhotos().length > 0) {
            <div class="small">
              @for (product of missingPhotos().slice(0, 4); track product.id) {
                <a class="d-block text-decoration-none"
                   [routerLink]="['/admin/products', product.id, 'media']">
                  {{ product.nameEn }}
                </a>
              }
              @if (missingPhotos().length > 4) {
                <span class="text-muted">and {{ missingPhotos().length - 4 }} more</span>
              }
            </div>
          } @else if (!loading()) {
            <span class="small text-muted">Every live product has a hero image.</span>
          }
        </div>
      </div>
    </div>

    @if (!mediaConfigured) {
      <div class="alert alert-warning">
        <strong>Cloudinary is not configured</strong>, so uploads will be refused and every product
        shows a placeholder tile. Set the credentials on the API and the cloud name on the web app.
      </div>
    }

    <div class="border rounded p-3">
      <h2 class="h6 text-uppercase text-muted mb-3">Get started</h2>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-dark btn-sm" routerLink="/admin/products/new">Add a product</a>
        <a class="btn btn-outline-secondary btn-sm" routerLink="/admin/categories">Categories</a>
        <a class="btn btn-outline-secondary btn-sm" routerLink="/admin/brands">Brands</a>
        <a class="btn btn-outline-secondary btn-sm" routerLink="/">View the storefront</a>
      </div>
    </div>
  `
})
export class AdminDashboard {
  private readonly catalog = inject(AdminCatalogService);
  private readonly account = inject(AccountService);
  private readonly media = inject(MediaUrlService);

  protected readonly liveCount = signal<number | null>(null);
  protected readonly draftCount = signal<number | null>(null);
  protected readonly missingPhotos = signal<AdminProductListItem[]>([]);
  protected readonly loading = signal(true);

  protected readonly mediaConfigured = this.media.isConfigured;

  protected readonly name = () => this.account.user()?.fullName ?? '';

  constructor() {
    // Page size 1: the count comes from the X-Pagination header, so asking for
    // one row is enough and avoids pulling the whole catalogue twice.
    this.catalog
      .searchProducts({ status: 'Active', pageSize: 1 })
      .subscribe(result => this.liveCount.set(result.pagination?.totalItems ?? 0));

    this.catalog
      .searchProducts({ status: 'Draft', pageSize: 1 })
      .subscribe(result => this.draftCount.set(result.pagination?.totalItems ?? 0));

    // The API has no "missing media" filter, so this reads a page of live
    // products and checks locally. Fine at this size; when the catalogue
    // outgrows one page it becomes a query rather than a bigger page.
    this.catalog.searchProducts({ status: 'Active', pageSize: 100 }).subscribe({
      next: result => {
        this.missingPhotos.set((result.result ?? []).filter(product => !product.primaryImagePath));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
