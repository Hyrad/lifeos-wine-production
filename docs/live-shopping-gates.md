# Live shopping integration — release gates

WINE-SUPPLIES-02 is blocked at security preflight. The draft frontend makes the
existing snapshot's limitations visible and demotes the generic checklist route.
It does not implement or simulate a live refresh. Production remains v1.205.
Private source identifiers, hostnames, account identities and provisioning paths
belong only in the existing private implementation Task and release checkpoint.

## Prerequisites requiring separate authorization

1. Approve the owner identity/device policy and an isolated private origin for
   Wine Production. Verify authorization at the backend; tailnet membership alone
   is insufficient. Different URL paths on one host/port do not isolate scripts.
2. Approve a read-only Notion connection restricted to the authorized shopping
   source. Verify actual content permissions before use; never reuse an agent's
   connector credentials. The existing source contains unrelated groceries, so
   application filtering remains mandatory even with narrow source access.
3. Approve the private service and exact routing changes, with rollback. Install
   credentials outside source, builds, client storage, command arguments and logs.
   No credential installation, permission changes, service activation or routing
   changes are included in this draft.

## Backend acceptance before frontend connection

- Accept only the fixed read endpoint; never accept arbitrary page/block IDs from
  clients. Enforce the approved owner policy before reading Notion or returning
  any shopping data. Reject spoofed identity headers and direct backend bypasses.
- Read the pinned source's native blocks using pagination. Locate the configured
  winemaking heading and stop at the next same-level heading (or higher-level
  boundary). A missing or ambiguous section is an error, not an empty list.
- Include only unchecked native checkbox items within that section. Preserve
  varying rich-text content as safe text, including conditional restrictions and
  purchasing qualifiers. Do not infer purchases from recipe additions or amounts
  mentioned in explanatory paragraphs. No item-specific hardcoded quantities.
- Return only item name, quantity/unit, purpose, purchasing restrictions,
  conditional/confirmed/review-needed classification and successful fetch time.
  Preserve approximations; do not invent a quantity or classify an ambiguous
  condition as confirmed. Strip private links, mention IDs, raw blocks and page
  metadata. Render returned strings as text.
- Bound timeouts, pagination, response size, rate and concurrency. Fail safely
  without raw upstream errors, secrets or source IDs in client responses/logs.
  Use no-store private responses. Verify the approved origin policy rather than
  enabling broad CORS. Public builds must not fetch or contain private data.

## UI and real-source acceptance before release

Add **Refresh from LifeOS** only when it triggers the verified authenticated
reader. Separate confirmed and conditional items. Display loading, success,
offline, timeout, denied-access, malformed-response and empty states. Advance the
last-successful-refresh timestamp only after a complete successful fetch; a
failed refresh must leave any previous results visibly stale. An empty successful
response clears the previous list. Do not persist a separate purchase ledger.

Verify in the authenticated browser that a newly added test purchase appears and
a checked purchase disappears on the next refresh, without a rebuild. Agree on
temporary source edits and cleanup before performing them. Verify unrelated and
completed items never appear, including pagination and section boundaries.
Mocks can test failures but cannot establish live integration.

Run unauthorized, foreign-user, spoofed-header, wrong-origin and direct-listener
tests. Preserve recipe, production and Home navigation, keyboard access, large
touch targets, iPhone/iPad layouts, accessibility and the public artifact privacy
scan. Confirm real device access separately from viewport emulation.

## Current evidence and rollback

Implemented in this draft: unavailable/older-snapshot copy and a collapsed,
explicitly labeled route to shared Notion Tasks. Live read, conditional live
results, authentication enforcement, network-state handling and real-source
add/check acceptance are **not implemented or verified**.

Keep this PR unmerged and the public site at
`5febad43eee4ccb7a3913baa39bedcc4a19a0235` (v1.205) until applicable gates pass.
No production rollback is currently needed. A later release must preserve this
commit as the known public rollback and document private-service rollback in the
private implementation Task.
