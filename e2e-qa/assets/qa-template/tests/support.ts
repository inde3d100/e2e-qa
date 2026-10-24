// Shared parts of the QA tests: the turn helper, the cleanup fixture and expect.
// A turn is one action that changes data or a setting in the app, or that costs money.
// Examples: send a message, create a file, a person or a project, edit, delete, upload, switch a setting.
// A refused try counts too. Opening a page, reading, searching, login, logout, checks and cleanup are not turns.
import { test as base, expect } from "@playwright/test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export { expect };

// A test adds the address of each record that it makes: cleanup.push(`/api/orders/${id}`).
// After the test, the fixture deletes them. A failed delete goes into cleanup-failed.txt of the round.
export const test = base.extend<{ cleanup: string[] }>({
  cleanup: async ({ playwright }, use) => {
    const paths: string[] = [];
    await use(paths);
    if (!paths.length) return;
    const api = await playwright.request.newContext({ baseURL: process.env.QA_API_URL || process.env.QA_BASE_URL });
    // If a delete needs a login, log in here. The login is not a turn. For example:
    // await api.post("/api/login", { data: { password: process.env.QA_PASSWORD } });
    for (const p of paths) {
      const res = await api.delete(p).catch((e) => ({ status: () => String(e.message || e) }));
      const status = res.status();
      // 404: the journey or the app deleted the record already.
      if (typeof status !== "number" || (status >= 400 && status !== 404)) {
        const dir = join(qaDir(), process.env.QA_RUN_DIR || "runs/manual");
        mkdirSync(dir, { recursive: true });
        appendFileSync(join(dir, "cleanup-failed.txt"), `${p} ${status}\n`);
      }
    }
    await api.dispose();
  },
});

const SIDE = { ui: "frontend", api: "backend" } as const;

function qaDir() {
  return dirname(test.info().config.configFile || join(process.cwd(), "playwright.config.ts"));
}

export function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Each turn adds one byte to runs/turns-<date>-<side>.count. An append is atomic, so parallel workers count right.
function takeTurn(side: keyof typeof SIDE) {
  if (process.env.QA_SETUP === "1") return; // Job 1 only: runs while the agent fixes test bugs.
  const qa = qaDir();
  const configFile = join(qa, "qa.config.json");
  const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, "utf8")) : {};
  const budget = config.turns_per_day?.[SIDE[side]] ?? 25;
  mkdirSync(join(qa, "runs"), { recursive: true });
  const file = join(qa, "runs", `turns-${today()}-${SIDE[side]}.count`);
  appendFileSync(file, "x");
  if (statSync(file).size > budget) {
    throw new Error(`Turn budget used: ${budget} ${SIDE[side]} turns today. This turn did not run.`);
  }
}

// One turn: "ui" for an action in the page, "api" for an action through the API.
// The body does the action and then checks its result.
export async function turn<T>(side: keyof typeof SIDE, what: string, body: () => Promise<T>): Promise<T> {
  return test.step(`turn ${side}: ${what}`, async () => {
    takeTurn(side);
    return body();
  });
}
