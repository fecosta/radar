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

Read a configured list of approved domains at build time, compare it against the email Google
reports for the signed-in account, and — only if that passes — ask Google whether this specific
account can reach the configured Shared Drive. Both must succeed.

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
- **RADAR has no signed organization claim.** `initTokenClient` returns an access token, not an
  ID token, so there is no signed `hd` claim to check. The email is read from the Drive API's
  `about.get` over TLS on the user's own token. Good enough for an application gate; it is not
  relied on as the security boundary, per the above.

  The OpenID Connect userinfo endpoint would be the conventional source and is deliberately not
  used: it requires `openid`, `email` or `profile`, and RADAR's token carries only
  `drive.readonly`. Reading identity from Drive instead keeps the token at one scope, spares
  every existing user a fresh consent prompt, and has a property worth stating — the email the
  domain rule judges and the ACL that enforces access now come from the same authority.

  This was not a free choice made up front. RADAR called the userinfo endpoint until
  2026-08-18, where it had been failing on every request since the feature was written: the
  failure was swallowed, `user` was always null, the navbar rendered blank and the Create
  structure audit trail recorded `Actor: unknown` for every operation. The access gate is what
  surfaced it.

- **The premise is not free, and this ADR originally failed to say so.** "Partner organizations
  can authenticate" reads as though RADAR's own configuration were the only gate. It is not. The
  Google OAuth audience decides who may even reach RADAR, and because `drive.readonly` is a
  Google **restricted** scope, opening it to accounts outside the publisher's Workspace carries a
  cost that has to be chosen rather than assumed:

  | Route | Verification | Limits |
  |---|---|---|
  | Internal audience | none | own Workspace only — refuses partners with `Error 403: org_internal` |
  | External + Testing | none | 100 test users listed by hand; unverified-app screen for every user |
  | External + admin-trusted | exempt per Google, though its docs are inconsistent | one admin task per participating organization |
  | External + In production | required, incl. annual **CASA** third-party assessment (~$500–$4,500) | none |

  **RADAR runs External + Testing.** This was discovered the honest way: the first
  `democraciamas.com` sign-in attempt, on 2026-08-18, was refused by Google with `org_internal`
  while the audience was still Internal. Two consequences we accept:

  - **Nobody is admitted automatically any more, including the publisher's own staff.** Leaving
    Internal means every user must be on the test-user list; an account missing from it is refused
    with a 403 `access_denied`, again before RADAR loads.
  - **Onboarding a person is two independent manual steps** — a test-user entry and a Shared Drive
    grant. Neither implies the other, which is the same "eligibility is not access" separation this
    ADR argues for, now applying one layer further out.

  The 100-user cap is a live constraint at the expected scale of 25–100 users, not a theoretical
  one. It is a stopgap, and the exits are recorded under *Revisiting this*.

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

### The Google publishing route

Leave External + Testing when any of these becomes true:

- the test-user list approaches **100 users** — at 25–100 today, this is the trigger most likely to
  fire first, and it fires as a hard refusal for user 101 rather than a warning;
- adding a user by hand for every person becomes an unacceptable onboarding cost;
- the "Google hasn't verified this app" screen becomes unacceptable to a partner organization —
  a reasonable objection from an external admin, and not one that can be argued away.

Move to **Workspace admin-trusted** first: it is free, fits a private tool used by a few known
organizations, and needs one admin action per organization. Move to **verification + CASA** only
when RADAR must serve an audience too large or too unknown for either of the above — it is the
only route that removes both the cap and the warning, at a recurring cost.

Neither move touches RADAR's code or configuration. The client ID does not change.

### The architecture

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
