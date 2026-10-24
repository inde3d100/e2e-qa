#!/usr/bin/env node
// Turns one Playwright round into report.md and summary.json, and updates the memory files:
// runs/history.jsonl (one line for each round), turn-log.jsonl (one line for each turn) and COVERAGE.md.
// Usage: node scripts/summarize.mjs runs/<stamp>   (scripts/round.mjs calls it)
// It compares the journeys with the last full round: new fails, fails that continue, and fixed journeys.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QA = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runDir = resolve(QA, process.argv[2] || "");
const stamp = basename(runDir);
const day = stamp.slice(0, 10);
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const rel = (p) => (p ? relative(QA, p) : p);
const noColor = (s) => String(s || "").replace(/\u001b\[[0-9;]*m/g, "");
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const n = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const shortError = (e) => noColor(e).split(/\n\s*Call log:/)[0].split("\n").slice(0, 8).join("\n").trim();

const config = readJson(join(QA, "qa.config.json"), {});
const budget = { frontend: 25, backend: 25, ...(config.turns_per_day || {}) };
const meta = readJson(join(runDir, "meta.json"), {});
const report = readJson(join(runDir, "results.json"), null);
const partial = (meta.args || []).length > 0;
// A second run on the same round folder rewrites the report, but does not add to the memory files again.
const firstSummary = !existsSync(join(runDir, "summary.json"));

// The last earlier full round: all journeys ran, and the test app answered.
const STAMP = /^\d{4}-\d{2}-\d{2}-\d{4}/;
const earlier = existsSync(join(QA, "runs")) ? readdirSync(join(QA, "runs")).filter((d) => STAMP.test(d) && d < stamp).sort() : [];
let prevStamp = null;
let prev = null;
for (const d of earlier.reverse()) {
  const s = readJson(join(QA, "runs", d, "summary.json"), null);
  if (s && !s.environment_down && !s.partial && s.tests?.length) {
    prevStamp = d;
    prev = s;
    break;
  }
}
const prevByKey = new Map((prev?.tests || []).map((t) => [t.key, t]));

// Collect each journey (one Playwright test) and its turns from the nested suites and steps.
const TURN = /^turn (ui|api): ([\s\S]*)$/;
const BUDGET = /Turn budget used/;
const TEST_ID = /^([A-Z]{1,3}\d{1,4})\b/;
const SIDE_OF = { ui: "frontend", api: "backend" };
const SIDES = ["frontend", "backend"];

function turnsOf(steps, out) {
  for (const s of steps || []) {
    const m = TURN.exec(s.title || "");
    if (!m) {
      turnsOf(s.steps, out);
      continue;
    }
    const err = s.error ? noColor(s.error.message || "") : "";
    out.push({ side: SIDE_OF[m[1]], text: m[2].trim(), result: !err ? "pass" : BUDGET.test(err) ? "not run" : "fail", error: err ? shortError(err) : "" });
  }
  return out;
}

const tests = [];
function walk(suite, path) {
  const here = suite.title && !/\.(spec|test)\.[cm]?[jt]sx?$/.test(suite.title) ? [...path, suite.title] : path;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const last = t.results?.at(-1) || {};
      const failed = (t.results || []).find((r) => r.status !== "passed" && r.status !== "skipped") || last;
      const shown = t.status === "flaky" ? failed : last;
      const attach = (name) => rel((shown.attachments || []).find((a) => a.name === name && a.path)?.path);
      const err = noColor(failed.error?.message || failed.errors?.[0]?.message || "");
      let status = { expected: "pass", unexpected: "fail", flaky: "flaky", skipped: "skipped" }[t.status] || t.status;
      if (status === "fail" && BUDGET.test(err)) status = "not run";
      const title = [...here, spec.title].join(" > ");
      const id = TEST_ID.exec(spec.title)?.[1];
      const turns = turnsOf(last.steps, []);
      tests.push({
        key: id ? `${t.projectName} > ${id}` : `${t.projectName} > ${spec.file} > ${title}`,
        side: t.projectName,
        id: id || title,
        title,
        area: basename(spec.file).replace(/\.(spec|test)\.[cm]?[jt]sx?$/, ""),
        file: `${spec.file}:${spec.line}`,
        tags: (spec.tags || []).map((g) => g.replace(/^@/, "")),
        status,
        error: status === "fail" || status === "flaky" ? shortError(err) : "",
        outside: status === "fail" && !turns.some((x) => x.result === "fail"),
        steps: status === "fail" ? (last.steps || []).map((s) => s.title + (s.error ? " (failed here)" : "")) : [],
        screenshot: status === "fail" || status === "flaky" ? attach("screenshot") : undefined,
        trace: status === "fail" || status === "flaky" ? attach("trace") : undefined,
        duration_ms: (t.results || []).reduce((a, r) => a + (r.duration || 0), 0),
        turns,
      });
    }
  }
  for (const child of suite.suites || []) walk(child, here);
}
for (const s of report?.suites || []) walk(s, []);

