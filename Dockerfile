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
