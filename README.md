# WoodHeart Web

Angular storefront, customer dashboard and admin panel for **WoodHeart** — home interior furniture and interior design consultation, built for the Bangladeshi market.

| | |
|---|---|
| Framework | Angular 21 — standalone, signals, zoneless, SSR |
| Styling | Bootstrap 5 + Angular CDK |
| Tests | Vitest |
| API | WoodHeart backend (.NET 10) — [`WoodHeart_BE`](https://github.com/aslam6161/WoodHeart_BE), runs on `localhost:5199` |

**How work moves through the repo** — branches, pull requests, reviews, CI/CD: [CONTRIBUTING.md](CONTRIBUTING.md).

**Architecture and roadmap** live in the backend repo: [`WoodHeart_BE/PLAN.md`](https://github.com/aslam6161/WoodHeart_BE/blob/main/PLAN.md). One copy, deliberately — duplicated architecture docs drift apart and then mislead.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | `^20.19` \|\| `^22.12` \|\| `>=24` | `node --version` |
| npm | 10+ | `npm --version` |

The version is pinned in [`.nvmrc`](.nvmrc). Angular 21 was chosen over 22 specifically because 22 requires Node 22.22.3+ for nothing this project uses.

---

## Getting started

```bash
npm install
npm start
```

The app runs on `http://localhost:4200`. **Start the API first** — the home page calls `/api/diagnostics/ping` and will show "Could not reach the API" without it:

```bash
cd ../WoodHeart/backend/WoodHeart.Presentation
dotnet run
```

| Command | What it does |
|---|---|
| `npm start` | Dev server with HMR |
| `npm test -- --watch=false` | Unit tests (Vitest) |
| `npm run build` | Production build, with SSR |
| `npm run serve:ssr:woodheart-web` | Serve the built SSR bundle |

---

## Structure

Follows `D:\Personal_Projects\IMSAnuglar`, so navigating one project teaches the other.

```
src/
├─ environments/          environment.ts + environment.prod.ts (apiUrl)
├─ styles.scss            Bootstrap 5 + brand tokens
└─ app/
    ├─ _directives/       hasRole, onlyNumber, lazyImg
    ├─ _forms/            reusable form-control components
    ├─ _guards/           auth, admin, staff, preventUnsavedChanges
    ├─ _interceptors/     jwt, error, loading
    ├─ _layout/           default-layout (storefront), admin-layout, adminComponents
    ├─ _models/           one interface per model, + dtos/
    ├─ _resolvers/
    ├─ _services/         one per feature, + paginationHelper
    └─ home/  nav/  footer/  errors/  … feature folders
```

The `_`-prefixed folders hold shared concerns; the prefix sorts them to the top, which is the point.

---

## The API contract

Three things must stay in step with the backend. If one changes there, change it here in the same pull request.

| This repo | Backend |
|---|---|
| `_models/generalResponse.ts` | `WoodHeart.Repository.GeneralResponse` |
| `_models/pagination.ts` | `PagedList<T>` / `PaginationParams` / `PaginationHeader` |
| `_services/paginationHelper.ts` | The `X-Pagination` response header |

**Every API response is a `GeneralResponse`** — validation failures and business failures alike — so there is one envelope to unpack, not two.

**Branch on `errorCode`, never on `message`.** The code (`ordering.insufficient_stock`) is a contract; the message is prose that gets reworded and translated to Bangla.

---

## Conventions

- **Standalone components.** No `NgModule` anywhere.
- **Signals for state**, not `BehaviorSubject` + `take(1)`. RxJS stays for genuine event streams — typeahead debounce, websockets.
- **Functional interceptors and guards** (`HttpInterceptorFn`, `CanActivateFn`).
- **Every route lazy-loaded.** The admin bundle must never reach a public visitor.
- **Nothing touches `localStorage` without an `isPlatformBrowser` guard.** It does not exist during SSR, and reaching for it there takes the whole render down.
- **`NgOptimizedImage` for product photography**, with explicit width and height. A furniture site is 80% images — this *is* the performance work.

---

## Performance

The initial bundle budget is 600 kB warn / 700 kB error, enforced by the production build in CI.

Judge changes by the **gzipped transfer size**, currently ~105 kB, not the raw total. Bootstrap's CSS alone is 227 kB raw but ~23 kB over the wire, so raw-byte budgets systematically overstate CSS. A large share of this audience is on a mid-range phone over 4G.

---

## Why Angular 21 and not 12

The reference project, IMSAnuglar, is Angular 12. That version reached end of life in **November 2022** — no security patches — and its CLI requires Node 12/14/16, so it will not install on a current machine.

The folder structure, naming and API contract are carried across unchanged. What changed is only what had to: NgModules → standalone, `BehaviorSubject` → signals, class interceptors → functional, Bootstrap 4 + jQuery → Bootstrap 5, and the addition of SSR — which matters commercially, because a client-rendered catalog is one Google cannot index.