// Compare the journeys with the last full round.
for (const t of tests) {
  const before = prevByKey.get(t.key);
  if (t.status === "fail") {
    t.change = before?.status === "fail" ? "fails again" : before ? "new fail" : "new journey, fails";
    t.first_failed = before?.status === "fail" ? before.first_failed || prevStamp : stamp;
  }
}
const nowKeys = new Set(tests.map((t) => t.key));
const passedAgain = (prev?.tests || []).filter((p) => p.status === "fail" && tests.find((t) => t.key === p.key && t.status === "pass"));
const sameVersion = prev && prev.version === (meta.version || "unknown");
const removed = partial ? [] : (prev?.tests || []).filter((p) => !nowKeys.has(p.key));
const added = tests.filter((t) => prev && !prevByKey.has(t.key));

const counted = tests.filter((t) => SIDES.includes(t.side));
const other = tests.filter((t) => !SIDES.includes(t.side));
const count = (list, s) => list.filter((t) => t.status === s).length;
const allTurns = counted.flatMap((t) => t.turns.map((x, i) => ({ ...x, n: i + 1, journey: t })));
const turnCount = Object.fromEntries(
  SIDES.map((s) => {
    const list = allTurns.filter((x) => x.side === s);
    return [s, { pass: list.filter((x) => x.result === "pass").length, fail: list.filter((x) => x.result === "fail").length, not_run: list.filter((x) => x.result === "not run").length }];
  }),
);
const usedToday = Object.fromEntries(
  SIDES.map((s) => {
    const f = join(QA, "runs", `turns-${day}-${s}.count`);
    return [s, existsSync(f) ? Math.min(statSync(f).size, budget[s]) : 0];
  }),
);
const notRun = turnCount.frontend.not_run + turnCount.backend.not_run;
const totals = { pass: count(counted, "pass"), fail: count(counted, "fail"), flaky: count(counted, "flaky"), skipped: count(counted, "skipped"), not_run: count(counted, "not run") };
const seconds = meta.started && meta.finished ? Math.round((new Date(meta.finished) - new Date(meta.started)) / 1000) : null;

const summary = { stamp, version: meta.version || "unknown", base_url: meta.base_url || null, environment_down: meta.environment_down || null, partial, totals, turns: turnCount, used_today: usedToday, previous: prevStamp, tests: [...counted, ...other] };
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));

// report.md
const L = [];
const done = (s) => turnCount[s].pass + turnCount[s].fail;
L.push(`# QA round ${stamp}`, "");
L.push(`- App version: ${summary.version}`);
L.push(`- Test address: ${summary.base_url || "not set"}`);
if (meta.environment_down) {
  L.push(`- Result: the round stopped. ${meta.environment_down}. No turn ran.`);
} else if (!report) {
  L.push("- Result: Playwright wrote no results. Read the console output of the round.");
} else {
  L.push(`- Turns in this round: frontend ${done("frontend")} (${turnCount.frontend.pass} pass, ${turnCount.frontend.fail} fail), backend ${done("backend")} (${turnCount.backend.pass} pass, ${turnCount.backend.fail} fail).`);
  L.push(`- Turns today at the end of this round: frontend ${usedToday.frontend} of ${budget.frontend}, backend ${usedToday.backend} of ${budget.backend}.`);
  if (notRun) L.push(`- ${n(notRun, "turn")} did not run, because the turn budget of today was full.`);
  const outside = counted.filter((t) => t.outside).length;
  L.push(`- Journeys: ${counted.length} (${totals.pass} pass, ${totals.fail} fail${totals.flaky ? `, ${totals.flaky} flaky` : ""}${totals.skipped ? `, ${totals.skipped} skipped` : ""}${totals.not_run ? `, ${totals.not_run} not run` : ""}).${outside ? ` ${outside} of the failed journeys failed outside a turn, so ${outside === 1 ? "it has" : "they have"} no failed turn.` : ""}`);
  const newFails = counted.filter((t) => t.change && t.change !== "fails again").length;
  const again = counted.filter((t) => t.change === "fails again").length;
  L.push(prev ? `- Compared with round ${prevStamp}: ${n(newFails, "new fail")}, ${again} that fail again, ${passedAgain.length} that pass now, ${n(added.length, "new journey")}, ${n(removed.length, "removed journey")}.` : "- There is no earlier full round to compare with.");
  if (partial) L.push(`- Partial round (options: ${meta.args.join(" ")}). The next round does not compare with it.`);
}
if (seconds !== null) L.push(`- Duration: ${Math.floor(seconds / 60)} min ${seconds % 60} s.`);
if (report?.errors?.length) {
  L.push("", "## Errors outside the journeys", "", "Playwright stopped on these errors. Often a test file does not compile.", "");
  for (const e of report.errors) L.push("```", noColor(e.message).split("\n").slice(0, 12).join("\n"), "```");
}

