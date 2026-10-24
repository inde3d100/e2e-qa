# Design the journeys and the turns

Read "Turns and journeys" in `SKILL.md` first. This file tells how to choose and write them.

## Special cases of turns

- A setup action through the API in a frontend journey is a backend turn. Write it as `turn("api", ...)`.
- The login is never a turn, also through the API.
- You can put turns in a loop. Each pass of the loop is one turn.
- Do not put a turn inside a turn.
- Two writes at the same time are two turns. Give each write its own `turn()` call.
- Put the last check of a journey inside its last turn. A check after the last turn gives a fail with no failed turn.
- A message to an AI model in the app is a turn that costs money. Keep these turns within `paid_calls_per_round`.

## The mix on each side (one day)

| Part | Turns | What |
|---|---|---|
| Core journeys (`@core`) | at most 10 | The main jobs. The same each day. |
| Open bugs (`@bug`) | 1 or 2 for each open bug | The journey that shows the bug, until the fix. |
| Changes (`@change`) | about 5 | What changed since the last round. New each day. |
| New cases (`@edge`) | the rest | Hard cases and the areas with few turns. New each day. |
| Re-runs | about 5 | Kept back. Use them to re-run a failed journey with an unclear cause. |

- When nothing changed since the last round, use the change turns for more new cases.
- When the open bugs need more than 5 turns on one side, re-check the S1 and S2 bugs first. Write this in the recommendations.
- If the app has no frontend, put all 50 turns on the API side in `turns_per_day`. If it has no API, put them on the page side. Write this choice in `APP-MAP.md`.
- If the app has no API, delete `tests/backend/`. Set the backend values in `turns_per_day` and `core_turns_max` to 0, and the frontend values to 50 and 10.
- If the app keeps its data only in the browser, each journey starts with empty data. Then the journeys need no cleanup.
- The limits are in `qa.config.json`. The report shows the turns of each part, and a warning when the core journeys use too many.

## Choose the core journeys

Rank the journeys by these questions:

1. What do users do most?
2. What loses money, data or trust when it breaks?
3. What broke before?
4. What changes most often?

Keep each journey short: 1 to 4 turns. A journey stops at its first failed turn, so a long journey hides the turns after a fail.

## Write a journey

Import `test`, `expect` and `turn` from `../support`. A turn gets its side, a short text and a body. The body does the action and then checks its result. The text goes into the report, so write it as the user action with its input.

```ts
import { test, expect, turn } from "../support";

test("F12 create a project and chat in it", { tag: "@change" }, async ({ page }) => {
  await page.goto("/projects"); // free: no turn
  await turn("ui", "Create the project 'qa Spring menu'", async () => {
    await page.getByLabel("Project name").fill("qa Spring menu");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { name: "qa Spring menu" })).toBeVisible();
  });
  await turn("ui", "Send 'Plan 3 cakes' in the project chat", async () => {
    await page.getByRole("textbox", { name: "Message" }).fill("Plan 3 cakes");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("article").last()).toContainText(/cake/i);
  });
});

test("B07 a new person, then a person with an empty name", { tag: "@edge" }, async ({ request, cleanup }) => {
  await turn("api", "POST /api/people with the name 'qa Rita'", async () => {
    const res = await request.post("/api/people", { data: { name: "qa Rita" } });
    const body = await res.json().catch(() => ({}));
    if (body.id) cleanup.push(`/api/people/${body.id}`); // before the checks
    expect(res.status()).toBe(201);
  });
  await turn("api", "POST /api/people with an empty name", async () => {
    const res = await request.post("/api/people", { data: { name: "" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });
});
```

## Frontend journeys (in the page)

Free checks (no turn) that each journey can add:

- The page opens with no script error and no failed request.
- Empty lists, error states and loading states show a clear text.
- A reload, the Back button and a phone screen (390 x 844) keep the page usable.

Turns:

- The main jobs from start to end: create, edit, delete, send, upload, switch a setting, pay (in test mode).
- A form with bad input. The page must show a clear message.
- Enter in the main form, and a double click on a submit button.

## Backend journeys (through the API, no browser)

Use the Playwright `request` fixture.

Free checks (no turn):

- The status and the body of each main read route.
- A read with no session gives 401. An unknown route gives 404. An error never shows a stack trace.
- The JSON content type, and the cookie flags `HttpOnly`, `Secure` (on HTTPS) and `SameSite`.

Turns:

