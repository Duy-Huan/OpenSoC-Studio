import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".cache/playwright");
export default defineConfig({
  testDir: "./tests/browser-e2e",
  timeout: 60000,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/test-evidence/M1/browser-tests.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:8000",
    viewport: { width: 1600, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node infra/scripts/python.mjs -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000",
    url: "http://127.0.0.1:8000/api/v1/health",
    reuseExistingServer: true,
    env: { OPENSOC_DATA_ROOT: resolve(".cache/e2e-data") },
    timeout: 30000,
  },
});