if (report) {
  L.push("", "## Turns by tag", "");
  for (const s of SIDES) {
    const tagCount = {};
    for (const x of allTurns.filter((y) => y.side === s && y.result !== "not run")) {
      const main = ["core", "change", "edge"].find((g) => x.journey.tags.includes(g)) || "no tag";
      tagCount[main] = (tagCount[main] || 0) + 1;
    }
    const mix = Object.entries(tagCount).map(([g, c]) => `${g} ${c}`).join(", ") || "none";
    const bugs = counted.filter((t) => t.tags.includes("bug") && t.turns.some((x) => x.side === s)).length;
    const coreMax = config.core_turns_max?.[s];
    const coreWarn = coreMax !== undefined && (tagCount.core || 0) > coreMax ? ` WARNING: the core journeys use more than ${coreMax} turns.` : "";
    L.push(`- ${s}: ${done(s)} turns (${mix})${bugs ? `. ${bugs} ${bugs === 1 ? "journey shows" : "journeys show"} an open bug (@bug)` : ""}.${coreWarn}`);
  }
  if (other.length) L.push(`- Other projects (not counted): ${n(other.length, "journey")}, for example a login setup.`);

  const fails = counted.filter((t) => t.status === "fail");
  L.push("", `## Failed journeys (${fails.length})`, "");
  if (!fails.length) L.push("None.");
  fails.forEach((t, i) => {
    L.push(`### ${i + 1}. [${t.side}] ${t.title}`, "");
    L.push(`- State: ${t.change}. First failed in round ${t.first_failed}.`);
    const bad = t.turns.findIndex((x) => x.result === "fail");
    if (bad >= 0) {
      L.push(`- Failed turn: ${bad + 1}. ${t.turns[bad].text}`);
      if (bad > 0) L.push(`- Turns before it: ${t.turns.slice(0, bad).map((x, k) => `${k + 1}. ${x.text} (${x.result})`).join(" ")}`);
      L.push("- The journey stopped at this turn. Its later turns did not run.");
    } else {
      L.push("- The journey failed outside a turn: in the login, the setup or a check after the turns.");
      if (t.turns.length) L.push(`- Turns that ran: ${t.turns.map((x, k) => `${k + 1}. ${x.text} (${x.result})`).join(" ")}`);
    }
    L.push(`- Test: \`${t.file}\`${t.tags.length ? `, tags: ${t.tags.join(", ")}` : ""}`);
    if (t.screenshot) L.push(`- Screenshot: \`${t.screenshot}\``);
    if (t.trace) L.push(`- Trace: \`npx playwright show-trace ${t.trace}\``);
    L.push("- Error:", "", "```", t.error || "(no error text)", "```", "");
  });

  const flaky = counted.filter((t) => t.status === "flaky");
  if (flaky.length) {
    L.push("", `## Flaky journeys (${flaky.length}): failed, then passed on a retry`, "");
    for (const t of flaky) L.push(`- [${t.side}] ${t.title} (\`${t.file}\`): ${t.error.split("\n")[0]}`);
  }
  if (passedAgain.length) {
    L.push("", sameVersion ? `## Pass now, with the same app version as round ${prevStamp} (${passedAgain.length})` : `## Fixed since round ${prevStamp} (${passedAgain.length})`, "");
    if (sameVersion) L.push("The app did not change, so the cause is not a fix. Look for a flaky journey or a test data problem.", "");
    for (const t of passedAgain) L.push(`- [${t.side}] ${t.title}`);
  }
  const cleanupFile = join(runDir, "cleanup-failed.txt");
  if (existsSync(cleanupFile)) {
    const lines = readFileSync(cleanupFile, "utf8").trim().split("\n");
    L.push("", `## Cleanup (${lines.length})`, "", "These deletes failed, so the records stay in the test copy:", "");
    for (const line of lines.slice(0, 20)) L.push(`- \`${line}\``);
  }

  L.push("", "## All turns", "", "| # | Side | Journey | Turn | Result |", "|---|---|---|---|---|");
  let k = 0;
  for (const t of counted) {
    if (!t.turns.length) {
      L.push(`| - | ${t.side} | ${cell(t.title)} | (checks only, no turn) | ${t.status} |`);
      continue;
    }
    t.turns.forEach((x, i) => L.push(`| ${++k} | ${x.side} | ${cell(t.id)} | ${i + 1}. ${cell(x.text)} | ${x.result} |`));
  }
}

