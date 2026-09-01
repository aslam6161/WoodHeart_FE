import { TestBed } from '@angular/core/testing';
import { TransferState } from '@angular/core';
import { CLOUD_NAME_KEY, MediaUrlService } from './media-url.service';

const cloud = 'test-cloud';

describe('MediaUrlService', () => {
  let media: MediaUrlService;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    // Seeded the way the server seeds it, so these tests exercise the same
    // path the browser takes after hydration rather than the compiled-in
    // fallback.
    TestBed.inject(TransferState).set(CLOUD_NAME_KEY, cloud);

    media = TestBed.inject(MediaUrlService);
  });

  it('builds a delivery URL from a public id', () => {
    const url = media.image('woodheart/products/7/abc123', { width: 400, height: 300 });

    expect(url).toBe(
      `https://res.cloudinary.com/${cloud}` +
        '/image/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_300/woodheart/products/7/abc123'
    );
  });

  it('takes the cloud name from the transfer state, not the bundle', () => {
    // The value the server rendered with. If the browser fell back to the
    // compiled-in one, every image URL after hydration would point at a
    // different account than the ones in the served HTML.
    expect(media.image('bed', { width: 400 })).toContain(`/${cloud}/`);
  });

  it('always asks for automatic format and quality', () => {
    // These two do most of the work: Cloudinary negotiates AVIF or WebP against
    // the requesting browser and picks a quality that holds up at the delivered
    // size. Worth more than any hand-tuning on a 4G audience.
    const url = media.image('bed', { width: 800 })!;

    expect(url).toContain('f_auto');
    expect(url).toContain('q_auto');
  });

  it('crops with subject detection when filling, and does not when limiting', () => {
    // g_auto is what makes a 4:3 card show the wardrobe rather than the wall
    // beside it. c_limit takes no gravity because it never crops.
    expect(media.image('bed', { width: 400, height: 300, fit: 'fill' })).toContain('c_fill,g_auto');

    const limited = media.image('bed', { width: 1024, fit: 'limit' })!;
    expect(limited).toContain('c_limit');
    expect(limited).not.toContain('g_auto');
  });

  it('builds a srcset across every width', () => {
    const srcset = media.srcset('bed', 4 / 3)!;
    const entries = srcset.split(', ');

    expect(entries.length).toBe(MediaUrlService.Widths.length);

    // Width descriptors, not 1x/2x: the same card is a different number of
    // pixels on a phone and in a desktop grid, and only the browser knows which.
    expect(entries[0]).toContain(' 320w');
    expect(entries[0]).toContain('w_320,h_240');
  });

  it('leaves the aspect ratio alone when none is given', () => {
    const srcset = media.srcset('bed')!;

    // A product page shows the whole photograph. A card can crop a sofa; the
    // page selling it cannot.
    expect(srcset).toContain('c_limit');
    expect(srcset).not.toContain('h_');
  });

  it('returns a poster from the first frame of a video', () => {
    const poster = media.videoPoster('clip', 1024)!;

    // Without one the player is a black rectangle until the first frame
    // decodes, which on a slow connection is most of the time anyone spends
    // looking at it.
    expect(poster).toContain('/video/upload/so_0,');
    expect(poster.endsWith('/clip.jpg')).toBe(true);
  });

  it('leaves an already-absolute URL alone', () => {
    // Media hosted somewhere else entirely. Prefixing Cloudinary's host onto it
    // would produce a URL that 404s.
    expect(media.image('https://cdn.example.com/bed.jpg', { width: 400 })).toBe(
      'https://cdn.example.com/bed.jpg'
    );
  });

  it('returns null for a missing public id rather than a broken URL', () => {
    // No media pipeline has run for most products yet, so this is the common
    // case. The card renders its placeholder tile; it must never render an
    // <img> pointing at nothing.
    expect(media.image(null, { width: 400 })).toBeNull();
    expect(media.image(undefined, { width: 400 })).toBeNull();
    expect(media.image('', { width: 400 })).toBeNull();
    expect(media.srcset(null)).toBeNull();
  });
});

describe('MediaUrlService with no cloud configured', () => {
  it('returns null for everything', () => {
    // A fresh checkout has no Cloudinary account, and the production bundle
    // ships an empty fallback on purpose. Placeholder tiles are the correct
    // output; a URL built around an empty cloud name is a broken image on
    // every card.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    // An explicit empty value, which is what the production bundle's fallback
    // is and what a deployment with CLOUDINARY_CLOUD_NAME unset resolves to.
    TestBed.inject(TransferState).set(CLOUD_NAME_KEY, '');

    const media = TestBed.inject(MediaUrlService);

    expect(media.isConfigured).toBe(false);
    expect(media.image('bed', { width: 400 })).toBeNull();
    expect(media.srcset('bed')).toBeNull();
    expect(media.video('clip')).toBeNull();
  });
});
