#!/usr/bin/env node
// Prints the turns of today: the count of tests/support.ts in runs/turns-<date>-<side>.count.
// Setup runs with QA_SETUP=1 are not in it. Fail checks are in it.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QA = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = existsSync(join(QA, "qa.config.json")) ? JSON.parse(readFileSync(join(QA, "qa.config.json"), "utf8")) : {};
const budget = { frontend: 25, backend: 25, ...(config.turns_per_day || {}) };
const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const used = (side) => {
  const f = join(QA, "runs", `turns-${day}-${side}.count`);
  return existsSync(f) ? Math.min(statSync(f).size, budget[side]) : 0;
};
console.log(`Turns today (${day}): frontend ${used("frontend")} of ${budget.frontend}, backend ${used("backend")} of ${budget.backend}.`);
