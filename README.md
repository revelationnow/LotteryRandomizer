# Orrery

A Powerball and Mega Millions number generator that weights its picks using the real
historical draw data from each game — and then shows you, from that same data, that the
weighting cannot possibly help.

Both halves are the point. You get the biased randomizer you asked for, with a bias dial that
runs continuously from cold through fair to hot, and you also get an Observatory that runs a
live chi-square uniformity test and tells you plainly that the hot numbers are noise.

## Why this is not just another "hot numbers" site

Most of them are quietly broken, because **both games have changed their number pools**:

| Game | Matrix | In force |
| --- | --- | --- |
| Powerball | 5/59 + 1/39 | 2009-01-07 → 2012-01-11 |
| Powerball | 5/59 + 1/35 | 2012-01-15 → 2015-10-04 |
| **Powerball** | **5/69 + 1/26** | **2015-10-07 → now** |
| Mega Millions | 5/56 + 1/46 | 2005-06-24 → 2013-10-18 |
| Mega Millions | 5/75 + 1/15 | 2013-10-22 → 2017-10-28 |
| Mega Millions | 5/70 + 1/25 | 2017-10-31 → 2025-04-04 |
| **Mega Millions** | **5/70 + 1/24** | **2025-04-08 → now** |

Counting frequencies over the raw full history mixes in balls that no longer exist and
under-counts balls that did not exist yet. Orrery tags every draw with the matrix in force on
its draw date and only ever weights on the current one:

- **Powerball** uses draws from 2015-10-07 onward for both pools.
- **Mega Millions** uses draws from 2017-10-31 onward for the white balls, since the 1–70 pool
  has been continuous since then. For the Mega Ball it reuses that same span but discards the
  individual draws that landed on ball 25, which was retired in April 2025 — far more data than
  the ~140 draws since the change, and every remaining ball was drawn under identical odds.

The era table lives in [`src/lib/games.ts`](src/lib/games.ts) and is **self-checking**: the
ingest script validates every ball against its era and fails the run on any violation, so a
wrong boundary date breaks the build instead of quietly poisoning the weights.

## The weighting model

One continuous control rather than three separate algorithms. For each ball `b` in a pool of
size `K`, over `N` eligible draws with `m` balls drawn each time:

```
E   = m·N / K              expected count under a fair machine
r_b = (c_b + α) / (E + α)  smoothed deviation ratio, α = E
w_b = r_b ^ β              β is the bias exponent
```

- `β = 0` → every weight is exactly `1`, a genuinely fair draw (the default)
- `β > 0` → favours frequently drawn numbers
- `β < 0` → favours rarely drawn numbers

The slider maps −100…+100 onto `β ∈ [−8, +8]`. The Dirichlet-style prior (`α = E`) is centred
on uniform and worth one full pseudo-history, so a never-drawn ball still gets a sane weight
instead of zero.

Because real lottery data genuinely is uniform, `r_b` sits at about 1 ± 0.1 — the exponent is
what makes the tilt visible at all. That is honest, and the Observatory says so out loud.

### Recency

A second slider controls how far back the evidence counts. Rather than counting every draw
equally, a draw `n` draws old contributes `0.5^(n/h)`, with the slider setting the half-life `h`
(log-scaled, 5000 draws down to 20). Those decayed sums replace `c_b` above — and because the
model is entirely ratio-based, nothing downstream changes.

The two sliders are orthogonal and that is the point: **bias** sets how hard to lean on a number
being hot, **recency** sets how recent the evidence for that has to be. Recency at 0 is exactly
the undecayed behaviour, and at bias 0 recency does nothing at all, since every weight is 1
regardless of the counts. The UI says so rather than leaving a slider that appears inert.

Exponential decay rather than a "last N draws" cutoff: a cutoff discards everything one draw
past the boundary while treating the draw just inside it as fully current, so weights lurch as
new draws arrive. Decay ages evidence out smoothly.

The cost is sample size, and the app reports it. Alongside the slider it shows the Kish effective
sample size `(1+r)/(1−r)` where `r = 0.5^(1/h)` — at the shortest half-life that is about 58
draws, or roughly 4 appearances per number, and a warning appears saying plainly that at that
point the hot/cold gap is essentially all luck.

One consequence worth knowing: **the chi-square verdict is always computed on the full undecayed
history.** Pearson's test assumes actual counts, and on fractional decayed weights the statistic
no longer follows a chi-square distribution. `chiSquare` throws if handed weighted stats, so the
mistake cannot be made quietly.

### Sampling

Sampling five distinct balls by weight uses **Efraimidis–Spirakis** weighted reservoir
sampling: give each ball the key `-ln(u) / w` and take the five smallest. This is exact for
weighted draw-without-replacement and handles exclusions and pinned numbers with no special
cases. Shape constraints (odd/even split, sum range) are applied by rejection on top, and the
app tells you when a combination is impossible rather than silently ignoring it.

