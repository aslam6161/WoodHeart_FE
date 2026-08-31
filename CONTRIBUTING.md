# How work moves through WoodHeart

**The full guide lives in the backend repository:**
[WoodHeart_BE/CONTRIBUTING.md](https://github.com/aslam6161/WoodHeart_BE/blob/main/CONTRIBUTING.md)

Both repositories follow identical rules. Written down once, so the two copies
cannot drift apart. What follows is the short version and the parts specific to
this repository.

---

## The branches

| Branch | What it means | Who writes to it |
|---|---|---|
| `main` | **Deployable.** Running in production or about to be. | Nothing but a reviewed pull request from `develop`. |
| `develop` | **Integration.** Finished features awaiting the next release. | Reviewed pull requests from working branches. |
| `phase/<n>-<slug>` | The working branch for one roadmap phase. | You, directly. |

Working branch names are `<type>/<slug>`, lower-case, where type is one of
`phase` `feature` `fix` `chore` `docs` `refactor`. CI rejects anything else.

```bash
git checkout develop && git pull
git checkout -b phase/1-catalog
git push -u origin phase/1-catalog
# ... work ...
gh pr create --base develop --fill
```

A phase branch stays open for the whole phase; each finished feature inside it
becomes its own pull request into `develop`. After each merge, bring the phase
branch back up to date:

```bash
git checkout develop && git pull
git checkout phase/1-catalog && git merge develop
```

Release by opening `develop` → `main`. That merge triggers the deployment.

---

## Review

Review is manual, and it is yours. Open the pull request, let CI finish, then
read the whole diff on GitHub before merging it. Reading it there rather than
in your editor is the point — the diff is the change stripped of everything you
remember about writing it.

Work through the Angular checklist in the pull request template against the
diff rather than from memory. Two of those items — unguarded browser globals
during SSR, and plain fields under zoneless change detection — fail silently
and look completely fine locally, which is exactly why they are on a list.

There is no automated reviewer. GitHub Copilot code review needs a paid plan,
GitHub Models was retired in July 2026, and an Anthropic API key bills per
review. If you want a second opinion on a branch before opening the pull
request, `/code-review` in Claude Code does that locally at no extra cost.

---

## What CI checks

| Check | Command |
|---|---|
| Branch name | matches `<type>/<slug>` |
| Lint | `npm run lint --if-present` |
| Unit tests | `npm test -- --watch=false` (Vitest, not Karma) |
| Production build with SSR | `npm run build -- --configuration production` |
| Bundle budgets | enforced by the build — 600 kB warn, 700 kB error |
| Dependency audit | `npm audit --audit-level=high` |
| Docker image builds | `docker build .` |

---

## Three things this codebase will punish you for

**Server-side rendering.** This app renders on the server. `window`,
`document`, `localStorage` and `setTimeout` touched unguarded in a constructor
or a field initialiser throw during SSR, and the page silently degrades to
client-only rendering — which looks fine locally and destroys the SEO the
storefront depends on. Guard with `isPlatformBrowser`, or use
`afterNextRender`.

**Zoneless change detection.** `provideZonelessChangeDetection()` is on.
Mutating a plain class field and expecting the template to update does not
work. Anything the template reads is a signal.

**The API contract.** Branch on `ErrorCode`, never on `Message` — messages get
reworded and translated to Bangla, and code matching on them breaks silently
and invisibly. Never show a raw `ErrorCode` to a customer either; map it to
something a person can act on.

---

## When a change spans both repositories

Two pull requests, linked to each other in their descriptions, merged the same
day — backend first. A frontend expecting a field the API does not send yet is
a broken storefront; an API sending a field nobody reads yet is harmless.

| Backend | Here |
|---|---|
| `GeneralResponse` / `GeneralResponse<T>` | `src/app/_models/generalResponse.ts` |
| `PagedList<T>`, `PaginationParams`, `PaginationHeader` | `src/app/_models/pagination.ts` |
| The `X-Pagination` response header | `src/app/_services/paginationHelper.ts` |
