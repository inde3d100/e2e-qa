# Start the round each day

## Choose a way

| Way | What runs | What you get |
|---|---|---|
| A. Agent each day (recommended) | A scheduler starts an agent command in the app folder. | New `@change` and `@edge` tests, the round, the triage and the summary. |
| B. Script only | A scheduler runs `npm run round`. | The same journeys each day. No new turns, no triage and no memory updates by an agent. |
| C. CI | GitHub Actions runs `npm run round` on a schedule. | Like B. The report is a download of the CI run. |

The test copy of the app must run at that time. The round stops with exit code 2 when the test app does not answer.

## The agent command (way A)

The prompt for each agent names the path of `SKILL.md`. So each agent finds the skill, also when the skill is not in its own skill folder:

```text
Use the e2e-qa skill (/path/to/e2e-qa/SKILL.md). Do today's daily round (job 2) for the app in this folder. The QA folder is ./qa.
```

- **Pi:** `pi -p --skill /path/to/e2e-qa "<prompt>"`
- **Claude Code:** `claude -p "<prompt>" --allowedTools "Bash(npm *) Bash(npx *) Bash(node *) Bash(git log *) Read Edit Write"`
- **Codex:** `codex exec -C /path/to/app -s danger-full-access "<prompt>"`

Each command did a full round with no person in a test. The versions: Pi from launchd, Claude Code 2.1.309, codex-cli 0.162.1.

- A run with no person cannot answer an approval question. So each command gives the agent the permissions of a round before the start.
- Claude Code refuses each Bash command that is not in `--allowedTools`. The agent then uses another way, or it stops.
- Codex: its `workspace-write` sandbox blocks the test app on localhost, and on macOS it also blocks Chromium. `-c sandbox_workspace_write.network_access=true` opens only the network. So the command uses no sandbox (`danger-full-access`). Use it only on a machine or a user account for tests.
- Run the command one time by hand before the first scheduled run, and read the result.

## macOS: launchd

Save as `~/Library/LaunchAgents/com.example.qa-daily.plist`. Change the label, the path and the command:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.example.qa-daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd /path/to/app &amp;&amp; mkdir -p qa/runs &amp;&amp; pi -p --skill /path/to/e2e-qa "Use the e2e-qa skill (/path/to/e2e-qa/SKILL.md). Do today's daily round (job 2) for the app in this folder. The QA folder is ./qa." &gt;&gt; qa/runs/agent.log 2&gt;&amp;1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
</dict>
</plist>
```

Load it with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.qa-daily.plist`. Check it with `launchctl list | grep qa-daily`. If the Mac sleeps at 06:00, launchd starts the job when the Mac wakes.

## Linux: cron

Add one line with `crontab -e`. The login shell (`bash -lc`) finds `node` and the agent command:

```cron
0 6 * * * bash -lc 'cd /path/to/app && mkdir -p qa/runs && npm --prefix qa run round >> qa/runs/cron.log 2>&1'
```

This is way B. For way A, put the agent command in place of `npm --prefix qa run round`. Cron uses the time zone of the machine.

## GitHub Actions (way C)

Save as `.github/workflows/qa-daily.yml`. Commit `qa/package-lock.json` first, because `npm ci` needs it:

```yaml
name: QA daily
on:
  schedule:
    - cron: "0 6 * * *" # UTC
  workflow_dispatch:
jobs:
  qa:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    defaults:
      run:
        working-directory: qa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run round
        env:
          QA_BASE_URL: ${{ secrets.QA_BASE_URL }}
          QA_PASSWORD: ${{ secrets.QA_PASSWORD }}
          QA_APP_DIR: .. # the app version in the report
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-round
          path: qa/runs/
```

- The test app must be reachable from GitHub, or the workflow must start it first.
- Put the address and the logins in the GitHub secrets of the repository, never in the file.
- GitHub-hosted runners need Actions minutes on the account. If GitHub does not start the job because of the billing, fix the billing, or use a self-hosted runner (`runs-on: self-hosted`).
- Each CI run starts with an empty `runs/` folder, so the report has no earlier round to compare with. The memory files (`turn-log.jsonl`, `COVERAGE.md`) also stay in the CI run only.

## Stop the daily start

The person decides when the daily QA stops. Remove the daily start, then check that it is gone:

| Way | Stop | Check |
|---|---|---|
| launchd | `launchctl bootout gui/$(id -u)/com.example.qa-daily`, then delete the plist file. | `launchctl list \| grep qa-daily` shows nothing. |
| cron | `crontab -e`, and delete the QA line. | `crontab -l` has no QA line. |
| GitHub Actions | `gh workflow disable "QA daily"`, or delete the workflow file. | `gh workflow list --all` shows the state `disabled_manually`. |

The `qa/` folder and its memory files stay. A new daily start continues from them.
