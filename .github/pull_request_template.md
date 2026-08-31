## What this changes

<!-- One or two sentences. The diff says what; say why. -->

## Why

<!-- The problem, or the roadmap item. -->

## How to check it

<!-- The click-path a reviewer follows to see it work. Screenshots for
     anything visual — before and after if it changed. -->

---

## Before requesting review

- [ ] Branch is named `<type>/<slug>` — see [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Targets `develop` (or is a `develop` → `main` release)
- [ ] `npm test` and `npm run build -- --configuration production` pass locally
- [ ] Checked at a narrow viewport, not only on a desktop monitor

## Angular specifics this touches

- [ ] Nothing here touches `window`, `document`, `localStorage` or `setTimeout`
      outside an `isPlatformBrowser` guard or `afterNextRender` — unguarded, it
      throws during SSR and silently degrades the page to client-only
- [ ] State the template reads is a signal (change detection is zoneless)
- [ ] Subscriptions are cleaned up, or replaced by `async` / `toSignal`
- [ ] New routes are lazy-loaded
- [ ] Images have explicit dimensions (no layout shift)
- [ ] Interactive elements are keyboard-reachable and labelled

## API seam

- [ ] No API call in this change
- [ ] Responses are unpacked as `GeneralResponse`
- [ ] Error handling branches on `ErrorCode`, never on `Message`
- [ ] No raw `ErrorCode` is shown to a customer
- [ ] Paged endpoints go through `paginationHelper`
- [ ] Contract changed — the matching [WoodHeart_BE](https://github.com/aslam6161/WoodHeart_BE)
      pull request is: <!-- link it, and merge that one first -->

## Bundle

- [ ] Production build is still inside budget (600 kB warn / 700 kB error)
- [ ] Any new dependency is justified below

<!-- If you added a dependency, say what it does and what you would have had to
     write instead. The storefront is served to mid-range phones on 4G. -->

## Anything a reviewer should push back on

<!-- Shortcuts taken, alternatives rejected, things you are unsure about. -->
