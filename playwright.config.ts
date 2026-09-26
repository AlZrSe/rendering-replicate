import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
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
  // CI will configure webServer with commands
  webServer: process.env.CI
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
          env: {
            VITE_CLUSTER_BACKEND: "http",
            VITE_API_URL: "http://localhost:8000/api/v1",
          },
        },
      ]
    : undefined,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
