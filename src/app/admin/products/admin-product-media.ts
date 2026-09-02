import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminCatalogService } from '../../_services/admin/admin-catalog.service';
import { AdminMediaService } from '../../_services/admin/admin-media.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { ToastService } from '../../_services/toast.service';
import { AdminProductDetail, AdminProductMedia } from '../../_models/admin-catalog';
import { GeneralResponse } from '../../_models/generalResponse';

/**
 * The photographs for one product: upload, order, choose the hero, delete.
 *
 * <b>This screen is why the media pipeline exists.</b> Everything behind it has
 * been working since the Cloudinary work landed and completely unusable,
 * because there was no way to put a file through it — every product card on
 * the storefront renders a placeholder tile.
 *
 * <b>Alt text is required before the file picker opens, not after.</b> The
 * backend refuses an upload without it, and asking afterwards produces the
 * familiar outcome where every row has empty alt text because the upload had
 * already succeeded and nobody went back.
 */
@Component({
  selector: 'app-admin-product-media',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">Photographs</h1>

      @if (product(); as loaded) {
        <span class="text-muted">— {{ loaded.nameEn }}</span>
        <a class="btn btn-sm btn-link ms-auto" [routerLink]="['/admin/products', loaded.id]">
          Back to the product
        </a>
      }
    </div>

    @if (!mediaConfigured()) {
      <!-- A fresh checkout has no Cloudinary account, and the production bundle
           ships an empty cloud name on purpose. Saying so is much better than a
           grid of broken images. -->
      <div class="alert alert-warning">
        <strong>Cloudinary is not configured.</strong>
        Uploads will be refused until <code>Cloudinary:CloudName</code>,
        <code>:ApiKey</code> and <code>:ApiSecret</code> are set on the API, and
        <code>CLOUDINARY_CLOUD_NAME</code> on the web app.
      </div>
    }

    <div class="border rounded p-3 mb-4">
      <h2 class="h6 text-uppercase text-muted mb-3">Add a photograph</h2>

      <div class="row g-3 align-items-end">
        <div class="col-12 col-md-5">
          <label class="form-label" for="altText">
            Describe the photograph <span class="text-danger">*</span>
          </label>
          <input
            id="altText"
            class="form-control"
            maxlength="300"
            placeholder="Segun wood king bed with a headboard, in a lit bedroom"
            [ngModel]="altText()"
            (ngModelChange)="altText.set($event)" />
          <div class="form-text">
            Read aloud to customers using a screen reader, and read by Google.
          </div>
        </div>

        <div class="col-12 col-md-4">
          <label class="form-label" for="caption">Caption</label>
          <input
            id="caption"
            class="form-control"
            maxlength="500"
            [ngModel]="caption()"
            (ngModelChange)="caption.set($event)" />
          <div class="form-text">Optional, shown under the image.</div>
        </div>

        <div class="col-12 col-md-3">
          <label class="form-label" for="file">Image or video</label>
          <input
            id="file"
            class="form-control"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/quicktime"
            [disabled]="!canUpload()"
            (change)="onFileChosen($event)" />
        </div>
      </div>

      @if (!altText().trim()) {
        <p class="small text-muted mt-2 mb-0">Write a description first — it is required.</p>
      }

      @if (uploading()) {
        <div class="progress mt-3" role="progressbar" aria-label="Uploading">
          <div class="progress-bar progress-bar-striped progress-bar-animated w-100">
            Uploading…
          </div>
        </div>
      }
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (media().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-0">No photographs yet. This product shows a blank tile on the storefront.</p>
      </div>
    } @else {
      <div class="row g-3">
        @for (item of media(); track item.id; let index = $index) {
          <div class="col-12 col-sm-6 col-lg-4">
            <div class="border rounded h-100 d-flex flex-column" [class.border-dark]="item.isPrimary">
              <div class="position-relative bg-body-secondary">
                @if (item.mediaType === 'Video') {
                  <video
                    class="w-100 rounded-top"
                    controls
                    preload="none"
                    [poster]="poster(item) ?? ''"
                    [src]="videoSrc(item) ?? ''"></video>
                } @else if (preview(item); as src) {
                  <img class="w-100 rounded-top" [src]="src" [alt]="item.altText ?? ''" />
                }

                @if (item.isPrimary) {
                  <span class="badge text-bg-dark position-absolute top-0 start-0 m-2">Hero</span>
                }
              </div>

              <div class="p-2 small flex-grow-1">
                <input
                  class="form-control form-control-sm mb-1"
                  aria-label="Alt text"
                  [ngModel]="item.altText ?? ''"
                  (ngModelChange)="draftAlt[item.id] = $event" />

                <div class="text-muted font-monospace text-truncate" [title]="item.storagePath">
                  {{ item.storagePath }}
                </div>
              </div>

              <div class="p-2 pt-0 d-flex flex-wrap gap-1">
                <button
                  class="btn btn-sm btn-outline-secondary"
                  type="button"
                  [disabled]="item.isPrimary || item.mediaType === 'Video'"
                  (click)="setPrimary(item)">
                  Make hero
                </button>

                <button
                  class="btn btn-sm btn-outline-secondary"
                  type="button"
                  [disabled]="index === 0"
                  (click)="move(index, -1)"
                  aria-label="Move earlier">
                  ←
                </button>

                <button
                  class="btn btn-sm btn-outline-secondary"
                  type="button"
                  [disabled]="index === media().length - 1"
                  (click)="move(index, 1)"
                  aria-label="Move later">
                  →
                </button>

                <button class="btn btn-sm btn-outline-secondary" type="button" (click)="saveText(item)">
                  Save text
                </button>

                <button class="btn btn-sm btn-outline-danger ms-auto" type="button" (click)="remove(item)">
                  Delete
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `
})
export class AdminProductMediaManager implements OnInit {
  private readonly catalog = inject(AdminCatalogService);
  private readonly mediaApi = inject(AdminMediaService);
  private readonly mediaUrl = inject(MediaUrlService);
  private readonly toast = inject(ToastService);

  /** Bound from the route. */
  readonly productId = input.required<string>();

  protected readonly product = signal<AdminProductDetail | null>(null);
  protected readonly media = signal<AdminProductMedia[]>([]);
  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);

  protected readonly altText = signal('');
  protected readonly caption = signal('');

  /** Edits in flight, keyed by media id, so typing does not fight the signal. */
  protected readonly draftAlt: Record<number, string> = {};

  protected readonly mediaConfigured = computed(() => this.mediaUrl.isConfigured);
  protected readonly canUpload = computed(() => this.altText().trim().length >= 3);

  private get id(): number {
    return Number(this.productId());
  }

  /**
   * Loads in `ngOnInit`, not the constructor.
   *
   * A required route input read during construction throws, because
   * `withComponentInputBinding` has not set it yet — so this whole screen
   * failed to render rather than failing visibly. See the note on
   * `AdminProductForm.ngOnInit`.
   */
  ngOnInit(): void {
    this.catalog.getProduct(this.id).subscribe(product => {
      this.product.set(product);
      this.media.set(product?.media ?? []);
      this.loading.set(false);
    });
  }

  protected preview(item: AdminProductMedia): string | null {
    return this.mediaUrl.image(item.storagePath, { width: 640, height: 480, fit: 'fill' });
  }

  protected videoSrc(item: AdminProductMedia): string | null {
    return this.mediaUrl.video(item.storagePath);
  }

  protected poster(item: AdminProductMedia): string | null {
    return this.mediaUrl.videoPoster(item.storagePath, 640);
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    // Cleared immediately so choosing the same file twice still fires a change
    // event — which is exactly what happens after a failed upload.
    input.value = '';

    const isVideo = file.type.startsWith('video/');

    this.uploading.set(true);

    const request = isVideo
      ? this.mediaApi.uploadVideo(this.id, file, {
          altText: this.altText().trim(),
          caption: this.caption().trim() || null
        })
      : this.mediaApi.uploadImage(this.id, {
          file,
          altText: this.altText().trim(),
          caption: this.caption().trim() || null,
          // The first image is always the hero — the backend enforces that
          // regardless, because a product with photographs and no hero shows a
          // blank card in every listing.
          isPrimary: this.media().length === 0
        });

    request.subscribe({
      next: response => {
        this.uploading.set(false);

        if (!response.isSuccess || !response.data) {
          return;
        }

        this.media.update(list => [...list, response.data!]);
        this.caption.set('');
        this.toast.success('Uploaded.');
      },
      error: (error: HttpErrorResponse | Error) => {
        this.uploading.set(false);

        // A direct-to-Cloudinary failure is a plain Error, not an
        // HttpErrorResponse, so the error interceptor never saw it and nothing
        // has been said to the admin yet.
        if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
          this.toast.error(error.message);
        }
      }
    });
  }

  protected setPrimary(item: AdminProductMedia): void {
    this.mediaApi.setPrimary(this.id, item.id).subscribe(response => {
      if (!response.isSuccess) {
        return;
      }

      // Exactly one row is primary — a filtered unique index in Postgres
      // enforces it — so the local state has to move both, not just one.
      this.media.update(list =>
        list.map(row => ({ ...row, isPrimary: row.id === item.id }))
      );

      this.toast.success('Hero image updated.');
    });
  }

  protected saveText(item: AdminProductMedia): void {
    const altText = (this.draftAlt[item.id] ?? item.altText ?? '').trim();

    if (altText.length < 3) {
      this.toast.error('Alt text is required — describe the photograph in a few words.');
      return;
    }

    this.mediaApi
      .update(this.id, item.id, { altText, caption: item.caption ?? null })
      .subscribe(response => {
        if (response.isSuccess) {
          this.media.update(list =>
            list.map(row => (row.id === item.id ? { ...row, altText } : row))
          );

          this.toast.success('Saved.');
        }
      });
  }

  /**
   * Moves one image and sends the whole resulting order.
   *
   * The local array is reordered first so the grid responds immediately, then
   * the server is told. A failure reloads rather than trying to undo the swap:
   * guessing at the correct state after a failed write is how the two ends stop
   * agreeing.
   */
  protected move(index: number, delta: number): void {
    const next = [...this.media()];
    const target = index + delta;

    if (target < 0 || target >= next.length) {
      return;
    }

    [next[index], next[target]] = [next[target], next[index]];

    this.media.set(next);

    this.mediaApi
      .reorder(this.id, { mediaIds: next.map(item => item.id) })
      .subscribe({ error: () => this.reload() });
  }

  protected remove(item: AdminProductMedia): void {
    // A plain confirm, deliberately: this deletes a file from Cloudinary as
    // well as a row, and neither comes back.
    if (!confirm('Delete this photograph? This cannot be undone.')) {
      return;
    }

    this.mediaApi.delete(this.id, item.id).subscribe((response: GeneralResponse) => {
      if (!response.isSuccess) {
        return;
      }

      // Deleting the hero promotes the next image server-side, so the local
      // copy is stale in a way that is not visible: reload rather than filter.
      this.reload();
      this.toast.success('Deleted.');
    });
  }

  private reload(): void {
    this.mediaApi.get(this.id).subscribe(media => this.media.set(media));
  }
}
