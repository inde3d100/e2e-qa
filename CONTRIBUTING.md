# Contribute to e2e-qa

Thank you for your help. This page tells you how to report a problem and how to send a change.

## Report a problem

Open an issue. Use the "Bug report" form. Give these facts:

- Your agent and its version: Pi, Claude Code or Codex.
- The type of your app, for example a React page with a REST API.
- What the agent did, and what you expected.
- The part of the report or of the agent output that shows the problem. Remove secrets and personal data first.

A place where the agent stopped, asked a question or made a guess is also a good report. Each one shows a part of the skill to improve.

## Send a change

1. Fork the repository and make a branch.
2. Make the smallest change that solves one problem.
3. Run the checks:

   ```bash
   node scripts/check.mjs
   ```

4. Test a change of the instructions on the demo app with a new agent session. Write the result in the pull request.
5. Open a pull request. Fill the template.

## Rules for the text of the skill

- The instructions are for an agent. Write short, direct sentences, one instruction in each.
- Use one word for one thing. The skill uses "turn", "journey", "round" and "core" with a fixed meaning. See [How e2e-qa works](docs/how-it-works.md).
- Put a number or a limit into code when the agent must not pass it.
- Keep `e2e-qa/SKILL.md` short. Put long details in `e2e-qa/references/`.

## Where the parts are

| Folder | What it holds |
|---|---|
| `e2e-qa/SKILL.md` | The entry point for the agent. |
| `e2e-qa/references/` | The details: the app map, the test design, the bug report, the daily start. |
| `e2e-qa/assets/qa-template/` | The starter `qa/` folder that the agent copies into an app. |
| `e2e-qa/scripts/` | Helpers for the agent, for example for REA results. |
| `demo-app/` | The demo app with 5 planted bugs. |
| `scripts/check.mjs` | The checks that CI runs. |
