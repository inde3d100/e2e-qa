import { defineConfig, devices } from "@playwright/test";

// qa/.env holds the test address and the test logins. Never commit it.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch {}

// scripts/round.mjs sets QA_RUN_DIR. A direct "npx playwright test" writes to runs/manual.
const runDir = process.env.QA_RUN_DIR || "runs/manual";

export default defineConfig({
  outputDir: `${runDir}/artifacts`,
  // No retry: a retry repeats the turns of a journey. The QA agent re-runs a failed journey one time by hand.
  retries: 0,
  workers: Number(process.env.QA_WORKERS || 2),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: `${runDir}/results.json` }]],
  use: {
    baseURL: process.env.QA_BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    // Only these two projects count in the report. The turn() helper counts the turns.
    { name: "frontend", testDir: "tests/frontend", use: { ...devices["Desktop Chrome"] } },
    { name: "backend", testDir: "tests/backend", use: { baseURL: process.env.QA_API_URL || process.env.QA_BASE_URL } },
  ],
});
