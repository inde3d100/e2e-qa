# e2e-qa

**An agent skill for daily end-to-end QA of a web app, counted in turns.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/inde3d100/e2e-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/inde3d100/e2e-qa/actions/workflows/ci.yml)

Your AI agent uses your app as a user does. Each day it does 50 turns, writes a bug report, and gives you the next actions. It keeps a memory in files, so each new day starts from what it learned before.

It works with [Pi](https://github.com/badlogic/pi-mono), [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [Codex](https://github.com/openai/codex).

```
 Day 1 (one time)              Each day                         Each next morning
 +----------------------+     +---------------------------+     +--------------------+
 | Read the app code    |     | 25 turns in the page      |     | Read the memory    |
 | Write the app map    | --> | 25 turns through the API  | --> | Pick new cases     |
 | Write the journeys   |     | Bug report, next actions  |     | Continue           |
 +----------------------+     +---------------------------+     +--------------------+
```

## What a turn is

A turn is one action that changes something in the app. Examples: send a message, create a file, a person or a project, switch a setting. A refused try counts too.

Reading, searching, checks and the login are free. A counter in the scripts refuses each turn over the daily limit. So the agent cannot use more turns, or more money, than you allow.

## What you get each day

- A report with the result of each turn, in `qa/runs/<date>/report.md`.
- For each fail: the class, the severity and the likely place in the code, with the steps that show the bug again.
- At most 5 next actions, the most important first, and recommendations.
- A bug list that keeps the same ID for each bug until the fix.

## Requirements

- [Node.js](https://nodejs.org) 22 or newer.
- One agent: Pi, Claude Code or Codex.
- A test copy of your web app, with made-up data. Never point the agent at the live app.

## Install

Use one of these 2 ways.

**With the skills installer** (it asks for your agent):

```bash
npx skills add inde3d100/e2e-qa
```

**With git:**

```bash
git clone https://github.com/inde3d100/e2e-qa
cp -R e2e-qa/e2e-qa ~/.claude/skills/     # Claude Code
cp -R e2e-qa/e2e-qa ~/.agents/skills/     # Pi
cp -R e2e-qa/e2e-qa ~/.codex/skills/      # Codex
```

The skill is the `e2e-qa/` folder. The other folders of this repository are for people.

## Quick start

1. Start the test copy of your app.
2. Open your agent in the folder of the app code.
3. Send this message, with your own address and test login:

   ```text
   Use the e2e-qa skill. I want daily end-to-end QA for my app, counted in turns.
   The test copy runs at http://127.0.0.1:3000. The test login is <user> / <password>.
   Do the setup and the first round, then give me the bug report.
   ```

4. Answer the questions of the agent. It asks only for facts that it cannot find in the code.
5. Read the report. The agent gives you its path.

The agent adds a `qa/` folder to your app folder. It does not change your app code.

## Every next day

| You want | Send to the agent |
|---|---|
| A new round | `Use the e2e-qa skill. Do today's daily round.` |
| A round each morning with no person | `Use the e2e-qa skill. Set up the daily start.` |
| No more daily rounds | `Use the e2e-qa skill. Stop the daily QA.` |
| A check of a bug report from a user | `Use the e2e-qa skill. Check this bug report: <text>` |

The daily start works with launchd (macOS), cron (Linux) or GitHub Actions. See [the schedule reference](e2e-qa/references/schedule.md).

## Try it on the demo app

The [`demo-app/`](demo-app/) folder has a small order app with 5 hidden bugs. It needs no install.

1. Start it:

   ```bash
   node demo-app/server.mjs
   ```

   It runs at `http://127.0.0.1:4810`. The test password is `demo-pass-123`.

2. Copy the `demo-app/` folder to a new place, so that the agent sees no other file of this repository.
3. Open your agent in that folder and send the quick start message.
4. After the round, compare the report with [the known bugs](docs/demo-known-bugs.md).

A good first round finds the 5 planted bugs. In our tests, the agents found all 5 each time.

## Safety rules of the skill

- The agent tests only a test copy. If only the live app exists, it stops and asks you.
- It uses made-up data, and each journey deletes the data that it makes.
- It keeps secrets in `qa/.env`, and never prints or commits them.
- It uses a headless browser with an empty profile, never your own browser.
- It does not send real email, SMS, payments or posts. It skips a flow that has no test mode.
- It changes only the `qa/` folder, and it does not commit unless you ask.

## How it works

Read [How e2e-qa works](docs/how-it-works.md): turns and journeys, the memory files, the turn budget, and why the agent writes scripts.

## REA (optional)

[REA](https://www.npmjs.com/package/rea-agents) reads built apps and records browser flows. The skill uses it when there is no source code. See [the app map reference](e2e-qa/references/app-map.md).

## Contribute

Bug reports and changes are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. To report a security problem, read [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