Randomness comes from `crypto.getRandomValues`. Supplying a seed switches to `sfc32` so a share
card can encode its seed and reproduce the exact same numbers.

## Data

Official results come from NY Open Data:

- Powerball — [`d6yy-54nr`](https://data.ny.gov/Government-Finance/Lottery-Powerball-Winning-Numbers-Beginning-2010/d6yy-54nr)
- Mega Millions — [`5xaw-6ayf`](https://data.ny.gov/Government-Finance/Lottery-Mega-Millions-Winning-Numbers-Beginning-20/5xaw-6ayf)

`scripts/ingest.ts` fetches both, parses them defensively (Mega Millions is not self-consistent
— newer rows carry the Mega Ball in its own column while older rows pack all six numbers into
`winning_numbers`), validates the eras, and writes a compact snapshot to `public/data/`. A
GitHub Action re-runs it daily and commits only when a new draw has landed.

## Getting started

```bash
npm install
npm run fixture   # synthetic offline data, so the app runs immediately
npm run dev
```

`npm run fixture` generates a deterministic stand-in with the correct shape and eras, for when
`data.ny.gov` is unreachable. It is tagged `source: "fixture"` and the UI shows a prominent
warning badge, so sample data can never be mistaken for real results.

With network access, replace it with the real thing:

```bash
npm run ingest    # optional: set SOCRATA_APP_TOKEN to raise the rate limit
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run ci` | Typecheck, test, build — what the hosts run |
| `npm test` | Unit tests for the statistical core |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run ingest` | Fetch official results into `public/data/` |
| `npm run fixture` | Generate synthetic offline data |
| `npm run standalone` | Single self-contained HTML file, no network requests |
| `npm run verify` | Browser checks and screenshots (needs a running preview) |

## Deploying

### Cloudflare Pages

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick
this repository, and set:

| Setting | Value |
| --- | --- |
| Build command | `npm run ci` |
| Build output directory | `dist` |
| Node version | picked up from `.node-version` (22) |

No environment variables are needed — `base` defaults to `/`, which is what Cloudflare serves
from. Using `npm run ci` rather than `npm run build` means a failing test blocks the deploy.

The two halves fit together on their own: the scheduled refresh workflow commits new draws to
the repository, and that commit triggers a Cloudflare rebuild. No API tokens, and nothing to
keep in sync.

`public/_headers` sets the cache policy. It matters more than it looks — Vite fingerprints the
files in `/assets`, so they are immutable, but `/data/*.json` keeps the same filenames while the
refresh job rewrites them. Without a short max-age there, the edge would keep serving last
week's draws.

### GitHub Pages

Also wired up, via `.github/workflows/deploy.yml`. It needs one manual step first —
**Settings → Pages → Source → "GitHub Actions"** — because the workflow's `GITHUB_TOKEN` can
deploy to an existing Pages site but is not permitted to create one.

A GitHub Pages project site is served from `/<repo>/` rather than the root, so the workflow
sets `BASE_PATH` when building. Both hosts build from the same source.

## Verification

`npm test` covers the parts that would fail silently: era filtering, the Mega Millions
five-versus-six-token parser quirk, `β = 0` producing exactly uniform weights, monotonicity of
the weighting, the sampler matching a reference sequential weighted draw over 120k trials, the
chi-square implementation against known critical points, constraint satisfaction, and seeded
reproducibility.

`npm run verify` drives a real browser at 360, 390, 768 and 1280 px and asserts the two mobile
regressions that actually happen — the page scrolling sideways, and tap targets under 44 px —
plus that the bottom sheet opens, that nothing hides behind the fixed tab bar, and that the
reduced-motion path still renders a complete page.

```bash
npm run build && npm run preview &
npm run verify
```

## Mobile

Designed at 360 px first. Bottom tab bar within thumb reach, luck controls in a swipe-down
bottom sheet, five orbs always on one row via a grid rather than a wrapping flex, `100dvh` so
the collapsing URL bar cannot clip the stage, `env(safe-area-inset-*)` padding around notches,
a starfield whose particle budget scales with viewport area and pauses when the tab is hidden,
DPR capped at 2, and Web Share API integration so sharing opens the native sheet. Installable
to the home screen.

## Accessibility

WCAG AA contrast throughout, a full `prefers-reduced-motion` path that cross-fades and stops
the starfield, `aria-live` announcement of drawn numbers, labelled orbs, colour never used as
the only channel in the heat map, and complete keyboard operation with visible focus rings.

## A word about the odds

Lottery draws are independent and uniformly random. No weighting scheme — including this one —
improves your chances. Orrery exists because picking numbers is fun, and because the statistics
that prove it is all chance are more interesting than pretending otherwise.

Prize amounts shown in the Vault are typical advertised base prizes and vary by jurisdiction.
Play responsibly. If gambling stops being fun, call 1-800-GAMBLER.
