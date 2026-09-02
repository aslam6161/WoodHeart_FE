/**
 * Server-rendering smoke test.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every unit test in this repo runs against `HttpTestingController`. A
 * substitute answers whatever the test tells it to, in whatever shape the test
 * invented, so a whole class of failure is invisible to them: the envelope
 * unwrapping wrongly, an enum arriving as a name where the code expects a
 * number, the SSR process never fetching at all and serialising an empty page.
 * The backend learned this the hard way — thirteen queries that passed 198 unit
 * tests threw on their first real SQL statement.
 *
 * So this boots the *built* SSR bundle, points it at an API, and asserts on the
 * bytes that come back before a single line of client JavaScript runs. That is
 * the HTML a crawler sees, and it is the only thing that makes the SEO work on
 * these pages real rather than intended.
 *
 * WHAT THE STUB IS, AND IS NOT
 * ----------------------------
 * The fixtures below are a *contract*: the `GeneralResponse` envelope, camelCase
 * properties, string-named enums, `PagedList` serialised as a bare array inside
 * `data`, and the `X-Pagination` header. They are copied from what the real API
 * returns, and the backend's own smoke test pins that same shape from the other
 * side.
 *
 * They are not the real API. If the backend changes its envelope, this stays
 * green and production breaks. Closing that gap means running the published
 * backend image and a Postgres service in this workflow, which is real work and
 * is named as the follow-up in the pull request rather than pretended away.
 *
 * Usage: node scripts/ssr-smoke.mjs   (after `ng build --configuration production`)
 */

import { createServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const API_PORT = 5199;
const APP_PORT = 4123;
const SERVER_BUNDLE = join(process.cwd(), 'dist/woodheart-web/server/server.mjs');

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const envelope = data => ({ id: 0, isSuccess: true, message: '', errorCode: null, data });

const categories = [
  {
    id: 1,
    nameEn: 'Bedroom',
    nameBn: 'শয়নকক্ষ',
    slug: 'bedroom',
    parentId: null,
    depth: 0,
    sortOrder: 0,
    isActive: true,
    isFeatured: true,
    productCount: 2,
    children: [
      {
        id: 2,
        nameEn: 'Beds',
        nameBn: 'বেড',
        slug: 'beds',
        parentId: 1,
        depth: 1,
        sortOrder: 0,
        isActive: true,
        isFeatured: false,
        productCount: 1,
        children: []
      }
    ]
  }
];

const bedCard = {
  id: 7,
  slug: 'segun-king-bed',
  nameEn: 'Segun King Bed',
  nameBn: 'সেগুন কিং বেড',
  shortDescriptionEn: 'A solid segun bed built to last a generation.',
  categorySlug: 'beds',
  categoryNameEn: 'Beds',
  brandNameEn: 'WoodHeart',
  productType: 'MadeToOrder',
  fromPrice: 68500,
  compareAtPrice: null,
  currency: 'BDT',
  isOnOffer: false,
  discountPercent: null,
  isFeatured: true,
  leadTimeDays: 14,
  averageRating: null,
  reviewCount: 0,
  primaryImagePath: 'woodheart/products/7/bed-hero',
  primaryImageAlt: 'Segun King Bed',
  variantCount: 4
};

const bedDetail = {
  ...bedCard,
  descriptionEn: 'Hand-finished segun, joined without visible fixings.',
  descriptionBn: 'হাতে ফিনিশ করা সেগুন কাঠ।',
  lengthCm: 210,
  widthCm: 190,
  heightCm: 110,
  weightKg: 95,
  material: 'Segun',
  finishType: 'Matte lacquer',
  warrantyMonths: 24,
  assemblyRequired: true,
  deliverySurcharge: null,
  breadcrumbs: [
    { nameEn: 'Bedroom', nameBn: 'শয়নকক্ষ', slug: 'bedroom' },
    { nameEn: 'Beds', nameBn: 'বেড', slug: 'beds' }
  ],
  seo: {
    // Branded, because that is what CatalogSeed actually writes into SeoTitle.
    // The earlier bare value here is why the doubled title reached a browser.
    title: 'Segun King Bed — WoodHeart',
    description: 'A solid segun bed built to last a generation.',
    canonicalPath: '/products/segun-king-bed',
    // What CatalogMapper.ToStorefrontDetail actually produces:
    // `product.OgImagePath ?? the primary media's storage path`. Leaving this
    // null here made the og:image check fail against correct code — the
    // fixture was the thing that was wrong.
    ogImagePath: 'woodheart/products/7/bed-hero'
  },
  variants: [
    {
      id: 71,
      sku: 'WH-BED-001-SG-6',
      variantName: 'Segun · 6ft',
      optionValues: { Wood: 'Segun', Size: '6ft' },
      price: 68500,
      compareAtPrice: null,
      isOnOffer: false,
      isDefault: true
    },
    {
      id: 72,
      sku: 'WH-BED-001-SG-7',
      variantName: 'Segun · 7ft',
      optionValues: { Wood: 'Segun', Size: '7ft' },
      price: 76000,
      compareAtPrice: null,
      isOnOffer: false,
      isDefault: false
    }
  ],
  media: [
    {
      id: 91,
      variantId: null,
      mediaType: 'Image',
      storagePath: 'woodheart/products/7/bed-hero',
      altText: 'A segun king bed against a white wall',
      caption: null,
      isPrimary: true,
      width: 4000,
      height: 3000,
      externalUrl: null
    },
    {
      id: 92,
      variantId: null,
      mediaType: 'Video',
      storagePath: 'woodheart/products/7/bed-clip',
      altText: 'The bed being assembled',
      caption: null,
      isPrimary: false,
      width: 1920,
      height: 1080,
      externalUrl: null
    }
  ]
};

const pagination = {
  currentPage: 1,
  itemsPerPage: 24,
  totalItems: 1,
  totalPages: 1
};

// -----------------------------------------------------------------------------
// The stub API
// -----------------------------------------------------------------------------

function startApi() {
  const server = createServer((request, response) => {
    const url = new URL(request.url, `http://localhost:${API_PORT}`);
    const send = (status, body, headers = {}) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...headers
      });
      response.end(JSON.stringify(body));
    };

    if (url.pathname === '/api/catalog/categories') {
      return send(200, envelope(categories));
    }

    if (url.pathname === '/api/catalog/products') {
      return send(200, envelope([bedCard]), {
        'X-Pagination': JSON.stringify(pagination),
        'Access-Control-Expose-Headers': 'X-Pagination'
      });
    }

    if (url.pathname === '/api/catalog/products/segun-king-bed') {
      return send(200, envelope(bedDetail));
    }

    if (url.pathname === '/api/catalog/products/segun-king-bed/related') {
      return send(200, envelope([]));
    }

    // Anything else is a product that does not exist. The real API answers a
    // draft the same way, which is the point of testing this path.
    return send(404, {
      id: 0,
      isSuccess: false,
      message: 'No product with that slug.',
      errorCode: 'catalog.product_not_found',
      data: null
    });
  });

  return new Promise(resolve => server.listen(API_PORT, '127.0.0.1', () => resolve(server)));
}

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

