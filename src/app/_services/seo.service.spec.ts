import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { SeoService } from './seo.service';
import { SITE_ORIGIN } from '../_interceptors/api-base.interceptor';

const origin = 'https://woodheart.example';

describe('SeoService', () => {
  let seo: SeoService;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SITE_ORIGIN, useValue: origin }]
    });

    seo = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);

    document.head.querySelectorAll('meta[name], meta[property], link[rel="canonical"], script#wh-jsonld')
      .forEach(element => element.remove());
  });

  it('writes an absolute canonical from a path', () => {
    // The API returns `/products/segun-king-bed` on purpose — which host serves
    // it is the client's business. A relative canonical is ignored outright.
    seo.apply({ title: 'Segun King Bed', canonicalPath: '/products/segun-king-bed' });

    const canonical = document.head.querySelector('link[rel="canonical"]');

    expect(canonical?.getAttribute('href')).toBe(
      `${origin}/products/segun-king-bed`
    );
  });

  it('replaces the canonical rather than adding a second one', () => {
    seo.apply({ title: 'One', canonicalPath: '/products/one' });
    seo.apply({ title: 'Two', canonicalPath: '/products/two' });

    const canonicals = document.head.querySelectorAll('link[rel="canonical"]');

    expect(canonicals.length).toBe(1);
    expect(canonicals[0].getAttribute('href')).toBe(`${origin}/products/two`);
  });

  it('clears a tag the previous page set', () => {
    // The reason this is a service and not per-component code. These tags are
    // global mutable state: a product page that sets og:image and navigates to
    // a listing would otherwise leave the previous product's photograph on
    // every share card the listing produces.
    seo.apply({
      title: 'Segun King Bed',
      description: 'A bed',
      canonicalPath: '/products/segun-king-bed',
      imagePath: '/media/bed.jpg'
    });

    expect(document.head.querySelector('meta[property="og:image"]')).not.toBeNull();

    seo.apply({ title: 'Shop all', canonicalPath: '/products' });

    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });

  it('marks a page noindex only when asked', () => {
    seo.apply({ title: 'Search results', canonicalPath: '/products', noIndex: true });
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, follow'
    );

    seo.apply({ title: 'Shop all', canonicalPath: '/products' });
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('keeps exactly one structured-data block across navigations', () => {
    // Appending instead of replacing would accumulate a Product block per
    // product visited in one single-page session, and a page carrying eight
    // Product blocks describes eight products.
    seo.setJsonLd({ '@type': 'Product', name: 'One' });
    seo.setJsonLd({ '@type': 'Product', name: 'Two' });

    const scripts = document.head.querySelectorAll('script#wh-jsonld');

    expect(scripts.length).toBe(1);
    expect(JSON.parse(scripts[0].textContent ?? '{}').name).toBe('Two');
  });

  it('removes the structured data when a page has none', () => {
    seo.setJsonLd({ '@type': 'Product', name: 'One' });
    seo.setJsonLd(null);

    expect(document.head.querySelector('script#wh-jsonld')).toBeNull();
  });

  it('leaves an already-absolute media URL alone', () => {
    expect(seo.media('https://cdn.example.com/bed.jpg')).toBe('https://cdn.example.com/bed.jpg');
  });
});
