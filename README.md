# e2e-qa

Daily end-to-end QA of a web app by an AI agent, counted in turns.

A turn is one action that changes something in the app. Examples: a message, a new file, a new project. Each day the agent does 25 turns in the page and 25 through the API. Then it writes a bug report with next actions. It keeps a memory in files, so the next day continues with new cases.

## What is in this repository

| Folder | What it holds |
|---|---|
| `e2e-qa/` | The skill: the instructions for the agent, the starter QA folder and the scripts. |
| `demo-app/` | A small order app with 5 hidden bugs. Use it to try the skill. `KNOWN-BUGS.md` lists the bugs. Do not show that file to the agent. |

## What you need

1. Node.js 22 or newer.
2. An agent: Pi, Claude Code or Codex.
3. A test copy of your web app, with made-up data. Never the live app.

## Install

Copy the `e2e-qa/` folder into the skill folder of your agent:

| Agent | Skill folder |
|---|---|
| Pi | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` |

## Use

1. Start the test copy of your app.
2. Open your agent in the folder of the app code.
3. Send this message, with your own values:

```text
Use the e2e-qa skill. I want daily end-to-end QA for my app, counted in turns.
The test copy runs at http://127.0.0.1:3000. The test login is <user> / <password>.
Do the setup and the first round, then give me the bug report.
```

4. On the next days, send: "Use the e2e-qa skill. Do today's daily round."
5. For a daily start with no person, send: "Set up the daily start." To stop it, send: "Stop the daily QA."

The agent makes a `qa/` folder in your app folder. It changes no app code.

## Try it on the demo app

```bash
node demo-app/server.mjs   # http://127.0.0.1:4810, the test password is demo-pass-123
```

Then open your agent in `demo-app/` and send the message above. A good first round finds the 5 bugs of `KNOWN-BUGS.md`.

## REA (optional)

REA (`rea-agents` on npm) reads built apps and records browser flows. The skill uses it when there is no source code. See `e2e-qa/references/app-map.md`.
