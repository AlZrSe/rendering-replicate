import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Issue #136: CI runs this suite against the docker-compose stack, which serves
// the API and the prerendered SPA on ONE origin (:8000). The dev servers below
// would be wrong twice over in that arrangement - the first one fights the real
// API for :8000, and the second answers a port the tests never navigate to.
//
// So the stack is selected with an environment variable rather than a second
// config file. Set PLAYWRIGHT_BASE_URL to the origin under test and two things
// change: the `baseURL` the specs navigate against, and the `webServer` block,
// which becomes `undefined` so Playwright starts nothing at all.
//
// UNSET - every local `npm run test:e2e`, and the Lovable preview - is
// bit-identical to what this file did before, because the default below is the
// literal that used to be hardcoded here and `webServer` is still defined
// exactly when it was. Nothing sets this variable except the one CI job that
// means to.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: externalBaseURL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Expect servers to be running locally; do not auto-start in local dev
  // CI will configure webServer with commands - unless the origin under test is
  // external (PLAYWRIGHT_BASE_URL, above), in which case there is nothing for
  // this block to start and it must stay `undefined`.
  webServer:
    process.env.CI && !externalBaseURL
      ? [
          {
            command: "uvicorn backend.main:app --host 0.0.0.0 --port 8000",
            url: "http://localhost:8000/api/v1/health",
            reuseExistingServer: true,
            timeout: 120000,
            cwd: path.resolve(__dirname, ".."),
            env: {
              SHARED_TOKEN: "test-shared-token-123",
              DATABASE_URL: "sqlite+aiosqlite:///./test.db",
              SYNCTHING_ROOT: "/tmp/syncthing-test",
            },
          },
          {
            command: "npm run dev",
            url: "http://localhost:5173",
            reuseExistingServer: true,
            timeout: 120000,
            cwd: path.resolve(__dirname),
            // No VITE_* here on purpose: `npm run dev` is mode `development`, so
            // the mode and the API base URL come from the committed
            // .env.development. A fourth place that decides which ClusterService
            // runs would be exactly the drift this file had.
          },
        ]
      : undefined,
  // Global timeout for the entire test run (30 minutes)
  globalTimeout: 1800000,
  // Per-test timeout (60 seconds)
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  // Test-level logging hooks
  testConfig: {
    beforeAll: async () => {
      console.log("[Playwright] Test suite starting");
    },
    afterAll: async () => {
      console.log("[Playwright] Test suite completed");
    },
  },
});