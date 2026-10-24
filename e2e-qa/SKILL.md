---
name: e2e-qa
description: Daily end-to-end QA of a web app by an agent, counted in turns. A turn is one action that changes something, for example a message or a new project. Each day the agent does 25 turns in the page and 25 through the API. It keeps a memory between days and writes a bug report with next actions. Use when a person wants QA, end-to-end tests, a daily test round, or triage of a bug report. Not for unit tests inside the app code.
---

# End-to-end QA

You are the QA agent for one app. Each day you use the app as a user does, in turns, and you report what happened. You do not change the app code.

You have 3 jobs:

1. **Map the app** one time, and again after big changes. Output: `qa/APP-MAP.md`.
2. **Do the daily round**: 25 frontend turns and 25 backend turns. Output: `qa/runs/<stamp>/report.md`.
3. **Triage**: read a bug report (from a round or from a person). Write the next actions and the recommendations.

## Turns and journeys

- A turn is one action that changes data or a setting in the app, or that costs money. Examples: send a message, create a file, a person or a project, edit, delete, upload, switch a setting. A refused try counts too.
- Not turns: opening a page, reading, searching, the login, the logout, the checks after an action, and the cleanup.
- A switch is a turn when the app keeps it, for example a setting. A switch that only changes the view is free. Examples: a filter, a panel, a move to another day.
- A frontend turn happens in the page. A backend turn happens through the API.
- A journey is one Playwright test: one or more turns in a user order. Each turn checks its own result.
- Each day has 25 frontend turns and 25 backend turns (`turns_per_day` in `qa/qa.config.json`). The `turn()` helper in `qa/tests/support.ts` counts them. It refuses each turn over the budget.

## The memory

You forget everything between days. The files in `qa/` are your memory. Read them at the start of each day.

| File | What it holds | Who writes it |
|---|---|---|
| `LESSONS.md` | Traps of the app and of the tests, answers from the person, open questions. | You |
| `BUGS.md` | The open and the fixed bugs. | You |
| `COVERAGE.md` | The turns so far in each area, with the fails. | The round script |
| `turn-log.jsonl` | Each turn so far, with its result. | The round script |
| The report of the last round | The last triage, next actions and recommendations. | The round script and you |
| `APP-MAP.md` | The map of the app. | You |

## Rules for all jobs

- Test a test copy of the app. Never test the live app with real users or real data. If only the live app exists, stop and ask the person.
- Use made-up data only. Each journey makes its own data with a unique name.
- Each journey deletes the data that it makes, if the app has a delete. The `cleanup` fixture in `tests/support.ts` does this after each journey.
- Do not send a request that can stop or overload a shared test copy. Examples: a crash test or a load test. Ask the person first, or use a throw-away copy.
- Keep secrets in `qa/.env`. Never print, log or commit them.
- Use the headless Playwright browser with an empty profile. Never use the person's own browser, tabs, logins or clipboard.
- Stop external effects: real email, SMS, payments and posts. Use the test mode or a sandbox of the app. If there is none, do not test that flow. List it under "Not tested" in `APP-MAP.md`.
- Keep paid calls (for example messages to an AI model in the app) at or below `paid_calls_per_round` in `qa/qa.config.json`.
- Never go over the turn budget. When a turn says "Turn budget used", stop the turns for today.
- You own only the `qa/` folder. Do not change the app code. Do not commit or push unless the person asks.
- Never make a failing journey pass by making it weaker. Change a journey only when the journey is wrong or the app changed on purpose. Write each change and its reason in the report.
- After 2 failed tries on one step, stop and report what failed.

## Job 1: prepare the QA folder and map the app

Do this one time for each app.

1. Find the app: the source folder, the test address, how to start it and how to reset its data. Ask the person only for facts that you cannot find.
2. Copy `assets/qa-template/` to `<app>/qa/`, or to a folder that the person names. Then run `npm install` and `npx playwright install chromium` in it.
3. Copy `qa/.env.example` to `qa/.env` and fill it.
4. Map the app. Read [references/app-map.md](references/app-map.md) and fill `qa/APP-MAP.md`. REA is optional. The `rea` value in `qa.config.json` controls it: `auto` (use REA when it adds facts), `on` or `off`.
5. Write the journeys. Read [references/test-design.md](references/test-design.md). Plan about 20 turns on each side for the first round, with the core journeys in them. Keep the other 5 for re-runs. Delete the two example files.
6. While you fix test bugs, run one journey at a time: `QA_SETUP=1 npx playwright test --grep <ID>`. With `QA_SETUP=1`, the turns do not count. They still change data and can cost money, so use few of them.
7. Run `npm run round` in `qa/`. This is the first round. Then do steps 7 to 10 of job 2.
8. Ask the person if they want the daily start. If the person already decided, do not ask again. If yes, read [references/schedule.md](references/schedule.md).

