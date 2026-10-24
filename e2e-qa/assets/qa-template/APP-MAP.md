# App map: <app name>

The QA agent writes this file. Each fact has a source: a file and line, a REA result, or "the person said". "unknown" means that nobody checked it yet.

## The app

- What it does, in 2 lines:
- Users and roles:
- Source folder:
- Test address (never the live app):
- Start the test copy:
- Reset the test data:
- REA: auto, on or off. What REA added:

## Pages (frontend)

| Address | What a user does there | Source |
|---|---|---|

## API routes (backend)

| Method and path | Login or role | Input | Answer | Source |
|---|---|---|---|---|

## Login

- How a session starts:
- Test logins (names only, the passwords are in `.env`. Write "one shared password" when the app has no user names):

## Data

- Main records and how they connect:

## External effects

| Effect | How the test copy stops it | Source |
|---|---|---|

## Not tested

- Flows that the QA tests do not cover, and why:

## Risks

| Area | Why it is risky | Source |
|---|---|---|

## Coverage plan

- Areas (the names of the spec files):
- Core frontend journeys, ranked by risk (at most 10 turns):
- Core backend journeys, ranked by risk (at most 10 turns):
