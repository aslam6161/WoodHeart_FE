import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponse, GeneralResponseOf } from '../../_models/generalResponse';
import {
  AdminProductMedia,
  ConfirmVideoUploadDto,
  ReorderProductMediaDto,
  UpdateProductMediaDto,
  VideoUploadTicket
} from '../../_models/admin-catalog';

/** What the media manager collects before an image can be uploaded. */
export interface ImageUpload {
  file: File;

  /**
   * Required. The backend refuses an upload without it.
   *
   * That refusal is deliberate friction: alt text is the classic field that is
   * optional in the form and therefore empty on every row.
   */
  altText: string;

  caption?: string | null;
  variantId?: number | null;
  isPrimary?: boolean;
}

/**
 * Photography and video for one product.
 *
 * <b>Images and video take different routes, and the asymmetry is the design.</b>
 * An image is small enough to be worth inspecting before it exists anywhere
 * public, so it goes through the API and the server checks its magic bytes. A
 * video is hundreds of megabytes and would gain nothing from the same trip — so
 * the server signs a short-lived ticket, the bytes go straight from the browser
 * to Cloudinary, and a confirm call verifies with Cloudinary that what landed
 * is what was authorised.
 *
 * On a Bangladeshi upstream connection that difference is the whole feature: a
 * 200 MB video routed through the API is uploaded twice, once from the shop and
 * once from the server.
 */
@Injectable({ providedIn: 'root' })
export class AdminMediaService {
  private readonly http = inject(HttpClient);

  private mediaUrl(productId: number): string {
    return `${environment.apiUrl}admin/products/${productId}/media`;
  }

  get(productId: number): Observable<AdminProductMedia[]> {
    return this.http
      .get<GeneralResponseOf<AdminProductMedia[]>>(this.mediaUrl(productId))
      .pipe(map(response => response.data ?? []));
  }

  /**
   * Uploads one image through the API.
   *
   * `FormData`, so the browser sets its own `multipart/form-data` boundary.
   * Setting `Content-Type` by hand here is the classic mistake: the header ends
   * up without the boundary and the server cannot parse a single field.
   */
  uploadImage(
    productId: number,
    upload: ImageUpload
  ): Observable<GeneralResponseOf<AdminProductMedia>> {
    const form = new FormData();

    form.append('file', upload.file, upload.file.name);
    form.append('altText', upload.altText);

    if (upload.caption) {
      form.append('caption', upload.caption);
    }

    if (upload.variantId) {
      form.append('variantId', String(upload.variantId));
    }

    form.append('isPrimary', String(upload.isPrimary ?? false));

    return this.http.post<GeneralResponseOf<AdminProductMedia>>(this.mediaUrl(productId), form);
  }

  /**
   * Uploads a video: ticket from us, bytes straight to Cloudinary, then confirm.
   *
   * The `fetch` to Cloudinary deliberately bypasses this app's `HttpClient`.
   * The jwt interceptor would attach a WoodHeart bearer token to a third-party
   * request — a token sent to someone else's server is a token you have to
   * assume is theirs — and the error interceptor would try to interpret
   * Cloudinary's error shape as a `GeneralResponse`.
   */
  uploadVideo(
    productId: number,
    file: File,
    details: Omit<ConfirmVideoUploadDto, 'publicId'> = {}
  ): Observable<GeneralResponseOf<AdminProductMedia>> {
    return this.createVideoTicket(productId).pipe(
      switchMap(async ticket => {
        const form = new FormData();

        form.append('file', file);
        form.append('api_key', ticket.apiKey);
        form.append('timestamp', String(ticket.timestamp));
        form.append('signature', ticket.signature);
        form.append('public_id', ticket.publicId);
        form.append('folder', ticket.folder);

        const response = await fetch(ticket.uploadUrl, { method: 'POST', body: form });

        if (!response.ok) {
          throw new Error(`Cloudinary refused the upload (${response.status}).`);
        }

        return ticket;
      }),
      switchMap(ticket =>
        // Confirmed against Cloudinary server-side before any row is written.
        // The public id came from us, but it travelled through the browser.
        this.confirmVideo(productId, { ...details, publicId: ticket.publicId })
      )
    );
  }

  createVideoTicket(productId: number): Observable<VideoUploadTicket> {
    return this.http
      .post<GeneralResponseOf<VideoUploadTicket>>(`${this.mediaUrl(productId)}/video-ticket`, {})
      .pipe(
        map(response => {
          if (!response.data) {
            throw new Error(response.message || 'Video uploads are not configured.');
          }

          return response.data;
        })
      );
  }

  confirmVideo(
    productId: number,
    dto: ConfirmVideoUploadDto
  ): Observable<GeneralResponseOf<AdminProductMedia>> {
    return this.http.post<GeneralResponseOf<AdminProductMedia>>(
      `${this.mediaUrl(productId)}/video`,
      dto
    );
  }

  /** Edits the text on a row. The asset itself is immutable. */
  update(
    productId: number,
    mediaId: number,
    dto: UpdateProductMediaDto
  ): Observable<GeneralResponseOf<AdminProductMedia>> {
    return this.http.put<GeneralResponseOf<AdminProductMedia>>(
      `${this.mediaUrl(productId)}/${mediaId}`,
      dto
    );
  }

  /**
   * Makes one image the hero.
   *
   * Its own endpoint rather than a field on the update, because it changes
   * another row as a side effect — the previous primary.
   */
  setPrimary(productId: number, mediaId: number): Observable<GeneralResponse> {
    return this.http.post<GeneralResponse>(`${this.mediaUrl(productId)}/${mediaId}/primary`, {});
  }

  /**
   * Sends the whole order rather than a move instruction.
   *
   * "Move item 3 to position 1" needs the client and the server to agree on
   * what the current order was, and they will not once two people are editing
   * the same product. The full list makes the last writer win, which is at
   * least a rule you can explain.
   */
  reorder(productId: number, dto: ReorderProductMediaDto): Observable<GeneralResponse> {
    return this.http.post<GeneralResponse>(`${this.mediaUrl(productId)}/order`, dto);
  }

  delete(productId: number, mediaId: number): Observable<GeneralResponse> {
    return this.http.delete<GeneralResponse>(`${this.mediaUrl(productId)}/${mediaId}`);
  }
}
