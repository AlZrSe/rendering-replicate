/**
 * Test-only access to the concrete ClusterService implementations.
 *
 * `./index.ts` deliberately does not re-export `mockService` / `httpService`:
 * app code must go through the wrappers there, so that the module-scope
 * `VITE_CLUSTER_BACKEND` check stays the only place that decides which
 * implementation runs. Tests need both implementations directly — to assert
 * interface parity between them, and to exercise `httpService` with a stubbed
 * `fetch` — so they come from here instead.
 *
 * Only test files may import this module; the `no-restricted-imports` rule in
 * `eslint.config.js` rejects it (and `./mock` / `./http`) everywhere else.
 *
 * @internal
 */
export { mockService } from "./mock";
export { httpService } from "./http";
