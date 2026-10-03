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

`npm test` runs the vitest unit and integration suites in jsdom. It needs neither a running
backend nor a dev server: `.env.test` selects the mock, deliberately. `npm run test:e2e` runs the
Playwright suite in a real browser and needs both a live backend and a dev server.

The two suites cannot collide: vitest collects the `.test.ts` extension under `src/` and
`tests/integration/` only and explicitly excludes `tests/e2e/**`, while Playwright only owns
`tests/e2e/` via its `testDir`.

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
