# Owner-private Wine candidate

The public v1.205 build and release are preserved. This branch deliberately starts
from main rather than merging PR #7. Its unavailable-state wording is useful for
a separate public fallback release; its static snapshot is not used as live data.
The default build resolves the original public supplies and version modules. Only
`pnpm build:private` resolves the private live client and private version; output
is `.private-dist/` (ignored). Never upload that directory to Pages.

## Boundaries and commands

- `pnpm test`: public navigation plus private client tests with synthetic fetch.
- `pnpm test:private-api`: Python tests with synthetic Notion/identity responses
  and an actual unprivileged Unix-socket deny test.
- `pnpm build`: public build and fixed destination/privacy scan, also rejecting
  the private endpoint/client/version.
- `pnpm build:private`: isolated private build with no owner/device/source policy.
- `node scripts/private-browser-check.mjs`: loopback private-build browser checks
  with an intercepted synthetic API. This is not real-source acceptance.
- `python3 private/deploy/stage.py`: stage a private artifact and hash manifest;
  does not install a unit, activate a listener or modify Serve.

`server/wine_private.py` accepts only a private Unix socket, requires root proxy
peer credentials and exact forwarding context, owner login and approved stable
node ID via Tailscale LocalAPI whois. Node authorization/key expiry and a bounded
owner-policy expiry are rechecked each request. It rejects missing identity with
401, other identity/origin failures with 403, and unapproved methods with 405.
No CORS is emitted. A custom client header and same-origin fetch context are
required for the fixed read API. Owner access applies to assets as well as data.

The source page and immediate parent are pinned in a protected runtime policy,
never source or browser configuration. Notion requests are GET-only to the fixed
HTTPS Notion host with a pinned API version. No redirect or environment proxy is
used. Native-block pagination has time, page, block, depth, size and item bounds.
The reader identifies one winemaking H2, stops collection at the next H2/H1,
rejects missing/ambiguous sections, and returns only unchecked native purchases.
Rich text is flattened; links, identifiers, credentials, markup and controls are
removed. Quantities are parsed generically, approximations retained, conditions
preserved, and unclear amounts classified for review. No item dataset is built in.
Each successful refresh reads Notion anew; no disk/browser purchase ledger or
server stale cache exists. Errors cannot advance the client's success timestamp.

The unit template uses a protected systemd credential and protected runtime
socket directory. The token-entry helper is owner-run and never echoes, logs or
overwrites a token. No token is supplied through arguments, repository, browser,
chat or copied agent authentication. Policy and secret files are not included in
staged artifacts. Deployment must require owner confirmation of read-only,
single-source permissions; an API token cannot itself prove its granted scope.

## Activation gate (not automatic)

1. Obtain the owner's explicit device selections; resolve current stable IDs
   from the tailnet, rather than guessing from labels. Prepare the owner-only
   runtime policy with exactly those IDs, origin, source/parent pins and approved
   expiry. Private values and live host details stay in the private LifeOS Task.
2. The owner creates a read-content-only Notion internal connection and adds it
   only to the existing shopping Task. If this requires wider database access,
   stop. The owner enters the token through the terminal helper. No production
   purchase edits for tests are included in this authorization.
3. Review tests, scan both builds, verify the private artifact hashes and unit
   hardening; take private Serve/current-release backups and prove the candidate
   port is unused. Preserve all existing handlers, including diagnostic routes.
4. Install only the Wine unit and an isolated new HTTPS origin with no Funnel.
   Treat the first activation as provisional: verify actual proxy/header/whois
   behavior, authorized and denied requests, no unrelated data, response headers,
   hashes, service health and served browser behavior. Roll back the new Wine
   service/endpoint if any gate fails. Never alter other handlers or broad ACLs.
5. Perform real Notion-to-browser read acceptance; agree owner-performed temporary
   source changes before add/check acceptance. Synthetic tests cannot replace it.
   Physical iPad/iPhone access remains separate from viewport emulation.

For a first installation rollback, remove only the newly added Wine HTTPS port
(after checking it contains only the Wine handler), then stop/disable only the
Wine unit. Preserve the staged candidate and evidence. For later releases restore
the previous Wine symlink and restart only Wine. Exact commands, selected origin,
private policy and backup hashes belong in the private Task. No script here is
permission to change unrelated routes or services.
