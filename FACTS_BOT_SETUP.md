# FACTS_BOT_SETUP.md — wiring the Layer-4 CI trust boundary

This is the **one-time, human-performed** setup that turns on the hard trust boundary: a GitHub App
("facts-bot") that is the *only* identity allowed to write canonical `.facts` on `main`. Until this is
done, the local gates (hooks, lint, `local-promote`) work fully — but promotion is unenforced by an
independent identity. Do this **before merging the first real PR**.

Why an App and not a PAT: the App gives the promotion commits their own non-human identity
(`facts-bot[bot]`), which the branch ruleset can single out as the sole writer of `.facts`. A human PAT
can't be distinguished from the human.

---

## Prerequisites
- The repo is pushed to GitHub (`gh repo create smithtownmap --private --source=. --push`, or a manual
  remote). You have admin on it.
- `gh` CLI authenticated (`gh auth status`).

---

## Step 1 — Register the GitHub App
GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**.

- **Name:** `smithtownmap-facts-bot` (must be globally unique; adjust if taken).
- **Homepage URL:** the repo URL.
- **Webhook:** *uncheck* "Active" (no webhook needed).
- **Repository permissions:**
  - **Contents: Read and write** (to push the promotion commit).
  - **Issues: Read and write** (to open the re-verification-failure issue).
  - Everything else: No access.
- **Where can this App be installed?** "Only on this account."
- Click **Create GitHub App**.

## Step 2 — Capture the App ID and a private key
- On the App's page, note the **App ID** (a number).
- **Generate a private key** → downloads a `.pem`. Keep it secret; you'll paste it once below.

## Step 3 — Install the App on the repo
- App page → **Install App** → choose your account → **Only select repositories** → pick `smithtownmap`
  → **Install**.

## Step 4 — Store the credentials in the repo
The workflow reads `vars.FACTS_BOT_APP_ID` and `secrets.FACTS_BOT_PRIVATE_KEY` (see
`.github/workflows/promote-facts.yml`).

```bash
# from the repo root
gh variable set FACTS_BOT_APP_ID --body "<the App ID number>"
gh secret   set FACTS_BOT_PRIVATE_KEY < /path/to/downloaded-key.pem
```

(Or via the UI: Repo → Settings → Secrets and variables → Actions → "Variables" tab for the App ID,
"Secrets" tab for the private key.)

## Step 5 — Protect `main` and make the bot the sole `.facts` writer
Repo → **Settings → Rules → Rulesets → New branch ruleset**:

- **Target:** `main`.
- **Require a pull request before merging** (so humans never push `.facts` directly).
- **Require status checks to pass:** add `spec-staging-lint` and `test-quality-lint`.
- **Restrict who can push / bypass:** add the **facts-bot app** to the **bypass list** — its `[skip ci]`
  promotion commit pushes straight to `main` after merge. Humans stay gated behind the PR.
- (Optional, stricter) A **push ruleset** restricting modifications to the `.facts` path to the
  facts-bot app only. GitHub path-scoped push rules are limited; the PR-gate + bypass list above is the
  practical equivalent and is what `promote-facts.yml` assumes.

## Step 6 — Confirm the workflow targets `main`
Already retargeted during the port — verify:
```bash
grep -n "branches:" .github/workflows/promote-facts.yml   # → [main]
```

---

## Step 7 — Smoke-test the boundary (end-to-end)
1. Branch, implement one Phase-1 capability to green, `bun run facts:promote <id>` locally
   (evidence `promoted_by: local-promote`), and open a PR.
2. Merge the PR. On merge, **promote-facts.yml** fires: the App mints a token, re-runs the fact's
   command independently, and — if green — rewrites the fact into `.facts` with
   `promoted_by: facts-bot[bot]` and pushes a `chore(facts): promote … [skip ci]` commit.
3. Verify: `git pull` and confirm the fact in `.facts` shows `promoted_by: facts-bot[bot]`. That commit's
   author is `facts-bot[bot]` — proof the trust boundary is live.
4. **Negative check:** push a hand-edited `.facts` to a PR; the local `protect-facts` hook should have
   blocked it locally, and on `main` only the bot's identity can land such a change.

If a staged fact fails CI re-verification, the bot **does not** promote it and opens a
`facts-bot / needs-attention` issue listing the failures. The fact stays `@spec` in `.facts.staging`.

---

## What can't be automated here
Steps 1–5 require a human with repo-admin in the GitHub UI (App registration, key generation, ruleset).
There is no API path that fully self-provisions a GitHub App's identity for its own repo. Everything
downstream (token minting, re-verification, promotion, issue-on-failure) is automated in
`scripts/ci-promote-facts.ts` + `promote-facts.yml`.
