import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { ToastService } from '../../_services/toast.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { Pagination } from '../../_models/pagination';
import { AdminProductListItem, ProductStatus } from '../../_models/admin-catalog';

/**
 * The product grid: find a product, see whether it is live, open it.
 *
 * <b>Status is the column that matters and it leads the row.</b> The whole
 * reason this screen exists is that a draft is invisible on the storefront, so
 * "why can't customers see the wardrobe I added" has to be answerable at a
 * glance rather than by opening each product.
 */
@Component({
  selector: 'app-admin-product-list',
  imports: [FormsModule, RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Products</h1>

      @if (pagination(); as page) {
        <span class="badge text-bg-light">{{ page.totalItems }}</span>
      }

      <a class="btn btn-dark btn-sm ms-auto" routerLink="/admin/products/new">Add product</a>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-5">
        <input
          class="form-control"
          type="search"
          placeholder="Search name, code or SKU"
          aria-label="Search products"
          [ngModel]="search()"
          (ngModelChange)="onSearch($event)" />
      </div>

      <div class="col-6 col-md-3">
        <select
          class="form-select"
          aria-label="Filter by status"
          [ngModel]="status()"
          (ngModelChange)="onStatus($event)">
          <option [ngValue]="null">Every status</option>
          <option value="Draft">Draft</option>
          <option value="Active">Active</option>
          <option value="Archived">Archived</option>
        </select>
      </div>

      <div class="col-6 col-md-4">
        <select
          class="form-select"
          aria-label="Filter by category"
          [ngModel]="categoryId()"
          (ngModelChange)="onCategory($event)">
          <option [ngValue]="null">Every category</option>
          @for (option of categoryOptions(); track option.id) {
            <option [ngValue]="option.id">{{ option.label }}</option>
          }
        </select>
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (products().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-2">No products match those filters.</p>
        <a class="btn btn-outline-dark btn-sm" routerLink="/admin/products/new">Add the first one</a>
      </div>
    } @else {
      <!-- Scrolls inside itself. Without this the table stretches the whole
           admin layout on a laptop and the sidebar goes off-screen. -->
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col" style="width: 64px">
                <span class="visually-hidden">Photograph</span>
              </th>
              <th scope="col">Product</th>
              <th scope="col">Status</th>
              <th scope="col">Category</th>
              <th scope="col" class="text-end">Price</th>
              <th scope="col" class="text-end">Variants</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (product of products(); track product.id) {
              <tr>
                <td>
                  @if (thumbnail(product); as src) {
                    <img
                      class="rounded"
                      width="48"
                      height="48"
                      loading="lazy"
                      [src]="src"
                      [alt]="'Photograph of ' + product.nameEn" />
                  } @else {
                    <!-- Most products have no photograph yet, so this is the
                         common case rather than an error state. -->
                    <span
                      class="d-inline-block rounded bg-body-secondary"
                      style="width: 48px; height: 48px"
                      aria-hidden="true"></span>
                  }
                </td>

                <td>
                  <a class="fw-semibold text-decoration-none" [routerLink]="['/admin/products', product.id]">
                    {{ product.nameEn }}
                  </a>
                  <div class="small text-muted font-monospace">{{ product.code }}</div>
                </td>

                <td>
                  <span class="badge" [class]="statusClass(product.status)">{{ product.status }}</span>
                </td>

                <td class="small">{{ product.categoryNameEn }}</td>

                <td class="text-end">{{ product.basePrice | taka }}</td>

                <td class="text-end">{{ product.variantCount }}</td>

                <td class="text-end text-nowrap">
                  <a
                    class="btn btn-sm btn-outline-secondary"
                    [routerLink]="['/admin/products', product.id, 'media']">
                    Photos
                  </a>

                  @if (product.status === 'Active') {
                    <button
                      class="btn btn-sm btn-outline-secondary ms-1"
                      type="button"
                      (click)="setStatus(product, 'Draft')">
                      Withdraw
                    </button>
                  } @else {
                    <button
                      class="btn btn-sm btn-outline-dark ms-1"
                      type="button"
                      (click)="setStatus(product, 'Active')">
                      Publish
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (pagination(); as page) {
        @if (page.totalPages > 1) {
          <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Product pages">
            <button
              class="btn btn-sm btn-outline-secondary"
              type="button"
              [disabled]="page.currentPage <= 1"
              (click)="goTo(page.currentPage - 1)">
              Previous
            </button>

            <span class="small text-muted">
              Page {{ page.currentPage }} of {{ page.totalPages }}
            </span>

            <button
              class="btn btn-sm btn-outline-secondary"
              type="button"
              [disabled]="page.currentPage >= page.totalPages"
              (click)="goTo(page.currentPage + 1)">
              Next
            </button>
          </nav>
        }
      }
    }
  `
})
export class AdminProductList {
  private readonly catalog = inject(AdminCatalogService);
  private readonly media = inject(MediaUrlService);
  private readonly toast = inject(ToastService);

  protected readonly products = signal<AdminProductListItem[]>([]);
  protected readonly pagination = signal<Pagination | undefined>(undefined);
  protected readonly loading = signal(true);

  protected readonly search = signal('');
  protected readonly status = signal<ProductStatus | null>(null);
  protected readonly categoryId = signal<number | null>(null);

  private page = 1;
  private searchTimer?: ReturnType<typeof setTimeout>;

  /** Flattened for a `<select>`, with depth shown as indentation. */
  private readonly categories = signal<{ id: number; label: string }[]>([]);
  protected readonly categoryOptions = computed(() => this.categories());

  constructor() {
    this.load();

    this.catalog.getCategoryTree().subscribe(tree => {
      const flat: { id: number; label: string }[] = [];

      const walk = (nodes: typeof tree, depth: number) => {
        for (const node of nodes) {
          flat.push({ id: node.id, label: `${'— '.repeat(depth)}${node.nameEn}` });
          walk(node.children, depth + 1);
        }
      };

      walk(tree, 0);
      this.categories.set(flat);
    });
  }

  protected thumbnail(product: AdminProductListItem): string | null {
    return this.media.image(product.primaryImagePath, { width: 96, height: 96, fit: 'fill' });
  }

  protected statusClass(status: ProductStatus): string {
    switch (status) {
      case 'Active':
        return 'text-bg-success';
      case 'Draft':
        return 'text-bg-warning';
      default:
        return 'text-bg-secondary';
    }
  }

  protected onSearch(value: string): void {
    this.search.set(value);

    // Debounced, because this fires on every keystroke and each one is a
    // database query behind a `LIKE`. 300ms is long enough to skip the middle
    // of a word and short enough not to feel laggy.
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  protected onStatus(value: ProductStatus | null): void {
    this.status.set(value);
    this.page = 1;
    this.load();
  }

  protected onCategory(value: number | null): void {
    this.categoryId.set(value);
    this.page = 1;
    this.load();
  }

  protected goTo(page: number): void {
    this.page = page;
    this.load();
  }

  /**
   * Publishes or withdraws in place.
   *
   * The row is patched from the response rather than by reloading the page.
   * Reloading loses the admin's scroll position and their place in a list they
   * are working down, which is exactly what publishing a batch looks like.
   */
  protected setStatus(product: AdminProductListItem, status: ProductStatus): void {
    this.catalog.changeProductStatus(product.id, status).subscribe(response => {
      if (!response.isSuccess) {
        return;
      }

      this.products.update(list =>
        list.map(item => (item.id === product.id ? { ...item, status } : item))
      );

      this.toast.success(
        status === 'Active'
          ? `${product.nameEn} is now live on the storefront.`
          : `${product.nameEn} has been withdrawn from the storefront.`
      );
    });
  }

  private load(): void {
    this.loading.set(true);

    this.catalog
      .searchProducts({
        pageNumber: this.page,
        pageSize: 20,
        search: this.search() || null,
        status: this.status(),
        categoryId: this.categoryId(),
        // A category in this tree means "and everything filed beneath it",
        // which is what an admin looking at "Living Room" expects to see.
        includeDescendantCategories: true
      })
      .subscribe({
        next: result => {
          this.products.set(result.result ?? []);
          this.pagination.set(result.pagination);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }
}
