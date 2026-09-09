# Scientific Home Cluster — Web UI

Dashboard for a distributed scientific computing cluster: submit jobs, watch logs stream in,
inspect GPU/CPU metrics and check node health.

## Stack

React 19 + TypeScript, TanStack Start/Router (routing is fixed to TanStack Router in this
project), TanStack Query, Tailwind CSS v4 with semantic design tokens, Recharts, React Hook
Form + Zod, Sonner, date-fns, Lucide icons.

## Run locally

```bash
bun install
bun run dev     # http://localhost:8080
```

On `localhost` the dashboard **skips authorisation entirely** and opens straight to the jobs
view. On any other host, the login screen asks for the shared bearer token, which is stored in
`localStorage` together with the API base URL, poll interval, reconnect delay and theme.

## Mock backend

The FastAPI backend does not exist yet, so `src/lib/mock-server.ts` provides realistic jobs,
nodes, metric history and a simulated log stream. Everything the UI touches goes through the
typed layer in `src/lib/api.ts` — replace the function bodies there with `fetch` calls against
`/api/v1` (plus a real WebSocket for `GET /jobs/{id}/logs`) and the UI keeps working unchanged.

Endpoints mirrored by the mock layer:

| Method | Endpoint | Function |
| --- | --- | --- |
| GET | `/jobs` | `listJobs` |
| POST | `/jobs` | `createJob` |
| GET | `/jobs/:id` | `getJob` |
| WS | `/jobs/:id/logs` | `streamJobLogs` |
| GET | `/jobs/:id/metrics` | `getJobMetrics` |
| POST | `/jobs/:id/retry` | `retryJob` |
| POST | `/jobs/:id/cancel` | `cancelJob` |
| DELETE | `/jobs/:id` | `deleteJob` |
| GET | `/nodes` | `listNodes` |
| GET | `/nodes/:id` | `getNode` |

## Pages

- `/` — jobs list: status/node filters, search, pagination, polling
- `/jobs/new` — submission form with live `job.yaml` preview and validation
- `/jobs/:jobId` — overview, streaming logs (follow, filter, download), metric charts, retry/cancel/delete
- `/nodes` and `/nodes/:nodeId` — cluster health, specs, load history, heartbeat timeline
- `/settings` — API URL, token, poll/reconnect timing, dark mode
- `/login` — bearer token entry (non-local hosts)
