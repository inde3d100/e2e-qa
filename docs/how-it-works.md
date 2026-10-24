# How e2e-qa works

This page explains the ideas behind the skill. For the steps, read the [README](../README.md). For the full rules of the agent, read [`e2e-qa/SKILL.md`](../e2e-qa/SKILL.md).

## Turns, not tests

A count of tests says little about the work. One test can do one click or twenty. So the skill counts turns: actions that change something in the app.

A turn costs something. It adds data, it can send a message to an AI model, and it takes time. Reading costs almost nothing. So each turn counts, and each read is free. Each day has a budget, by default 25 turns in the page and 25 through the API.

The budget is in code, not only in the instructions. The `turn()` helper in `tests/support.ts` adds one byte to a counter file for each turn. Over the budget, it refuses the turn. An agent that forgets the limit still cannot pass it.

## Journeys

A journey is one Playwright test: one or more turns in the order a user does them. Each turn checks its own result. Example:

1. Create the project "Spring menu". Check: the project page opens.
2. Send "Plan 3 cakes" in the project chat. Check: a reply comes.

A journey stops at its first failed turn. The turns before it are the steps that show the bug again. So the bug report gets its steps from the journey.

Each journey has a tag:

| Tag | What | Each day |
|---|---|---|
| `@core` | The main jobs of the app, at most 10 turns on each side. | Runs again. |
| `@change` | What changed in the code since the last round. | New. |
| `@edge` | Hard cases: empty input, HTML in a field, a double click, a slow network. | New. |
| `@bug` | A second tag on a journey that shows an open bug. | Runs again until the fix. |

## The memory

An agent forgets everything between two sessions. So the skill keeps its memory in files in `qa/`:

| File | What it holds |
|---|---|
| `LESSONS.md` | Traps of the app and of the tests, answers from you, open questions. |
| `BUGS.md` | The open and the fixed bugs, with an ID that does not change. |
| `turn-log.jsonl` | Each turn so far, with its result. |
| `COVERAGE.md` | The turns so far in each area of the app, the areas with the fewest turns first. |
| `APP-MAP.md` | The pages, the API routes, the logins, the data and the risks. |

Each morning the agent reads these files first. Then it plans the day:

1. The core journeys, when the app changed.
2. One check of each open bug.
3. Turns on the new changes in the code.
4. New cases in the areas with the fewest turns.

Before it writes a new turn, it searches the turn log, so it does not try the same case twice.

## Why the agent writes scripts

The agent writes the turns of the day as Playwright scripts, then it runs them. It does not click live, one step at a time.

A script costs fewer tokens and runs the same way each time. Each bug then also has a script that shows it again. The cost: the agent learns between days, not between turns. In our tests, this trade was right. The agents found all planted bugs, and the next day they found the new bugs of a code change.

## Who decides what

The scripts own the numbers: the turn count, the budget, the comparison with the last round. The agent owns the judgment: which cases to try, the class of each fail, the likely cause, the next actions. You own the decisions: the test address, the rules of your app, and when the daily QA stops.

## When to stop

The daily QA runs until you stop it. After 3 days with no new bug, the agent checks `COVERAGE.md`. If each area of the app has turns, it tells you, and it recommends fewer turns each day or a stop.