- Each write route with good input. Then a free read shows the new record.
- Input checks: a missing field, a wrong type, an empty value, a very long value or a negative number. Each try is a turn. Each gives 400 and a clear error, never 500.
- Access: a write with no session gives 401, and a write with a wrong role gives 403. A user cannot change the data of another user. Skip this when the app has no accounts, and write that in `APP-MAP.md`.
- The same request two times (a duplicate submit). Two writes at the same time on one record.
- Background jobs: the start of the job is a turn. The checks of its state are free, with a time limit.

## The edge list

Pick new cases each day. Prefer the cases that fit the risks in `APP-MAP.md` and the areas at the top of `COVERAGE.md`.

Frontend:

- Empty input, input with only spaces, and very long text (500 characters or more).
- HTML or script in a text field, for example `<b>` or `<img src=x onerror=alert(1)>`. The page must show it as text.
- Greek, Arabic, Chinese and emoji text.
- A double click on a submit button.
- A reload in the middle of a flow. Back after a submit. The same page in two tabs.
- A slow network (`page.route` with a delay), or no network after the page loads.
- A phone screen, 200% zoom, and another time zone (`timezoneId`).
- A session that ends while the user fills a form.

Backend:

- 0, a negative number, a very large number, and text where a number goes.
- No body, broken JSON, and a wrong content type. Send broken JSON as `data: Buffer.from("{not json")`. With a JSON content type, Playwright changes a string in `data` to a JSON string. The server then gets valid JSON.
- An unknown ID, and the ID of another user.
- A very large body, Unicode text, and SQL or script text in a field. The app must save it as text and never run it.
- A session after the logout. A rate limit, if the app has one.

## Rules for stable journeys

- Find elements with `getByRole`, `getByLabel`, `getByText` or `data-testid`. Do not use CSS paths that change with the layout.
- Do not use fixed waits (`waitForTimeout`). An `expect` waits until its condition is true.
- After an action, wait for its result before a check that something is absent. Examples of a result: an answer, a new row or a message. A check like `not.toHaveText(...)` can pass before the answer comes.
- Each journey makes its own data with a unique name, for example `qa <label> <random>`. Never use data from another journey, because the journeys run at the same time.
- Clean up: add the address of each record that a journey makes to `cleanup`. The fixture deletes them after the journey. If a delete needs a login, add the login to the fixture in `tests/support.ts`. The report lists each delete that failed. A record that is already gone (404) is not a fail.
- Add a record to `cleanup` right after the action, before the checks. A turn can fail on a check while the record exists.
- Put shared helpers in `tests/`, for example a login helper in `tests/helpers.ts`. Only the spec files in `tests/frontend/` and `tests/backend/` hold journeys.
- Start the title with the journey ID and say the expected behaviour: `F07 search finds an order with other letter case`.
- Never use a journey ID again. A new journey gets the next free number on its side. The report follows each journey by its side and ID, also when it moves to another file.
- Name the spec files by the area of the app, for example `orders.spec.ts`. `COVERAGE.md` counts the turns by these names. Do not name the files by tag, because tags change.
- Log in through the API in a helper, or one time in a Playwright setup project with `storageState`. The login is not a turn.
- Make sure that each journey can fail. Each turn needs an `expect` on the result of its action.
- Do a real fail check one time for each `@change` journey, and for each journey that you are not sure about. In job 1, also after the first round, run it with `QA_SETUP=1`. In job 2, it costs the turns of its journey, so plan this cost into the change turns. When no turns are left, do it on the next day, and write that in the report.
- The fail check: `npm run fail-check -- <spec file> <ID> "<old text>" "<new text>"`. It changes the text in that journey only, runs the journey and puts the file back. OK means that the journey failed. PROBLEM means that the journey does not check that text. Put the texts in single quotes in the shell. The script changes the first match in the journey, so give a text that occurs only one time there.
- In a fail check, change an expected value, not the kind of check. A change from `toBeVisible` to `toBeHidden` can pass before the answer comes, and then gives a false PROBLEM.

## Tags in Playwright

```ts
test("B16 quantity 0 gives 400", { tag: "@edge" }, async ({ request }) => {
  // ...
});
```

A journey with two tags:

```ts
test("F21 a double click on Add order makes one order", { tag: ["@edge", "@bug"] }, async ({ page }) => {
  // ...
});
```

Run one tag only with `npm run round -- --grep @core`. A round with options is a partial round. The next round does not compare with it, but its turns count.
