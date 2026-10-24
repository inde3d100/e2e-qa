#!/usr/bin/env node
// Prints the QA facts from one REA result file (the --format json output) as Markdown.
// Usage: node rea-facts.mjs <rea-result.json> [--all]
//   capture-browser-scenario result: the API calls of the recorded flow.
//   analyze-javascript-application result: the called addresses and the settings, with file and line.
//   --all  (flow only) also lists documents, scripts, styles, images and fonts.
// It prints key names only, never values. Bodies and settings can hold personal data or passwords.
import { readFileSync } from "node:fs";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node rea-facts.mjs <rea-result.json> [--all]");
  process.exit(1);
}
const evidence = JSON.parse(readFileSync(file, "utf8"));
const n = evidence.normalized_result;
if (evidence.operation === "analyze_javascript_application") {
  mapFacts();
  process.exit(0);
}
if (!n?.events?.items) {
  console.error("Unknown file. Give the --format json output of capture-browser-scenario or analyze-javascript-application.");
  process.exit(1);
}
const items = n.events.items;
const stepName = Object.fromEntries((n.steps || []).map((s) => [s.step_index, s.step_id]));
const API_TYPES = new Set(["fetch", "xhr", "websocket", "eventsource"]);

// The shape of a JSON body: its key names only.
function shape(content) {
  try {
    const v = JSON.parse(Buffer.from(content, "base64").toString("utf8"));
    if (Array.isArray(v)) return v.length && v[0] && typeof v[0] === "object" ? `array of {${Object.keys(v[0]).join(", ")}}` : `array (${v.length})`;
    if (v && typeof v === "object") return `{${Object.keys(v).join(", ")}}`;
    return typeof v;
  } catch {
    return "not JSON";
  }
}
const body = (tx, phase) => {
  const e = items.find((x) => x.kind === "network-content" && x.transaction_id === tx && x.phase === phase && x.body?.state === "captured");
  return e ? shape(e.body.content) : "";
};
// Number and UUID parts of a path become :id, so one route shows once.
const template = (url) => {
  const u = new URL(url);
  return u.pathname.split("/").map((p) => (/^\d+$|^[0-9a-f-]{16,}$/i.test(p) ? ":id" : p)).join("/") + (u.search ? "?" + [...u.searchParams.keys()].join("&") : "");
};

const routes = new Map();
for (const req of items.filter((e) => e.kind === "request")) {
  if (flag !== "--all" && !API_TYPES.has(req.resource_type)) continue;
  const res = items.find((e) => e.kind === "response" && e.transaction_id === req.transaction_id);
  const failed = items.find((e) => e.kind === "request-failed" && e.transaction_id === req.transaction_id);
  const key = `${req.method} ${template(req.url.url)}`;
  const r = routes.get(key) || { key, status: new Set(), steps: new Set(), sent: new Set(), got: new Set(), count: 0 };
  r.count++;
  r.status.add(res?.status ?? (failed ? "failed" : "no answer"));
  r.steps.add(stepName[req.step_index] ?? req.step_index);
  const sent = body(req.transaction_id, "request");
  const got = body(req.transaction_id, "response");
  if (sent) r.sent.add(sent);
  if (got) r.got.add(got);
  routes.set(key, r);
}

const join = (s) => [...s].join(" / ").replace(/\|/g, "\\|");
console.log(`# API calls in ${file}\n`);
console.log("| Call | Times | HTTP status | Steps | Sent body keys | Answer body keys |");
console.log("|---|---|---|---|---|---|");
for (const r of routes.values()) console.log(`| ${r.key} | ${r.count} | ${join(r.status)} | ${join(r.steps)} | ${join(r.sent)} | ${join(r.got)} |`);

const badSteps = (n.steps || []).filter((s) => s.status && s.status !== "completed");
if (badSteps.length) {
  console.log("\n## Steps that did not complete\n");
  for (const s of badSteps) console.log(`- ${s.step_id}: ${s.status}${s.error ? ` (${JSON.stringify(s.error).slice(0, 200)})` : ""}`);
}
const errors = items.filter((e) => (e.kind === "console" && e.level === "error") || e.kind === "page-error");
if (errors.length) {
  console.log("\n## Errors in the page\n");
  for (const e of errors) console.log(`- ${stepName[e.step_index] ?? e.step_index}: ${String(e.text || e.message || "").slice(0, 200)}${e.url?.url ? ` (${e.url.url})` : ""}`);
}
const done = n.completeness || {};
const missing = [...(done.missing_sections || []), ...(done.truncated_sections || [])];
console.log(`\nLimits: only the calls of this one flow. A route that the flow did not use is not in the list.`);
console.log(`Completeness: ${done.status || "unknown"}${missing.length ? ` (parts not complete: ${missing.join(", ")})` : ""}.${done.status === "incomplete" ? " REA saw the listed calls, but it did not keep all content, for example a body. The REA limitations in the result file give the reason." : ""}`);

function mapFacts() {
  const at = (ev) => {
    const v = ev?.location?.value;
    return v?.source ? `${v.source}:${v.start?.line ?? "?"}` : "unknown place";
  };
  console.log(`# REA map facts in ${file}\n`);
  console.log("## Addresses the code calls\n");
  console.log("| Address | How | Where | Note |");
  console.log("|---|---|---|---|");
  for (const node of (n.graph?.nodes || []).filter((x) => x.kind === "endpoint")) {
    for (const o of node.observations || []) {
      const p = o.properties || {};
      console.log(`| \`${String(p.value).replace(/\|/g, "\\|")}\` | ${p.mechanism || ""} | ${at(o.evidence)} | ${p.resolution === "partial" ? "built at run time, partly known" : ""} |`);
    }
  }
  const settings = new Map();
  for (const x of (n.semantic_graph?.nodes || []).filter((y) => y.kind === "config-source" && y.properties?.key)) {
    const key = x.properties.key;
    const s = settings.get(key) || { kinds: new Set(), places: new Set() };
    s.kinds.add(x.properties.source_kind === "default" ? "default value in the code" : x.properties.source_kind);
    s.places.add(at(x.evidence));
    settings.set(key, s);
  }
  console.log("\n## Settings the code reads\n");
  if (!settings.size) console.log("None found.");
  for (const [key, s] of settings) console.log(`- \`${key}\`: ${[...s.kinds].join(", ")} (${[...s.places].join(", ")})`);
  const st = n.summary?.statistics || n.statistics || {};
  console.log(`\nParsed ${st.parsed_javascript_files ?? "?"} JavaScript files, ${st.parse_failures ?? "?"} parse failures.`);
  console.log("Limits: REA finds the calls that the code makes (fetch, WebSocket, http). It does not list the routes that a server defines. Read the server code for those. A missing item is not proof that it does not exist.");
}
