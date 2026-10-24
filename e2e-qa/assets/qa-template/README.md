# QA

End-to-end QA of the app, counted in turns: 25 frontend turns and 25 backend turns each day. The e2e-qa skill made this folder. A turn is one action that changes something in the app, for example a message or a new project.

1. Copy `.env.example` to `.env` and fill it. Never commit `.env`.
2. Run `npm install` and `npx playwright install chromium` one time.
3. Run one round with `npm run round`. Read the report in `runs/<stamp>/report.md`.

- `tests/support.ts` has the `turn()` helper. It counts the turns of each day and refuses a turn over the budget.
- `QA_SETUP=1` turns the count off. Use it only while you prepare the journeys, and never put it in `.env`.
- `npm run turns` prints the turns of today.
- `npm run fail-check -- <spec file> <ID> "<old text>" "<new text>"` shows if one journey can fail.
- `APP-MAP.md` describes the app. `BUGS.md` lists the bugs. `LESSONS.md` keeps the lessons of the agent.
- `COVERAGE.md` and `turn-log.jsonl` show each turn so far. The round script writes them.
- Exit codes: 0 all pass, 1 fails, 2 no answer from the test app, 3 turn budget full. Code 4: a journey file does not compile.
