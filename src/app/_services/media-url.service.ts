import { Injectable, StateKey, TransferState, inject, makeStateKey } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * The cloud name, handed from the server render to the browser.
 *
 * <b>Runtime rather than compiled in, for the same reason as the site
 * origin.</b> Baking it into the bundle means staging and production need
 * separate builds of identical code, and it means the value is decided by
 * whoever ran the build rather than by whoever is deploying. It travels in the
 * transfer state Angular already serialises for hydration, so the browser reads
 * exactly what the server rendered with — no second source of truth, and no
 * extra request.
 */
export const CLOUD_NAME_KEY: StateKey<string> = makeStateKey<string>('wh.cloudName');

/** How an image should be fitted to the box it is rendered in. */
export interface ImageOptions {
  /** Target width in CSS pixels. */
  width: number;

  /** Target height. Omit to let the aspect ratio decide. */
  height?: number;

  /**
   * `fill` crops to the box, `limit` fits inside it without cropping.
   *
   * A card wants `fill`, because a grid of photographs at nine different
   * aspect ratios reads as a mistake. A product page wants `limit`, because
   * cropping the arm off a sofa is worse than a gap beside it.
   */
  fit?: 'fill' | 'limit';
}

/**
 * Builds Cloudinary delivery URLs from a stored public id.
 *
 * <b>Why the client composes these rather than the API returning them.</b>
 * The right transformation depends on where the image is being rendered — a
 * card wants 400px, a product page wants 1200, and a `srcset` wants five widths
 * for the same image. An API that returned finished URLs would have to ship
 * every size on every media row, or serve one size everywhere and waste most of
 * it on a phone. So the API returns the public id, which is a key, and this
 * turns it into a URL.
 *
 * The cloud name is duplicated between the API's configuration and this app's,
 * and that is fine: it is not a secret. It appears in the host of every image
 * URL on every page. The API key and secret never leave the server.
 */
@Injectable({ providedIn: 'root' })
export class MediaUrlService {
  // The compiled-in value is the fallback, not the source. It is empty in the
  // production environment file precisely so a wrong cloud name — which renders
  // a page of broken images — cannot ship by accident.
  private readonly cloudName = inject(TransferState).get(
    CLOUD_NAME_KEY,
    environment.cloudinaryCloudName
  );

  /**
   * The widths offered in a `srcset`.
   *
   * Chosen for the devices this storefront is actually used on rather than a
   * round-number ladder: a mid-range Android at 360 CSS pixels and DPR 2 wants
   * 720, which is why 768 is here and 800 is not.
   */
  static readonly Widths = [320, 480, 768, 1024, 1440] as const;

  /** True when Cloudinary is configured. False renders placeholders instead. */
  get isConfigured(): boolean {
    return !!this.cloudName;
  }

  /**
   * One delivery URL.
   *
   * `f_auto` and `q_auto` are on every URL and do most of the work: Cloudinary
   * negotiates AVIF or WebP against the requesting browser and picks a quality
   * that holds up at the delivered size. Both are worth more here than any
   * amount of hand-tuning, because the audience is on 4G.
   */
  image(publicId: string | null | undefined, options: ImageOptions): string | null {
    if (!publicId || !this.cloudName) {
      return null;
    }

    // Already a full URL — media stored somewhere else entirely. Prefixing
    // Cloudinary's host onto it would produce a URL that 404s.
    if (/^https?:\/\//i.test(publicId)) {
      return publicId;
    }

    const parts = ['f_auto', 'q_auto'];

    if (options.fit === 'limit') {
      parts.push('c_limit');
    } else {
      // g_auto puts Cloudinary's subject detection in charge of the crop. On
      // furniture photographed in a room it is the difference between a card
      // showing the wardrobe and a card showing the wall beside it.
      parts.push('c_fill', 'g_auto');
    }

    parts.push(`w_${Math.round(options.width)}`);

    if (options.height) {
      parts.push(`h_${Math.round(options.height)}`);
    }

    return `${this.base('image')}/${parts.join(',')}/${encodeURI(publicId)}`;
  }

  /**
   * A `srcset` across {@link MediaUrlService.Widths}.
   *
   * Paired with a `sizes` attribute the browser picks from before layout. Width
   * descriptors rather than `1x`/`2x` because the same card is a different
   * number of pixels on a phone and on a desktop grid, and only the browser
   * knows which.
   */
  srcset(publicId: string | null | undefined, aspectRatio?: number): string | null {
    if (!publicId || !this.cloudName) {
      return null;
    }

    return MediaUrlService.Widths.map(width => {
      const url = this.image(publicId, {
        width,
        height: aspectRatio ? Math.round(width / aspectRatio) : undefined,
        fit: aspectRatio ? 'fill' : 'limit'
      });

      return `${url} ${width}w`;
    }).join(', ');
  }

  /** The video file itself. */
  video(publicId: string | null | undefined): string | null {
    if (!publicId || !this.cloudName) {
      return null;
    }

    if (/^https?:\/\//i.test(publicId)) {
      return publicId;
    }

    // q_auto only. Resizing video on delivery is an expensive transformation
    // and this storefront has no player controls to justify it yet.
    return `${this.base('video')}/q_auto/${encodeURI(publicId)}.mp4`;
  }

  /**
   * A still from the first frame, for a video's `poster`.
   *
   * Without one the player shows a black rectangle until the first frame
   * decodes, which on a slow connection is most of the time anyone spends
   * looking at it.
   */
  videoPoster(publicId: string | null | undefined, width: number): string | null {
    if (!publicId || !this.cloudName) {
      return null;
    }

    return `${this.base('video')}/so_0,f_auto,q_auto,c_limit,w_${width}/${encodeURI(publicId)}.jpg`;
  }

  private base(resourceType: 'image' | 'video'): string {
    return `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload`;
  }
}
