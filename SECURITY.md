# Security

## Report a security problem

Do not open a public issue for a security problem. Use [a private report on GitHub](https://github.com/inde3d100/e2e-qa/security/advisories/new) instead.

## What counts

- The skill or its scripts leak a secret, for example the test login in `qa/.env`.
- The instructions can make an agent test a live app, or send real email, SMS, payments or posts.
- A script can delete or change files outside the `qa/` folder.

## What does not count

The demo app has bugs on purpose. [The known bugs page](docs/demo-known-bugs.md) lists them. Never run the demo app on a public address.

## Safe use

- Give the agent a test copy of your app, with made-up data.
- Keep `qa/.env` out of git. The `.gitignore` of the template does this.
- Run an agent with no sandbox, for example Codex with `danger-full-access`, only on a machine for tests.
