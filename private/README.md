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

`server/wine_private.py` accepts only a private Unix socket, verifies the actual
LocalAPI daemon's kernel peer identity and exact forwarding context, owner login and approved stable
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

## Compatibility gate and defensive correction

Private v1.207-private.2 tightens identity validation: machine authorization must
be the Boolean `true`, the positive numeric Node.User must equal UserProfile.ID,
and the forwarded source must equal a node host prefix (/32 or /128), rather than
merely belong to a reported subnet. Missing, malformed or mismatched evidence is
denied. This does not resolve the peer-machine authorization compatibility gate.

Tailscale v1.104.5 declares Node.MachineAuthorized with JSON `omitempty`; omission
cannot distinguish false from unavailable peer evidence. Its LocalAPI WhoIs
returns a node/profile lookup, rather than a separate machine-approval assertion.
Neither network-map membership nor online status is a replacement. See the
[matching type](https://github.com/tailscale/tailscale/blob/v1.104.5/tailcfg/tailcfg.go),
[WhoIs implementation](https://github.com/tailscale/tailscale/blob/v1.104.5/ipn/localapi/localapi.go),
[device approval documentation](https://tailscale.com/kb/1099/device-approval) and
[Serve identity documentation](https://tailscale.com/kb/1312/serve).

## Namespace-aware proxy identity — v1.207-private.3

Systemd's per-user filesystem sandbox can leave host root unmapped, so the
daemon's UID appears as the kernel overflow UID inside the application. Keep
the sandbox and private socket directory/modes; neither UID zero nor the overflow
UID alone authenticates a proxy. No service-template protection was removed.

Each request now obtains SO_PEERCRED and SO_PEERPIDFD evidence for both the incoming
connection and a fresh connection to the fixed `/run/tailscale/tailscaled.sock`.
The full kernel credential tuples must match and both process handles must remain
alive. The handles come directly from their sockets, never a cached PID or
pidfd_open(PID), so numeric PID reuse cannot revive old evidence. A dead daemon,
restart, mismatched peer, missing kernel/proc evidence or LocalAPI failure denies
the request. Liveness is checked around whois and before returning data/assets.

The LocalAPI path is anchored by an O_NOFOLLOW directory walk from `/`, requiring
root ownership as visible in the current UID namespace and no group/world-writable
parent directories. The final file must be a root-owned Unix socket. It is pinned
with O_PATH and dialed through `/proc/self/fd`, preventing a pathname substitution
between validation and connect. The verified connection also performs whois;
automatic reconnection is disabled. No alternate path, environment override or
unverified transport fallback is available. Host root and the host-controlled
filesystem/mount namespace remain trust anchors; an attacker controlling those
can replace the application itself.

This Linux-only check requires kernel SO_PEERPIDFD support and readable proc
namespace/fdinfo evidence. Python versions without the symbolic constant use the
Linux UAPI value 77; unsupported kernels fail closed. Tests include real process
death/restart and same-UID mismatch, simulated numeric PID reuse with a real exited
handle, socket/path spoofing, missing evidence, bounded LocalAPI failures, and
HTTP checks that a verified proxy cannot bypass machine authorization.

In v1.207-private.3, `MachineAuthorized is True` remained mandatory without an
omitted-field fallback. Exact
owner/device/address/expiry/tag, forwarding and origin checks remain in force.
Actual host evidence, device results and private operational values belong only
in the authorized release records. Activation, remote-device ingress and live
browser refresh remain separate gates.

## OAuth authorization compatibility — v1.207-private.4

Only an omitted LocalAPI MachineAuthorized field can invoke Device API fallback.
An explicit false or malformed value always denies without a control-plane call.
All existing owner, numeric user identity, allowed StableID, exact forwarded host
address, untagged status, key/policy expiry and trusted proxy/origin checks still
apply. The Device API provider independently restricts calls to the runtime-policy
allowlist; no real identifiers are compiled into either build.

The server makes a fresh GET to the fixed HTTPS device endpoint for that StableID
and requires explicit Boolean authorized=true. The returned nodeId, owner,
addresses, node key and future expiry must agree with LocalAPI. Nonempty or
malformed tags, stale Date/Age, errors, redirects, malformed/oversized/missing
responses and contradictory identity deny. Successful device status is never
cached. Device metadata is never included in the app response.

The dedicated OAuth client must have only devices:core:read, with no tags or other
scopes. `private/deploy/enter-tailscale-oauth.py` is an owner-run terminal helper:
both values use hidden input, echo fallback is prohibited, the existing directory
must be owner-only 0700, files are exclusively created 0600, and existing values
are never overwritten. The unit loads tailscale-oauth-id and
tailscale-oauth-secret with LoadCredential alongside the existing Notion token.
Never pass a value through shell arguments/environment, Git, logs or the browser.

Derived access tokens are requested for that exact scope, validated for token type,
scope and bounded lifetime, kept only in process memory, and renewed before expiry.
The only POST allowed is OAuth token exchange; the only Device API operation is
an allowlisted GET. No listing, device writes or auth-key operations exist. Core
dumps are disabled in the dedicated unit and entry helper. Fixed-host stdlib HTTPS
does not follow redirects or use environment proxies. Credential/scoping, actual
Device API proofs, real ingress and deployment gates must be verified separately;
synthetic tests do not authorize activation.
