#!/usr/bin/env node
// One QA round: turn budget check, health check, all journeys, then the report.
// Usage, from any folder: node qa/scripts/round.mjs [more Playwright options]
// Exit code: 0 = all journeys pass, 1 = one or more fail, 2 = the test app does not answer, 3 = the turn budget of today is full,
// 4 = no round: a journey file does not compile, or no journey matches the options.
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QA = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(QA);
try {
  process.loadEnvFile(".env");
} catch {}

const pad = (n) => String(n).padStart(2, "0");
const now = new Date();

// The turn budget of today. tests/support.ts counts each turn in runs/turns-<date>-<side>.count.
const config = existsSync("qa.config.json") ? JSON.parse(readFileSync("qa.config.json", "utf8")) : {};
const budget = { frontend: 25, backend: 25, ...(config.turns_per_day || {}) };
const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const used = (side) => {
  const f = join("runs", `turns-${day}-${side}.count`);
  return existsSync(f) ? statSync(f).size : 0;
};
if (process.env.QA_SETUP !== "1" && used("frontend") >= budget.frontend && used("backend") >= budget.backend) {
  console.error(`The turn budget of today is full: frontend ${budget.frontend}, backend ${budget.backend}. No round. The next turns are possible tomorrow.`);
  process.exit(3);
}

// The journeys must compile before a round starts. A round with no journey would only add an empty line to the history.
const cli = join("node_modules", "@playwright", "test", "cli.js");
const list = spawnSync(process.execPath, [cli, "test", "--list", ...process.argv.slice(2)], { encoding: "utf8", env: { ...process.env, QA_RUN_DIR: join("runs", "manual") } });
if (list.status !== 0) {
  const out = `${list.stdout}\n${list.stderr}`.trim().split("\n");
  console.error(out.slice(-20).join("\n"));
  console.error(/No tests found/i.test(out.join("\n")) ? "\nNo round: no journey matches the options." : "\nNo round: a journey file does not compile. Fix it, then start the round again.");
  process.exit(4);
}
let stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
if (existsSync(join("runs", stamp))) stamp += pad(now.getSeconds());
const runDir = join("runs", stamp);
mkdirSync(runDir, { recursive: true });

function appVersion() {
  if (process.env.QA_APP_VERSION) return process.env.QA_APP_VERSION;
  const dir = process.env.QA_APP_DIR;
  if (!dir) return "unknown";
  try {
    const app = resolve(QA, dir);
    const git = (...a) => execFileSync("git", ["-C", app, ...a], { encoding: "utf8" }).trim();
    // Changes inside the QA folder do not count as changes of the app.
    const inside = relative(app, QA);
    const skip = inside && !inside.startsWith("..") && !isAbsolute(inside) ? [`:(exclude)${inside}`] : [];
    return git("rev-parse", "--short", "HEAD") + (git("status", "--porcelain", "--", ".", ...skip) ? " (with changes that are not committed)" : "");
  } catch {
    return "unknown";
  }
}

const meta = { started: now.toISOString(), version: appVersion(), base_url: process.env.QA_BASE_URL || null, args: process.argv.slice(2) };
const saveMeta = () => writeFileSync(join(runDir, "meta.json"), JSON.stringify(meta, null, 2));
saveMeta();

const summarize = () => spawnSync(process.execPath, [join("scripts", "summarize.mjs"), runDir], { stdio: "inherit" }).status;

// Health check: 2 tries. The round stops when the test app does not answer.
const health = process.env.QA_HEALTH_URL || process.env.QA_BASE_URL;
if (!health) {
  console.error("Set QA_BASE_URL in qa/.env first.");
  process.exit(2);
}
let up = false;
for (let attempt = 1; attempt <= 2 && !up; attempt++) {
  try {
    const res = await fetch(health, { signal: AbortSignal.timeout(10_000) });
    up = res.status < 500;
    if (!up) meta.health = `HTTP ${res.status}`;
  } catch (e) {
    meta.health = String(e.cause?.code || e.message);
  }
  if (!up && attempt === 1) await new Promise((r) => setTimeout(r, 5_000));
}
if (!up) {
  meta.environment_down = `${health} did not answer after 2 tries: ${meta.health}`;
  meta.finished = new Date().toISOString();
  saveMeta();
  summarize();
  process.exit(2);
}

const run = spawnSync(process.execPath, [cli, "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, QA_RUN_DIR: runDir },
});
meta.finished = new Date().toISOString();
meta.playwright_exit = run.status;
saveMeta();
const sum = summarize();
process.exit(sum !== 0 ? 2 : run.status === 0 ? 0 : 1);
