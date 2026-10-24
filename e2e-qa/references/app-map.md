# Map the app

The goal is `qa/APP-MAP.md`. The template has the headings. Give each fact a source: a file and line, a REA result, or "the person said". Write "unknown" when you do not know. Do not guess.

## From the source code (the default)

Find these facts with normal search tools:

1. **Start and reset.** How to start the test copy and how to reset its data. Look in the README, `package.json` scripts, `Dockerfile`, `docker-compose.yml`, `Makefile` and `Procfile`.
2. **Pages.** Read the router: `app/`, `pages/`, `src/routes/` or the router configuration. Write one line for each page: its address and what a user does there.
3. **API routes.** Search for route definitions. Also look for OpenAPI or GraphQL schema files. An example search:
   `rg -n "(app|router)\.(get|post|put|patch|delete)\(|@(Get|Post|Put|Patch|Delete)\(|@app\.(get|post|put|delete)|Route::" --glob '!node_modules'`
4. **Login and roles.** How a session starts, which routes need a login, and which roles exist.
5. **Data.** The main records (tables or models) and how they connect.
6. **External effects.** Email, SMS, payments, file storage, AI models and webhooks. For each, find the setting that stops it in the test copy.
7. **Risks.** The files that change most often, from `git log --since=60.days --name-only --format= | sort | uniq -c | sort -rn | head -20`. Also code with no tests, logins, payments, uploads and data deletion.
8. **Tests that exist.** Find what the unit tests cover. The QA tests add the view of the user. Do not copy the unit tests.

Then write the coverage plan in `APP-MAP.md`: the areas, and the core journeys of each side by risk. The core journeys use at most 10 turns on each side. Use the spec file names for the areas, because `COVERAGE.md` counts the turns by these names. Update the coverage plan when the journeys change.

## With REA (optional)

REA ("Reverse Engineer Anything", npm package `rea-agents`) reads built apps and records real browser flows. Each result is "Evidence": the facts, the source of each fact and the limits.

Use REA when it adds facts:

- There is no source code. You have only the test site, a built bundle (minified JavaScript) or an Electron `app.asar`.
- You need the real API calls of a user flow: the method, the path, the status and the body keys.
- The code builds addresses at run time, so a text search does not find them.

Do not use REA when the full source code is available and a search answers the question. Use REA only on an app that the person owns or has the right to test.

The `rea` value in `qa.config.json`:

- `auto`: use REA only in the cases above.
- `on`: always do step 1 (if there is JavaScript) and step 2 (one flow for each main journey). Compare the REA facts with the facts from the code. Write each difference in `APP-MAP.md`.
- `off`: do not use REA.

**The command.** Use an installed `rea` command. If REA is in a project folder, use `npm exec --prefix /path/to/rea -- rea`. If there is no REA, use `npx -y rea-agents@6.7.0`. The tests of this skill used version 6.7.0, and REA changes often. The examples use `$REA` for the command.

**Paths and logs.** Give REA absolute paths. REA writes progress lines to stderr. Send them to a log file, for example `2> qa/rea/out/map.log`.

**Large files.** A REA result can be many megabytes. Never paste one into the chat. Save it in `qa/rea/out/` and read it with `scripts/rea-facts.mjs` from this skill, or with `jq`.

### 1. Map the JavaScript code

REA reads every file in the folder that you give it. If `qa/` is inside the app folder, REA also reads `qa/node_modules`. That is slow, the result is very large, and the facts get lost. So copy the app source without these folders first:

```bash
mkdir -p qa/rea/out
rsync -a --exclude node_modules --exclude qa --exclude .git /absolute/path/to/app/ /tmp/app-rea-src/
$REA analyze-javascript-application /tmp/app-rea-src --format json > qa/rea/out/map.json 2> qa/rea/out/map.log
node <skill>/scripts/rea-facts.mjs qa/rea/out/map.json
```

- The path can be the copy of a source folder, a built folder or an `app.asar` file.
- The facts script lists the called addresses (with file and line) and the settings that the code reads.
- If a signed app refuses because a checksum does not match, add `--integrity-policy record-and-continue`.
- Limit: REA finds the calls that the code makes. It does not list the routes that a server defines. Read the server code for those.

### 2. Record a user flow

REA runs one Playwright browser flow and records each request. Write the flow as JSON in `qa/rea/flow-<name>.json`:

```json
{
  "browser": { "mode": "launch", "executable_path": "<chromium path>", "headless": true },
  "start_url": { "url": "http://127.0.0.1:3000/" },
  "secrets": [{ "secret_id": "pw", "environment_variable": "QA_PASSWORD" }],
  "actions": [
    { "step_id": "s1_form", "action": "wait_for", "locator": { "kind": "css", "selector": "#password" }, "state": "visible", "timeout_ms": 15000 },
    { "step_id": "s2_password", "action": "fill", "locator": { "kind": "css", "selector": "#password" }, "value": { "source": "secret", "secret_id": "pw" } },
    { "step_id": "s3_log_in", "action": "click", "locator": { "kind": "css", "selector": "form button[type=submit]" }, "timeout_ms": 10000 },
    { "step_id": "s4_settle", "action": "wait_for_timeout", "duration_ms": 2000 }
  ],
  "capture": {
    "after_each_step": ["url"],
    "at_end": ["url"],
    "events": ["network", "console", "page-errors"],
    "network": { "request_body": true, "response_body": true, "header_values": false }
  }
}
```

Other actions: `goto` (with `destination.url`), `fill` with `"source": "literal"`, and `wait_for` with a `state`. Get the Chromium path in `qa/` with:

```bash
node -e "import('@playwright/test').then(m => console.log(m.chromium.executablePath()))"
```

Then run the flow and list its API calls:

```bash
QA_PASSWORD=... $REA capture-browser-scenario qa/rea/flow-login.json --format json > qa/rea/out/flow-login.json
node <skill>/scripts/rea-facts.mjs qa/rea/out/flow-login.json
```

- A secret comes from an environment variable. REA keeps its value out of the result.
- The table shows each call once, with the HTTP status, the step and the key names of the bodies. Use it to plan the backend tests.
- A route that the flow did not use is not in the table. Record one flow for each main journey.

### 3. More REA tools

For a site with no source code, REA can also capture the scripts of a page (`analyze-web-bundle`, `export-web-scripts`). These need more steps. Read the REA skill in the package (`skills/reverse-engineer-anything/SKILL.md`) before you use them.
