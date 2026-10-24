# Triage, the bug report and next actions

## 1. Find the class of each fail

The report shows the failed turn of each journey, and the turns before it. Open the error and the screenshot first. Then open the trace: `npx playwright show-trace <path>`. Read the app code at the place of the fail. A re-run or a manual try costs turns, so use the turns that you kept for re-runs.

A turn that did not run because the turn budget was full is not a fail. Run it on the next day.

| Class | It means | What you do |
|---|---|---|
| App bug | The app does the wrong thing. | Give a severity and a likely cause. Add it to `BUGS.md`. |
| Test bug | The journey is wrong: a race, a bad locator or a wrong expectation. | Fix the journey in this round. Write the change and the reason in the report. |
| Environment | The test app is down, slow, on the wrong version, or has data from another run. | Fix it or tell the person. Run the failed journeys one more time. |
| Flaky | The journey failed one time, then passed on a re-run with the same app version. | Note it in `LESSONS.md`. If it is flaky in 3 rounds one after the other, find the cause. |
| Intended change | The app changed on purpose, for example in a release note or a commit message. | Change the journey and write the reason. If you are not sure, ask the person. |
| Question | The person or the docs do not say what the right behaviour is. | Keep the journey as it is. Ask the question in the summary, and add it to the open questions in `LESSONS.md`. Move the answer to "Answers from the person". |

Name the evidence for each class, for example "the server answers 201 for qty 0 (trace, step 2)". A class with no evidence is a guess. Write "guess" next to it.

## 2. Give each app bug a severity

| Severity | When |
|---|---|
| S1 blocker | Users cannot do a main job. Data loss. A security hole. A wrong payment. |
| S2 major | A main job fails in some cases, or the app gives a wrong result with no warning. |
| S3 minor | A side job fails, or a message is bad, and an easy way around exists. |
| S4 cosmetic | Text or layout only. |

A security hole is S1 also with made-up test data.

## 3. Write each app bug

Replace each placeholder text (in italics) in the report with your text. Start the "Triage" part with a table: journey, class, bug and evidence. Then write one heading for each bug. One bug can have many failed turns. Each entry has:

- **Title:** what the user sees, not the code cause. Example: "Delete works without a login".
- **ID, severity and class.**
- **Steps to reproduce:** the turns of the journey up to the failed turn, numbered, from a clean start.
- **Expected** and **actual** result.
- **Evidence:** the screenshot, the trace and the answer of the server.
- **Likely cause:** a file and a line, marked "guess" until a person confirms it.
- **First seen:** the round. The report shows it.
- **Proof of the fix:** the journey that must pass.

## 4. Keep `qa/BUGS.md` current

- One row for each open bug. The ID (`BUG-001`, `BUG-002` ...) stays the same until the fix.
- One cause is one bug. A new journey that fails because of the cause of an open bug goes to that bug. A new cause gets a new ID.
- In each round, check the file and line of each likely cause. Code changes move them.
- When the journey of a bug passes, move the row to "Fixed", with the date and the round.
- A test bug or an environment problem does not go into `BUGS.md`.

## 5. Write the next actions

Write at most 5 actions in the "Next actions" part. Put them in this order:

1. S1 bugs first, then S2, S3 and S4.
2. At the same severity, a new bug comes before an old bug.
3. At the same severity and age, the cheapest fix comes first.

Each action names who does it (a developer, the QA agent or the person). It also names what, why, and the journey that proves it. An example:

> 1. **Developer:** add a login check to `DELETE /api/orders/:id` (`server.mjs:78`, guess). Why: anybody can delete orders (BUG-002, S1). Proof: B19 passes.

## 6. Write the recommendations

Write short recommendations in the "Recommendations" part. Give one clear recommendation for each topic, with the reason:

- **Gaps:** risky areas of `APP-MAP.md` with few or no turns in `COVERAGE.md`.
- **Test health:** flaky journeys, slow journeys and the test bugs of this round.
- **Trend:** the failed turns of the last rounds, from `runs/history.jsonl`.
- **Process:** at most one change, for example "run the core backend journeys on each pull request".

## 7. A bug report from a person

1. Read the report. Find the steps, the expected result, the actual result and the app version.
2. If facts are missing, ask for all of them in one message.
3. Write a journey with the steps of the person. Its turns count.
4. If the journey fails as the person said, it is an app bug. Add it to `BUGS.md`, and tag the journey `@change`.
5. If the journey passes, tell the person what you tried. Ask for the missing detail: the data, the browser or the account.
6. Then do the triage and the next actions as above.

## 8. The summary for the person

Send 5 lines after each round:

1. Result: 48 turns (25 frontend, 23 backend), 44 pass, 4 fail (2 new).
2. The most important bug: its title and severity.
3. Next action 1.
4. What you need from the person, or "nothing".
5. The path of the report.
