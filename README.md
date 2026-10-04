# Scientific Home Cluster — Web UI

Dashboard for a distributed scientific computing cluster: submit jobs, watch logs stream in,
inspect GPU/CPU metrics and check node health.

## Stack

React 19 + TypeScript, TanStack Start/Router (routing is fixed to TanStack Router in this
project), TanStack Query, Tailwind CSS v4 with semantic design tokens, Recharts, React Hook
Form + Zod, Sonner, date-fns, Lucide icons.

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173
```

The dev server listens on **5173**, which is what `playwright.config.ts` targets and what the
backend's CORS allow-list accepts (`backend/core/config.py`). The port comes from the shared
`@lovable.dev/vite-tanstack-config` package, not from this repository.

On `localhost` the dashboard **skips authorisation entirely** and opens straight to the jobs
view. On any other host, the login screen asks for the shared bearer token, which is stored in
`localStorage` together with the API base URL, poll interval, reconnect delay and theme.

## Backend mode: `VITE_CLUSTER_BACKEND`

`src/services/index.ts` owns the choice between the two `ClusterService` implementations, and
that is the **only** place it is made:

| `VITE_CLUSTER_BACKEND` | Implementation | Health probe |
| --- | --- | --- |
| exactly `mock` | `src/services/mock.ts` — in-memory demo data | none, ever |
| anything else, including unset | `src/services/http.ts` — the real FastAPI backend | none, does not exist |

The match on `mock` is exact and case-sensitive. `Mock`, `mockk`, `auto`, `1`, `true`, `""` and
an absent variable all resolve to `httpService`, so the failure mode of a typo is *"talks to the
real backend and reports a connection error"*, never *"silently shows fabricated jobs"*. There is
no backend-reachability probe, and no `localStorage` override — "the backend is down" is a
transient network condition, not a request to fabricate data.

Which file decides it:

| File | Mode value | Applies to |
| --- | --- | --- |
| `.env.development` | `http` | `npm run dev` |
| `.env.production` | `http` | `npm run build` |
| `.env.test` | `mock` | `npm test` (vitest's `test` mode) |
| `.env.development.local` | *gitignored* | your own override |

All three committed files are in version control precisely so that this rule is reviewable. They
contain no secrets — a mode string and a base URL. `.env.test` is the only one that opts into
the mock.

The second variable in those files, `VITE_API_URL`, is the build-time default for
`defaultSettings.apiBaseUrl` in `src/lib/settings.ts` (falling back to
`http://localhost:8000/api/v1` when unset). `localStorage["shc.settings"]` still overrides it, so
the login screen and the settings page can retarget a deployed build without a rebuild — that is
why all three committed files leave it at localhost, which is what `npm run preview` expects.

### Running with no backend

To build, demo or develop the whole UI with nothing listening on `:8000`, create
`.env.development.local` (gitignored, so it is yours alone):

```bash
echo 'VITE_CLUSTER_BACKEND=mock' > .env.development.local
npm run dev
```

or, without touching any file, run the dev server in the `test` mode that `.env.test` configures:

```bash
npx vite --mode test
```

What you get, and what you do not:

- Jobs, nodes, metrics and the log stream all come from `src/lib/mock-server.ts` (in-memory,
  resets on reload) and nothing touches the network.
- A stopped backend is **not** silently replaced by demo data. Without the mock mode you get a
  *"Cannot reach the cluster backend"* connection error, because a rejected `fetch` is normalised
  to `ServiceError` with `status === 0` and `error_code === "BACKEND_UNREACHABLE"`.

## Service layer

Everything the UI does against a backend goes through `src/services/`:

| File | Role |
| --- | --- |
| `index.ts` | the resolver and the wrapper functions (`listJobs`, `createJob`, …) app code imports |
| `types.ts` | the single `ClusterService` contract both implementations satisfy, plus `ServiceError` |
| `mock.ts` | the in-memory implementation, backed by `src/lib/mock-server.ts` |
| `http.ts` | `fetch`/WebSocket implementation against `/api/v1` |
| `testing.ts` | **test-only** re-export of `mockService` / `httpService` |

`mockService` and `httpService` are deliberately *not* re-exported from `index.ts`, so app code
cannot pick an implementation and bypass the resolver. `testing.ts` exists because tests need both
to assert interface parity; an ESLint `no-restricted-imports` rule rejects
`@/services/mock`, `@/services/http` and `@/services/testing` everywhere except under `tests/`
and `*.test.ts`.