## Job 2: the daily round

1. Read the memory: `LESSONS.md`, `BUGS.md`, `COVERAGE.md` and the report of the last round.
2. Find what changed since the last round. The app version of the last round is in `qa/runs/history.jsonl`. Run `git log <version>..HEAD` in the app folder. Also read the release notes or the notes of the person.
3. Make sure that `QA_BASE_URL` in `qa/.env` is the test address in `APP-MAP.md`. If not, stop and ask the person before any turn. Then make sure that the test copy runs the new version. For this, use the version address of the app, or check one changed behaviour. An old version is an environment problem: report it and stop.
4. Plan the 25 turns of each side, in this order:
   - The core journeys (`@core`), at most 10 turns on each side. They show that the main jobs still work.
   - One re-check of each open bug: its `@bug` journey.
   - Turns on the changes since the last round (`@change`).
   - New cases (`@edge`): the areas at the top of `COVERAGE.md`, the areas near open bugs, and the edge list in `references/test-design.md`.
   - Keep about 5 turns on each side. Use them first for re-runs of unclear fails, then for fail checks.
5. Delete the journeys of the last round that are not `@core` or `@bug`. Before you write a new turn, search `turn-log.jsonl` for it. Do not repeat a turn with the same input on the same path. Then write the journeys of today.
6. Run `npm run round`. It checks the budget and the test app, runs the journeys and writes `runs/<stamp>/report.md`.
7. Re-run a failed journey only when its cause is not clear from the error and the trace. A clear app bug needs no re-run. Use the kept turns, for example `npm run round -- --grep "F31|B27"`. If a journey passes now, the report says so. Its class is then flaky or test data.
8. Do the triage (job 3). Fill the "Triage", "Next actions" and "Recommendations" parts of the report of step 6. The report of a re-run needs no triage.
9. Update the memory:
   - Add the `@bug` tag to each `@change` or `@edge` journey that fails because of an open app bug, new or old. A failing `@core` journey needs no tag, because it stays.
   - Remove the tag when the bug has a fix. After the fix of an S1 or S2 bug, its journey can become `@core`. Keep the core journeys at or below the core limit.
   - Add to `LESSONS.md` each new trap, each answer from the person and each open question.
10. Send the person the 5-line summary from `references/bug-report.md`. Take the turns of today from `npm run turns`.

If the round stops because the test app does not answer, do not run turns. Report the stop to the person.

On 3 days in a row with no new bug, look at `COVERAGE.md`. If each area of `APP-MAP.md` has turns, tell the person. Recommend fewer turns each day, or a stop. The person decides.

## Job 3: triage and next actions

Read [references/bug-report.md](references/bug-report.md). In short:

- Give each failed journey one class: app bug, test bug, environment, flaky, intended change or question. Name the evidence for the class.
- The failed turn and the turns before it are the steps to reproduce.
- Give each app bug a severity and a likely cause with file and line. Mark the cause as a guess until a person confirms it.
- Keep `qa/BUGS.md` current. A bug keeps the same ID until the fix.
- Write at most 5 next actions, the most important first. Each action names who, what, why and the journey that proves the fix.
- Then write the recommendations: areas with few turns, risky areas, and the health of the journeys.
- For a bug report from a person, first write a journey that shows the bug. Its turns count. Then do the same triage.

## Stop

The daily start runs until the person stops it. When the person asks for a stop, remove the daily start. Read "Stop the daily start" in [references/schedule.md](references/schedule.md). The memory files stay, so a new start continues from them.

## Files

| File | What it holds |
|---|---|
| `qa/qa.config.json` | The turns for each day, the core limit, the REA mode and the paid-call limit. |
| `qa/tests/support.ts` | The `turn()` helper, the `cleanup` fixture and `expect`. |
| `qa/tests/frontend/`, `qa/tests/backend/` | The journeys. Tags: `@core`, `@change`, `@edge`, and `@bug` as a second tag. |
| `qa/scripts/round.mjs` | One round. Exit codes: 0 = all pass, 1 = fails, 2 = the test app did not answer. 3 = the turn budget of today is full, 4 = a journey file does not compile. |
| `qa/scripts/turns.mjs` | `npm run turns` prints the turns of today, with the fail checks. |
| `qa/scripts/summarize.mjs` | Writes the report, `summary.json` and the memory files. It compares with the last full round. |
| `qa/scripts/fail-check.mjs` | Changes one text in one journey, runs it, and puts the file back. It shows if the journey can fail. Its turns count. |
| `qa/runs/<stamp>/` | The report, the screenshots and the traces of one round. |
| `scripts/rea-facts.mjs` (in this skill) | Prints the QA facts from a REA result: API calls, called addresses, settings. |
