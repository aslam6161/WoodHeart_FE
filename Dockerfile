# -----------------------------------------------------------------------------
# WoodHeart storefront — production image (Angular 21, server-side rendered).
#
#   docker build -t woodheart-web .
#   docker run -p 4000:4000 woodheart-web
#
# This runs Node, not nginx. The app is server-rendered: the first paint of a
# product page comes from the server with the product already in the HTML,
# which is what makes it indexable and what makes it usable on a mid-range
# phone on 4G. A static nginx image would throw that away.
# -----------------------------------------------------------------------------

FROM node:22-alpine AS build
WORKDIR /src

# Manifest first, so `npm ci` is cached and does not re-run every time a
# component changes. This is the single biggest win in Node image build time.
COPY package.json package-lock.json ./

# `npm ci`, not `npm install`: it installs exactly what the lockfile says and
# fails if package.json and the lockfile disagree. Dev dependencies are needed
# here — the Angular compiler is one of them.
RUN npm ci

COPY . .

# Fails the build on a bundle budget breach, which is deliberate. The budget is
# the only thing standing between this and a storefront nobody in Dhaka can
# load on mobile data.
RUN npm run build -- --configuration production

# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# tzdata: without it the container cannot resolve "Asia/Dhaka" and every date
# rendered server-side is six hours out.
RUN apk add --no-cache tzdata curl
ENV TZ=Asia/Dhaka
ENV NODE_ENV=production
ENV PORT=4000

# The hostnames this server will render for, beyond the localhost entries
# compiled into the build. THIS MUST BE SET FOR A REAL DOMAIN. Angular fails
# closed on an unknown Host: the request is not rejected, it is quietly
# downgraded to a client-side shell with no product HTML, no title and no
# structured data — and it still answers 200, so the health check below passes
# and nothing looks wrong.
#
#   docker run -e ALLOWED_HOSTS=woodheart.com.bd,www.woodheart.com.bd ...
ENV ALLOWED_HOSTS=""

# Set to "true" only when a reverse proxy in front is actually setting
# X-Forwarded-*. An untrusted forwarded header downgrades the render the same
# way; a trusted one that nothing sets lets a client forge its own.
ENV TRUST_PROXY_HEADERS="false"

# The canonical origin for <link rel="canonical"> and og:url, e.g.
# https://woodheart.com.bd. Without it the request's own origin is used, which
# behind a proxy is the internal one.
ENV SITE_URL=""

# The Cloudinary cloud name, e.g. "woodheart". Not a secret — it is the host of
# every image URL on every page — and it is passed at runtime rather than
# compiled in, so staging and production run the identical image. Unset means
# products render placeholder tiles instead of photographs.
ENV CLOUDINARY_CLOUD_NAME=""

# Where server-side rendering reaches the API. Inside a compose network this is
# the API service directly, e.g. http://api:8080 — the browser still uses the
# relative /api path through the proxy.
ENV API_INTERNAL_URL=""

# The Angular server build bundles its dependencies — express included — into
# server.mjs, so there is no node_modules in this stage at all. That is why the
# runtime image is a fraction of the build image.
COPY --from=build /src/dist/woodheart-web ./dist/woodheart-web

# The node images ship a non-root `node` user for exactly this.
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:4000/ > /dev/null || exit 1

CMD ["node", "dist/woodheart-web/server/server.mjs"]