`src/lib/api.ts` is a deprecated 5-line shim (`export * from "@/services"`) kept for older
imports. New code imports from `@/services`.

Endpoints mirrored by the mock layer:

| Method | Endpoint            | Function        |
| ------ | ------------------- | --------------- |
| GET    | `/jobs`             | `listJobs`      |
| POST   | `/jobs`             | `createJob`     |
| GET    | `/jobs/:id`         | `getJob`        |
| WS     | `/jobs/:id/logs`    | `streamJobLogs` |
| GET    | `/jobs/:id/metrics` | `getJobMetrics` |
| POST   | `/jobs/:id/retry`   | `retryJob`      |
| POST   | `/jobs/:id/cancel`  | `cancelJob`     |
| DELETE | `/jobs/:id`         | `deleteJob`     |
| GET    | `/nodes`            | `listNodes`     |
| GET    | `/nodes/:id`        | `getNode`       |

## Testing

There are two separate test suites with different runners, different scopes and different
requirements. They are never mixed.

| | Unit + integration (vitest) | End-to-end (Playwright) |
| --- | --- | --- |
| Command | `npm test` | `npm run test:e2e` |
| Watch mode | `npm run test:watch` | `npm run test:e2e:ui`, `npm run test:e2e:headed` |
| Runner config | `vitest.config.ts` | `playwright.config.ts` |
| File locations | `src/**/*.test.ts`, `tests/integration/**/*.test.ts` | `tests/e2e/**/*.spec.ts` |
| Needs a backend | No | Yes — a live backend and dev server |
| Browser required | No (jsdom) | Yes (Chromium) |
| Type-checked by `npm run typecheck` | Yes | **No** — see [Type checking](#type-checking) |

`npm test` runs the vitest unit and integration suites in jsdom. It needs neither a running
backend nor a dev server: `.env.test` selects the mock, deliberately. `npm run test:e2e` runs the
Playwright suite in a real browser and needs both a live backend and a dev server.

The two suites cannot collide: vitest collects the `.test.ts` extension under `src/` and
`tests/integration/` only and explicitly excludes `tests/e2e/**`, while Playwright only owns
`tests/e2e/` via its `testDir`.

### Type checking

```bash
npm run typecheck          # the gate: runs `tsc --noEmit -p tsconfig.json`
npm run typecheck:e2e      # advisory report on tests/e2e/** — prints its 8 known errors, exits 0
```

`npm run typecheck` runs `tsc --noEmit` over `tsconfig.json` and compares the result against a
committed inventory, `scripts/typecheck-baseline.json`. Read `scripts/typecheck.mjs` for how the
comparison works; the short version is that the gate is red if there is any type error outside the
baseline, **and** red if a baselined error stops being reported.

The baseline holds **1 known production error in `src/`**, and that one is a real bug rather than
type debt:

| Entry | What it is |
| --- | --- |
| `TS2322` at `src/routes/jobs.$jobId.tsx:84` | `src/services/index.ts` declares its `streamJobLogs` wrapper `async`, so it returns `Promise<Unsubscribe>`, while `ClusterService.streamJobLogs` is synchronous. The page stores it in a `(() => void) \| undefined` and calls it from the effect cleanup, so navigating away invokes a Promise and leaks the log WebSocket. |

It is deliberately **not** fixed here: it is a behaviour change that needs its own review, and this
issue declined it. `scripts/typecheck-baseline.json`'s `$comment` records the same provenance. It is
tracked in issue #45 — fix that one and the baseline is empty.

**The other 15 entries this file used to hold were one missing line, not 15 small debts.**
`src/services/types.ts` imported five types from `@/lib/types` and re-exported none of them, so the
`export type { … } from "@/lib/types"` line that `src/services/index.ts` imports by name did not
exist. That produced the 5 × `TS2459` at the import site, and — because those five types resolved to
`any` inside `ClusterService` — it erased the type of every service return value, which is what the
10 × `TS7006` implicit-`any` callback parameters in the route components were. **No route component
needed a change**; adding the one re-export removed all fifteen at once. So do not go looking for
implicit-`any` fixes in `src/routes/*.tsx`: a `TS7006` there means something further down is
resolving to `any`, and the place to look is the type it cannot see.

Fixing a baselined error means shrinking the baseline in the same commit, and `npm run typecheck`
stays red until you do. Shrink it from `tsc`'s own output, never by hand — see *Regenerating the
baseline* in `scripts/typecheck.mjs`.

Test files and config files are **never** baselined. `src/**/*.test.ts` and
`tests/integration/**/*.test.ts` are genuinely type-clean, so a new type error in a test fails the
gate outright with the baseline out of the picture.

The gate also asserts the **file set**, not just the errors — a comparison of diagnostics alone
cannot tell "no errors" from "no longer any files to report errors in". `tsc --listFiles` is checked
against named anchor files in `scripts/typecheck.mjs` (`REQUIRED_FILES`), plus a sweep of every
`*.test.ts` on disk under `src/`, `tests/integration/` and `tests/`. So dropping the
`tests/integration/**` entries from `tsconfig.json`'s `include` fails loudly, naming the file,
instead of quietly leaving `tests/integration/services.test.ts` unchecked again. The `tests/` root
is swept past what vitest collects on purpose: a test file there is run by *nothing*, so it is
named as such — your test never runs — rather than as a `vitest.config.ts` problem. It is keyed on
names, not counts: adding a test file is an ordinary change and leaves the gate green.

What `npm run typecheck` covers, and what it does not:

| | Covered by `npm run typecheck` |
| --- | --- |
| `src/**` production code | Yes, against the 1-entry baseline |
| `src/**/*.test.ts` (6 vitest files) | Yes, no baseline |
| `tests/integration/services.test.ts` | Yes, no baseline |
| `vitest.config.ts`, `vite.config.ts` | Yes, no baseline |
| **`tests/e2e/**` (7 Playwright files)** | **No** |
| `playwright.config.ts`, `eslint.config.js` | No |

**"Typecheck passes" does not mean "everything is checked".** `tests/e2e/**` is a separate
TypeScript program (`tsconfig.e2e.json`) because Playwright runs in Node against a live backend,
not in the jsdom environment the rest of the suite uses. It carries **8 known errors**
(7 × `TS2345` in `job-lifecycle.spec.ts`, 1 × `TS7006` in `node-monitoring.spec.ts`) and is
deliberately *not* part of `npm run typecheck`. Those 8 are known debt, not an accident — but they
are not fixed here, so the gap is recorded in `tsconfig.e2e.json` and nowhere else.

`npm run typecheck:e2e` is how the gap is measured. It runs the same `tsc --noEmit -p
tsconfig.e2e.json`, prints all 8 with their `file:line`, and **exits 0**: it is an advisory report,
not a gate. It used to exit non-zero, permanently, and that was a trap rather than a signal — the
next person to wire an npm script into CI by muscle memory inherits a red pipeline they did not
cause, and people route *around* red long before they route around missing, which hides the 8 from
everyone instead of reminding one person. So the diagnostics are unchanged and only the verdict is
gone: the count stays reproducible and shrinkable, and `npm run typecheck` stays the gate.

**That exit code does not move the boundary.** `npm run typecheck` still does not check
`tests/e2e/**`, so "the typecheck passes" still does not mean "everything is checked" — that
warning is the substantive point of this section and is unaffected by `typecheck:e2e` exiting 0. When
CI lands it must call the suites as separate jobs — `npm run typecheck` and `npm run test:e2e` — for
exactly this reason.

`npm run build` is deliberately **not** type-gated: it stays `vite build`, which strips types
without checking them. Run `npm run typecheck` separately.

## Pages

- `/` — jobs list: status/node filters, search, pagination, polling
- `/jobs/new` — submission form with live `job.yaml` preview and validation
- `/jobs/:jobId` — overview, streaming logs (follow, filter, download), metric charts, retry/cancel/delete
- `/profiles`, `/profiles/new`, `/profiles/:profileId` — software run profiles (VASP, LAMMPS,
  RMCProfile, GROMACS, Quantum ESPRESSO, CP2K, PyTorch); built-ins are editable and stored in
  `localStorage`, and any profile can pre-fill the submission form via `/jobs/new?profile=<id>`
- `/nodes` and `/nodes/:nodeId` — cluster health, specs, load history, heartbeat timeline
- `/settings` — API URL, token, poll/reconnect timing, dark mode
- `/login` — bearer token entry (non-local hosts)
