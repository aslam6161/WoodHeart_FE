import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { SITE_ORIGIN } from '../_interceptors/api-base.interceptor';

export interface SeoPage {
  title: string;
  description?: string | null;

  /** Path only, e.g. `/products/segun-king-bed`. Made absolute here. */
  canonicalPath: string;

  /** A `storagePath` from the API, or null. Resolved against `mediaUrl`. */
  imagePath?: string | null;

  type?: 'website' | 'product';

  /**
   * Keeps the page out of the index. Set on search results and on the
   * "we could not find that" state — a soft 404 that Google indexes is worse
   * than no page at all, because it competes with the real ones.
   */
  noIndex?: boolean;
}

/**
 * Owns everything in `<head>` that changes per page.
 *
 * <b>Written as a service rather than per component because these tags are
 * global mutable state.</b> A component that sets `og:image` and navigates
 * away leaves it set; the next page inherits the previous product's photograph
 * on every share card. Routing every write through one place means every write
 * is also an overwrite.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly configuredOrigin = inject(SITE_ORIGIN, { optional: true });

  private static readonly JsonLdId = 'wh-jsonld';
  private static readonly SiteName = 'WoodHeart';

  apply(page: SeoPage): void {
    // Bounded, because a title tag is truncated in the results anyway and an
    // over-long one dilutes the part that matters.
    const fullTitle = `${page.title} | ${SeoService.SiteName}`;

    this.title.setTitle(fullTitle);

    const canonical = this.absolute(page.canonicalPath);
    const image = page.imagePath ? this.media(page.imagePath) : null;

    this.setOrRemove('description', page.description);

    // Every tag below is written on every navigation, including with an empty
    // value, so nothing survives from the previous page.
    this.setProperty('og:title', fullTitle);
    this.setProperty('og:description', page.description);
    this.setProperty('og:url', canonical);
    this.setProperty('og:type', page.type ?? 'website');
    this.setProperty('og:site_name', SeoService.SiteName);
    this.setProperty('og:image', image);

    this.setOrRemove('twitter:card', image ? 'summary_large_image' : 'summary');
    this.setOrRemove('twitter:title', fullTitle);
    this.setOrRemove('twitter:description', page.description);
    this.setOrRemove('twitter:image', image);

    this.setOrRemove('robots', page.noIndex ? 'noindex, follow' : null);

    this.setCanonical(canonical);
  }

  /**
   * Replaces the page's structured data.
   *
   * One script element, found by id and rewritten. Appending instead would
   * accumulate a Product block per product visited in a single-page session,
   * and a page carrying eight Product blocks describes eight products — which
   * is a structured-data error, not eight chances to rank.
   */
  setJsonLd(data: unknown | null): void {
    const head = this.document.head;
    const existing = this.document.getElementById(SeoService.JsonLdId);

    if (data === null) {
      existing?.remove();
      return;
    }

    const script = existing ?? this.document.createElement('script');

    script.id = SeoService.JsonLdId;
    script.setAttribute('type', 'application/ld+json');
    // textContent, never innerHTML: the payload contains product names typed by
    // an admin, and this element sits in <head> where a stray </script> would
    // end the block and start executing.
    script.textContent = JSON.stringify(data);

    if (!existing) {
      head.appendChild(script);
    }
  }

  /** Absolute URL for a site path. */
  absolute(path: string): string {
    return join(this.origin(), path);
  }

  /** Absolute URL for a stored media path. */
  media(storagePath: string): string {
    // Already absolute — an externally hosted asset. Prefixing an origin onto
    // it would produce a URL that 404s.
    if (/^https?:\/\//i.test(storagePath)) {
      return storagePath;
    }

    return join(environment.mediaUrl || this.origin(), storagePath);
  }

  /**
   * Where this site is being served from.
   *
   * The injected token first, because it is the only source that knows about a
   * reverse proxy or a staging host. `location.origin` covers the browser when
   * nothing is configured, and the compiled-in value is the last resort — it is
   * empty in production precisely so a wrong domain cannot ship silently.
   */
  private origin(): string {
    return this.configuredOrigin || this.document.location?.origin || environment.siteUrl;
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }

    link.setAttribute('href', href);
  }

  private setOrRemove(name: string, content: string | null | undefined): void {
    if (content) {
      this.meta.updateTag({ name, content });
    } else {
      this.meta.removeTag(`name='${name}'`);
    }
  }

  private setProperty(property: string, content: string | null | undefined): void {
    if (content) {
      this.meta.updateTag({ property, content });
    } else {
      this.meta.removeTag(`property='${property}'`);
    }
  }
}

function join(origin: string, path: string): string {
  const base = origin.replace(/\/+$/, '');

  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
