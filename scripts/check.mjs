#!/usr/bin/env node
// The checks of this repository. CI runs them, and a contributor runs them before a pull request.
// 1. The skill has a valid front matter. 2. Each script compiles. 3. The demo app starts and answers.
// With --round: 4. A fresh copy of the QA template runs one round against the demo app (needs Playwright).
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed++;
};

// 1. Front matter
const skill = readFileSync(join(root, "e2e-qa/SKILL.md"), "utf8");
const fm = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] || "";
const name = /^name:\s*(.+)$/m.exec(fm)?.[1]?.trim();
const description = /^description:\s*(.+)$/m.exec(fm)?.[1]?.trim() || "";
check("SKILL.md name", name === "e2e-qa", name);
check("SKILL.md description", description.length > 50 && description.length <= 1024, `${description.length} characters`);
check("SKILL.md length", skill.split("\n").length < 500, `${skill.split("\n").length} lines`);

// 2. Each script compiles
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    if (f === "node_modules" || f.startsWith(".git")) continue;
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.m?js$/.test(f)) files.push(p);
  }
};
walk(root);
for (const f of files) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    check(`node --check ${f.slice(root.length + 1)}`, true);
  } catch (e) {
    check(`node --check ${f.slice(root.length + 1)}`, false, String(e.stderr).split("\n")[0]);
  }
}

// 3. The demo app answers
const port = 4890;
const app = spawn(process.execPath, [join(root, "demo-app/server.mjs")], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
try {
  const res = await fetch(`http://127.0.0.1:${port}/api/health`);
  check("demo app answers", res.status === 200);

  // 4. One round of a fresh QA template copy
  if (process.argv.includes("--round")) {
    const qa = join(mkdtempSync(join(tmpdir(), "e2e-qa-check-")), "qa");
    cpSync(join(root, "e2e-qa/assets/qa-template"), qa, { recursive: true });
    writeFileSync(join(qa, ".env"), `QA_BASE_URL=http://127.0.0.1:${port}\nQA_APP_VERSION=check\n`);
    execFileSync("npm", ["install", "--no-fund", "--no-audit"], { cwd: qa, stdio: "inherit" });
    // The browser of the installed Playwright version. On CI, also the system packages that it needs.
    execFileSync("npx", ["playwright", "install", ...(process.env.CI ? ["--with-deps"] : []), "chromium"], { cwd: qa, stdio: "inherit" });
    let code = 0;
    try {
      execFileSync("npm", ["run", "round"], { cwd: qa, stdio: "inherit" });
    } catch (e) {
      code = e.status;
    }
    check("template round exit code 0", code === 0, `exit ${code}`);
    const runs = readdirSync(join(qa, "runs")).filter((d) => /^\d{4}-/.test(d));
    const report = runs.length ? readFileSync(join(qa, "runs", runs[0], "report.md"), "utf8") : "";
    check("template round wrote a report", report.includes("Turns in this round"));
  }
} finally {
  app.kill();
}

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