async function get(path) {
  const response = await fetch(`http://127.0.0.1:${APP_PORT}${path}`, { redirect: 'manual' });
  return { status: response.status, html: await response.text() };
}

/**
 * A raw request, so the `Host` header can be set.
 *
 * `fetch` refuses to — `host` is a forbidden header name — and the Host header
 * is precisely what Angular's allowed-hosts check reads. Without this the test
 * could only ever exercise `127.0.0.1`, which the build manifest allows, and
 * the runtime `ALLOWED_HOSTS` plumbing would go unproven.
 */
function getWithHost(path, host) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { host: '127.0.0.1', port: APP_PORT, path, method: 'GET', headers: { Host: host } },
      response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => (body += chunk));
        response.on('end', () => resolve({ status: response.statusCode, html: body }));
      }
    );

    request.on('error', reject);
    request.end();
  });
}

async function waitForApp(child) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`The SSR server exited with code ${child.exitCode} during startup.`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${APP_PORT}/`, { redirect: 'manual' });

      if (response.status < 500) {
        await response.text();
        return;
      }
    } catch {
      // Not listening yet.
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error('The SSR server never became ready.');
}

// -----------------------------------------------------------------------------

async function main() {
  if (!existsSync(SERVER_BUNDLE)) {
    console.error(`Missing ${SERVER_BUNDLE}. Run a production build first.`);
    process.exit(1);
  }

  const api = await startApi();
  const log = [];

  const child = spawn(process.execPath, [SERVER_BUNDLE], {
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      // The production bundle's apiUrl is `/api/`, which Node's fetch cannot
      // use. This is the variable that makes server rendering work in
      // production, so the smoke test exercises exactly that path.
      API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
      SITE_URL: 'https://woodheart.example',
      ALLOWED_HOSTS: 'woodheart.example',
      // Carried to the browser in the transfer state, so the URLs in the
      // served HTML and the URLs after hydration come from one value.
      CLOUDINARY_CLOUD_NAME: 'woodheart-smoke'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', chunk => log.push(chunk.toString()));
  child.stderr.on('data', chunk => log.push(chunk.toString()));

  const shutdown = () => {
    child.kill();
    api.close();
  };

  try {
    await waitForApp(child);

    console.log('--- home page renders products on the server ---');
    {
      const { status, html } = await get('/');

      check('home responds 200', status === 200, `got ${status}`);
      // The failure this test was written to catch. When the host is not on
      // the allow list Angular does not error — it quietly serves the
      // client-side shell, which answers 200 with no product HTML in it. This
      // marker is only present on a genuine server render.
      check('it was server rendered, not the CSR shell', html.includes('ng-server-context="ssr"'));
      // The whole claim of server rendering, in one assertion: the product name
      // is in the first response, not fetched after hydration.
      check('the product is in the served HTML', html.includes('Segun King Bed'));
      check('the price is formatted as taka', html.includes('৳68,500'));
      check('the category tree rendered', html.includes('Bedroom'));

      // The card is the only place most visitors ever see a product, and its
      // image is most of the page weight. If the transformation stopped being
      // applied, the page would still look right and quietly ship a 4000px
      // original to a phone.
      check(
        'card images come from Cloudinary',
        html.includes('res.cloudinary.com/woodheart-smoke/image/upload/')
      );
      check('with automatic format and quality', html.includes('f_auto,q_auto'));
      check('and a responsive srcset', html.includes('srcset=') && html.includes('1440w'));
    }

    console.log('--- listing renders and reads the envelope ---');
    {
      const { status, html } = await get('/products');

      check('listing responds 200', status === 200, `got ${status}`);
      // If the envelope were handed back as the item list, this grid would be
      // empty and the page would look like an empty catalogue.
      check('products came out of the envelope', html.includes('Segun King Bed'));
      check('the nested category rendered', html.includes('Beds'));
      check('the count from X-Pagination rendered', html.includes('1 product'));
    }

    console.log('--- product page head tags ---');
    {
      const { status, html } = await get('/products/segun-king-bed');

      check('product page responds 200', status === 200, `got ${status}`);
      check(
        'the title is the product, not the app name',
        html.includes('<title>Segun King Bed — WoodHeart</title>')
      );
      // An admin-authored SeoTitle already carries the brand. Appending it
      // again reads as a bug to anyone who sees the tab or the search result.
      check('and the brand is not doubled', !html.includes('WoodHeart | WoodHeart'));
      check(
        'the canonical is absolute and correct',
        html.includes('href="https://woodheart.example/products/segun-king-bed"')
      );
      check('exactly one canonical', (html.match(/rel="canonical"/g) ?? []).length === 1);
      check('og:url is set', html.includes('property="og:url"'));
      check('structured data is present', html.includes('application/ld+json'));
      check('it describes a Product', html.includes('"@type":"Product"'));
      // Two variants at two prices, so an AggregateOffer with a real range.
      check('the offer states a price range', html.includes('"lowPrice":68500'));
      check('Bangla survived the round trip', html.includes('সেগুন কিং বেড'));
      check('breadcrumbs rendered', html.includes('Bedroom') && html.includes('Beds'));
      check('the variant SKU rendered', html.includes('WH-BED-001-SG-6'));
      check('no robots noindex on a real product', !html.includes('noindex'));

      // The share card. Handing a scraper the 4000px original means it fetches
      // several megabytes to render a thumbnail, or gives up and shows nothing.
      check(
        'og:image is cropped to share-card size',
        html.includes('c_fill,g_auto,w_1200,h_630')
      );

      // The hero is the Largest Contentful Paint on every product URL.
      check('the hero is not cropped', html.includes('f_auto,q_auto,c_limit,w_1024'));
      check('the hero is marked high priority', html.includes('fetchpriority="high"'));

      // A video thumbnail is a still from its first frame, not the video.
      check('the video thumbnail is a poster frame', html.includes('/video/upload/so_0,'));
      check(
        'and the cloud name came from the environment, not the bundle',
        !html.includes('res.cloudinary.com/woodheart-dev/')
      );
    }

    console.log('--- a product that does not exist ---');
    {
      const { status, html } = await get('/products/no-such-thing');

      // The one that is easy to get wrong and invisible when you do: a soft 404
      // renders the words "not found" and answers 200, which invites Google to
      // index it against the real product pages.
      check('it answers 404, not 200', status === 404, `got ${status}`);
      check('it says so on the page', html.includes('could not find that product'));
      check('and it is marked noindex', html.includes('noindex'));
    }

    console.log('--- a host named only at runtime ---');
    {
      // ALLOWED_HOSTS is how a deployment names its real domain without a
      // rebuild. If this ever regresses, production serves empty shells on the
      // live domain while every localhost check stays green.
      const { status, html } = await getWithHost('/', 'woodheart.example');

      check('a configured host is served', status === 200, `got ${status}`);
      check('and it is server rendered', html.includes('ng-server-context="ssr"'));
      check('with the product in it', html.includes('Segun King Bed'));
    }

    {
      const { html } = await getWithHost('/', 'evil.example');

      // Not on the list: Angular refuses to render for it. This is the SSRF
      // protection doing its job, and the assertion that stops anyone
      // "fixing" the allow list by setting it to "*".
      check(
        'an unlisted host does not get a server render',
        !html.includes('ng-server-context="ssr"')
      );
    }

    console.log('--- an unknown URL ---');
    {
      const { status } = await get('/nothing-here');

      check('the catch-all answers 404', status === 404, `got ${status}`);
    }
  } catch (error) {
    console.error(`\n${error.message}`);
    failures.push(error.message);
  } finally {
    shutdown();
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    console.error('--- SSR server output ---');
    console.error(log.join('').slice(-4000));
    process.exit(1);
  }

  console.log('\nAll server-rendering smoke checks passed.');
}

main();