L.push("", "## Triage", "", "_The QA agent writes this part: the class of each failed journey, then one entry for each bug. One bug can have many failed turns._", "");
L.push("## Next actions", "", "_The QA agent writes this part: at most 5 actions, the most important first._", "");
L.push("## Recommendations", "", "_The QA agent writes this part: gaps, test health, trend and process._", "");
writeFileSync(join(runDir, "report.md"), L.join("\n"));

// The memory files.
if (firstSummary) {
  const flat = Object.fromEntries(SIDES.map((s) => [s, done(s)]));
  appendFileSync(join(QA, "runs", "history.jsonl"), JSON.stringify({ stamp, version: summary.version, environment_down: summary.environment_down, partial, ...totals, tests: counted.length, turns: flat, turn_fails: turnCount.frontend.fail + turnCount.backend.fail }) + "\n");
  const log = allTurns
    .filter((x) => x.result !== "not run")
    .map((x) => JSON.stringify({ stamp, version: summary.version, side: x.side, area: x.journey.area, journey: x.journey.id, n: x.n, turn: x.text, result: x.result, tags: x.journey.tags, partial }));
  if (log.length) appendFileSync(join(QA, "turn-log.jsonl"), log.join("\n") + "\n");
}
writeCoverage();

function writeCoverage() {
  const file = join(QA, "turn-log.jsonl");
  if (!existsSync(file)) return;
  const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.area}\t${r.side}`;
    const g = groups.get(key) || { area: r.area, side: r.side, turns: 0, fails: 0, last: "" };
    g.turns++;
    if (r.result === "fail") g.fails++;
    if (r.stamp > g.last) g.last = r.stamp;
    groups.set(key, g);
  }
  const days = new Set(rows.map((r) => r.stamp.slice(0, 10))).size;
  const C = ["# Coverage", "", "The round script writes this file from `turn-log.jsonl`. Do not edit it. The areas with the fewest turns come first.", ""];
  C.push(`- Days with rounds: ${days}. Turns so far: ${rows.length} (frontend ${rows.filter((r) => r.side === "frontend").length}, backend ${rows.filter((r) => r.side === "backend").length}). Failed turns: ${rows.filter((r) => r.result === "fail").length}.`);
  C.push("- An area is the name of a spec file. An area of `APP-MAP.md` that is not in this table has no turns yet.");
  C.push("- Setup runs and fail checks are not in this file. `npm run turns` shows all turns of today.", "");
  C.push("| Area | Side | Turns | Failed turns | Last round |", "|---|---|---|---|---|");
  for (const g of [...groups.values()].sort((a, b) => a.turns - b.turns || a.area.localeCompare(b.area))) C.push(`| ${g.area} | ${g.side} | ${g.turns} | ${g.fails} | ${g.last} |`);
  writeFileSync(join(QA, "COVERAGE.md"), C.join("\n") + "\n");
}

console.log(`\nQA round ${stamp}: ${meta.environment_down ? "stopped, the test app did not answer" : `turns: frontend ${done("frontend")}, backend ${done("backend")}, failed ${turnCount.frontend.fail + turnCount.backend.fail}. Journeys: ${totals.pass} pass, ${totals.fail} fail, of ${counted.length}`}.`);
console.log(`Turns today: frontend ${usedToday.frontend} of ${budget.frontend}, backend ${usedToday.backend} of ${budget.backend}.`);
console.log(`Report: ${rel(join(runDir, "report.md"))}`);
