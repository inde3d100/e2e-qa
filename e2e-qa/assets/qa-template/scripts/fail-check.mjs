#!/usr/bin/env node
// Checks that one test can fail. It changes one text in the test, runs only that test, and then puts the file back.
// The turns of the test count in the turn budget of today. With QA_SETUP=1 they do not count.
// Usage: node scripts/fail-check.mjs <spec file> <test ID> "<old text>" "<new text>"
// Example: node scripts/fail-check.mjs tests/backend/orders.spec.ts B07 "toBe(201)" "toBe(299)"
// Result: OK (exit 0) when the changed test fails. PROBLEM (exit 1) when it still passes. UNCLEAR (exit 2) for other results.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QA = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(QA);
try {
  process.loadEnvFile(".env");
} catch {}

const [file, id, oldText, newText] = process.argv.slice(2);
if (!file || !id || oldText === undefined || newText === undefined) {
  console.error('Usage: node scripts/fail-check.mjs <spec file> <test ID> "<old text>" "<new text>"');
  process.exit(2);
}
const stop = (msg) => {
  console.error(`UNCLEAR: ${msg}`);
  process.exit(2);
};
const original = readFileSync(file, "utf8");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The test block: from its title to the next test in the file.
const start = original.search(new RegExp(`["'\`]${esc(id)}\\b`));
if (start < 0) stop(`no test title starts with ${id} in ${file}. A test made in a loop needs a manual check.`);
const next = original.slice(start).search(/\n\s*test(\.\w+)?\(/);
const end = next < 0 ? original.length : start + next;
const block = original.slice(start, end);
const at = block.indexOf(oldText);
if (at < 0) stop(`"${oldText}" is not in test ${id}.`);
const changed = original.slice(0, start) + block.slice(0, at) + newText + block.slice(at + oldText.length) + original.slice(end);

const restore = () => writeFileSync(file, original);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
let out = "";
try {
  writeFileSync(file, changed);
  const cli = join("node_modules", "@playwright", "test", "cli.js");
  const run = spawnSync(process.execPath, [cli, "test", file, "--grep", `${esc(id)}\\b`, "--retries", "0", "--reporter", "line"], {
    encoding: "utf8",
    env: { ...process.env, QA_RUN_DIR: join("runs", "manual") },
  });
  out = `${run.stdout}\n${run.stderr}`;
} finally {
  restore();
}
if (readFileSync(file, "utf8") !== original) stop(`${file} is not the same as before. Check it by hand.`);

if (/Turn budget used/.test(out)) stop("the turn budget of today is full, so the test did not run. The file is back as it was.");
if (/\b1 failed\b/.test(out) && !/\b[1-9]\d* passed\b/.test(out)) {
  console.log(`OK: ${id} fails when "${oldText}" becomes "${newText}". The file is back as it was.`);
  process.exit(0);
}
if (/\b1 passed\b/.test(out) && !/\bfailed\b/.test(out)) {
  console.log(`PROBLEM: ${id} still passes when "${oldText}" becomes "${newText}". The test does not check this. The file is back as it was.`);
  process.exit(1);
}
console.log(out.trim().split("\n").slice(-15).join("\n"));
stop(`the run did not give exactly one result for ${id}. Read the output above. The file is back as it was.`);
