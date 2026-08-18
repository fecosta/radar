# ADR 0002 — Multi-organization sign-in, with Google Drive as the individual authorization boundary

- **Status:** Proposed — requires RADAR Owner review and approval before it is promoted to
  Accepted. Nothing in this repository records that approval yet.
- **Date:** 2026-08-17
- **Deciders:** RADAR owner (pending)
- **Affects:** ADR 0001 (extends its authorization model to sign-in), `AGENTS.md` §8 (Drive
  safety), `README.md` setup step 3, `docs/operations/access-control.md`

## Context

RADAR authenticates with Google Identity Services and calls Drive from the browser on the
signed-in user's own `drive.readonly` token. Until now the application gate was a single
condition: *is there a token?* Any Google account able to authenticate against the client ID
reached the full signed-in UI.

That was tolerable only because of an assumption stated in one line of the README — the OAuth
consent screen is **Internal**, so Google itself refused everyone outside the Workspace. The
assumption is now wrong. RADAR must admit users from more than one organization: `ver+` staff,
`Democracia+`, and partner organizations added over time.

Removing the Internal restriction without adding anything else would leave RADAR's front door
open to every Google account in existence. Some organizational gate has to replace it.

Three architectures were considered.

### A. Approved-domain gate in the client, plus a mandatory Shared Drive check

Read a configured list of approved domains at build time, compare it against the verified
email from Google's userinfo response, and — only if that passes — ask Google whether this
specific account can reach the configured Shared Drive. Both must succeed.

### B. Domain gate only

Approve domains and let Drive permissions handle the rest implicitly, without an explicit
check. Simpler, and it is what an Internal consent screen effectively did.

### C. Server-side or edge authorization layer

Move the decision behind a service that the browser cannot modify: a proxy, an edge function,
or a backend session. Makes the domain rule tamper-resistant rather than advisory.

## Decision

**Option A.** Access requires all three of:

```
verified Google identity  AND  approved organization domain  AND  Shared Drive access
```

The three layers answer three different questions and must not be collapsed:

| Layer | Question | Authority |
|---|---|---|
| Google OAuth | Who is this? | Google |
| RADAR allowed-domain rule | Is this organization one we accept identities from? | RADAR configuration |
| Google Shared Drive | May this individual account read RADAR data? | Google Drive ACL |

RADAR keeps no list of authorized people. It knows about organizations; Google knows about
individuals. Approving a domain grants nobody anything.

## Rationale

1. **No duplicate ACL is created.** The alternative — a list of authorized emails in the app —
   would immediately drift from Drive, and the drifted copy would be the one making decisions.
   Administrators keep provisioning exactly where they already do: Google Workspace and Drive.
2. **The hard boundary is unchanged and server-enforced.** As in ADR 0001, the real check is
   an ACL evaluation inside Google's infrastructure on every request, against the signed-in
   user's own token. Adding partner organizations does not widen it by one file.
3. **Revocation keeps working the way administrators expect.** Removing someone from the
   Shared Drive removes their access to RADAR data, with no deploy and no code change.
4. **Restricted areas are untouched.** The `radar-*` Google Groups continue to govern Finance,
   Legal, People, Leadership and Board folders. RADAR does not read, mirror or manage those
   memberships, so entering the application still grants nothing beyond what Drive allows.
5. **It preserves the architecture.** No backend, no database, no session layer, no service
   account, no client secret — consistent with ADR 0001 and `AGENTS.md` §0.2.
6. **Option B was rejected** because a domain gate alone authorizes an entire organization.
   The Drive check is what keeps authorization *individual*, and it is the only one of the two
   that an attacker cannot bypass. It is therefore mandatory, and must never be treated as an
   optimization of the domain check.

## The limitation we are accepting, stated plainly

**In a static client-only application, the domain allowlist is an application gate, not a
security boundary.**

`VITE_RADAR_ALLOWED_DOMAINS` is compiled into a publicly readable bundle. A technically
sophisticated user can read it, edit the running JavaScript, and make the domain check return
true. Claiming otherwise would be the dangerous part.

What that person gains is nothing, and the reason matters: past the domain check sits a
`drives.get` against the configured Shared Drive on **their own** OAuth token. Google evaluates
their actual permissions and refuses. Every subsequent request in the application is subject to
the same evaluation. Bypassing the domain gate buys entry to a UI that can read no data.

This is precisely why option A pairs the two checks rather than choosing between them:

- the domain rule is **organizational policy**, enforced honestly for honest users, and it is
  what makes a refusal explainable — "your organization is not authorized" rather than an empty
  file list;
- the Shared Drive check is **security**, enforced by Google, and it is not optional.

Consequences we accept:

- **The allowlist is public.** It is an identifier list, not a credential — the same reasoning
  `.env.example` already applies to the client ID and the Drive id.
- **Changing it requires a rebuild.** Vite inlines environment values at build time, so
  offboarding an organization is a deploy. Offboarding an *individual* is not: that is a Drive
  permission change and takes effect immediately, which is the case that actually needs to be
  fast.
- **RADAR has no verified organization claim.** `initTokenClient` returns an access token, not
  an ID token, so there is no signed `hd` claim to check. The email comes from Google's userinfo
  endpoint over TLS on the user's own token. Good enough for an application gate; it is not
  relied on as the security boundary, per the above.

## What this decision does *not* relax

- **No provisioning, ever.** RADAR does not add anyone to a Shared Drive, does not modify Drive
  permissions, and does not touch Google Group membership. There is no permissions write and no
  Admin SDK call anywhere in the codebase. An approved domain triggers no grant of any kind.
- **No new scopes.** The check runs on the existing `drive.readonly`. The write scopes from
  ADR 0001 are still requested incrementally and only for Create structure.
- **Fail closed, everywhere.** Missing configuration, an unreadable profile, a malformed email
  and an unreachable Google all deny access. An empty allowlist admits nobody.
- **A failed check is not a denial.** A network error reports that RADAR could not verify
  access and offers a retry. Telling someone they lack permission when Google was simply
  unreachable would send them to an administrator who has nothing to fix.
- **No token persistence.** Still memory-only: no `localStorage`, no `sessionStorage`, no
  cookie, no IndexedDB.

## Revisiting this

Move to option C when any of these becomes true:

- the domain rule must be enforced against a determined insider, not merely applied to honest
  users — for example if RADAR ever renders data that does not come from Drive, at which point
  the Drive ACL stops being the effective boundary;
- an organization must be offboarded faster than a redeploy allows;
- access decisions need to be audited centrally rather than observed per-user;
- RADAR gains a feature whose authorization cannot be expressed as a Drive permission.

The domain rule is a pure function in `src/utils/allowedDomains.js` and the Drive probe is an
isolated service in `src/services/driveAccess.js`, both free of React, so a server
implementation can reuse them unchanged.
