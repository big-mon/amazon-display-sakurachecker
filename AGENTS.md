# AGENTS.md

## Start here

- Before running Node-based checks, install from the committed lockfile with `npm ci`.
- Live or extension E2E work: before the first run in an environment, install its browser with `npx playwright install chromium`.
- Product behavior or `README.md` changes: read [README.md](./README.md).
- Packaging or release work: read [DEPLOYMENT.md](./DEPLOYMENT.md).
- Browser UI or integration changes: read [tests/manual-browser-check.md](./tests/manual-browser-check.md).
- Privacy, permissions, storage, or external communication changes: treat [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) as the authoritative data-handling document and read [manifest.json](./manifest.json).
- Treat [package.json](./package.json) as the script/dependency source of truth and [manifest.json](./manifest.json) as the extension permission/runtime declaration.
- Keep developer workflow and verification guidance in this file; keep `README.md` focused on product behavior, user-facing claims, and pointers to the authoritative development and release documents.

## Runtime flow

Amazon content scripts extract the product ASIN and render the panel, then message `background.js`. The service worker checks the TTL-controlled local cache and, on a miss, opens an inactive Sakura Checker tab to inspect rendered results: Base64-ASIN `itemsearch`, detail page, and—only when required—the Amazon product-URL fallback. The temporary tab is closed after inspection.

## Invariants and safety boundaries

- Keep external communication limited to Sakura Checker. Never send Amazon page/review bodies or add telemetry.
- Preserve product-page-only score fetching and panel rendering; content scripts may load on other Amazon.co.jp pages but must remain inert there. Preserve cache validation/TTL, request coordination, temporary-tab cleanup, and cached-only `再取得` behavior.
- Do not broaden `manifest.json` permissions or host access without explicit justification.
- Keep deterministic gates free of live-site assumptions. `test:browser-compare` is opt-in investigation, never a required gate.
- Avoid runtime changes for documentation, CI, packaging, or dependency-only tasks.

## Change verification

Apply every matching row. Verification is complete only when every required command and relevant manual scenario has passed or is explicitly reported as skipped with its reason and residual risk.

| Change | Required verification |
| --- | --- |
| Docs/manual checks only | Resolve every changed relative link; verify every changed command against `package.json` or workflows; trace every changed behavior, privacy, permission, storage, and network claim to code or `manifest.json` |
| JS/runtime or deterministic fixtures | `npm test` |
| Dependency/lockfile | `npm ci`, `npm test`, `npm audit`, `npm audit --omit=dev` |
| Live parser behavior | `npm run test:live` |
| Extension UI/integration | `npm run test:e2e-extension` plus relevant manual scenarios |
| Release/package workflow | `npm run test:deploy`, then `npm run zip` only when packaging is intended |

`npm run zip` synchronizes `manifest.json` from the `package.json` version and writes `extension.zip`. A `package.json` version change pushed to `main` triggers the deployment workflow, so do not bump versions or run release steps unless requested.

## Completion report

List changed files and runtime impact. Report verification as explicit pass and skip counts; name every command/scenario, and give a reason and residual risk for each skip. Do not commit unless asked.
