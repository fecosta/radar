# ADR 0001 — Controlled Drive writes stay client-side, on the user's own token

- **Status:** Accepted
- **Date:** 2026-08-14
- **Deciders:** RADAR owner (product decision recorded during implementation)
- **Affects:** `AGENTS.md` §8 (Drive safety), §11 (progressive release of write features)

## Context

RADAR was a read-only finder. Adding "Create structure" makes it capable of writing to the
Shared Drive, which `AGENTS.md` classifies as **high risk**: it requires backend
authorization, least privilege, dry run, explicit confirmation, idempotency, audit events,
partial-failure handling and a documented recovery plan.

The repository, however, is a pure client-side Vite + React SPA. There is no server, no
database, and no deployment target beyond static hosting. "Backend authorization" has no
existing home.

Three architectures were considered.

### A. Client-side, on the signed-in user's own delegated token

Keep the existing architecture. Request Drive write scopes incrementally when the
administrator opens the workflow. The authorization boundary becomes the Shared Drive ACL,
enforced by Google: a user who is not a Content Manager receives a 403.

### B. Apps Script web app as the privileged server

A natural organizational fit — the classifier was ported from an Apps Script, `AGENTS.md`
references one, and `LockService` would give real mutual exclusion. Costs: a second
deployment artifact outside this repository's build, untestable under vitest, CORS and
identity plumbing, and it runs as the deploying account's identity (a concern `AGENTS.md` §8
raises explicitly).

### C. Node/serverless backend with a service account

Satisfies every literal requirement. Costs: a new runtime, a new hosting target, and a
standing service-account credential that must be a member of the Shared Drive — a larger
blast radius than delegated user tokens, and a broad architecture change bundled with a
feature, which `AGENTS.md` §0.2 tells us to avoid.

## Decision

**Option A.** Writes are performed client-side with the signed-in administrator's own OAuth
token, obtained through incremental authorization.

## Rationale

1. **No new credential is created anywhere.** RADAR holds no service-account key, no client
   secret and no API key. It can only ever do what the signed-in person could already do by
   hand in the Drive UI. This is a strictly smaller blast radius than option C.
2. **The authorization boundary is real and server-enforced — by Google.** The Shared Drive
   ACL is the authority. This is not a client-side role claim that can be bypassed by editing
   JavaScript; it is an ACL check inside Google's infrastructure on every write.
3. **It preserves the repository's architecture.** No new framework, runtime or hosting
   target, consistent with `AGENTS.md` §0.2.
4. **Least privilege is still achievable.** Search and Classify keep `drive.readonly`; write
   scopes are requested only on entering the workflow, so ordinary readers never consent to
   them.

## The limitation we are accepting, stated plainly

**Plan hashing and pre-write revalidation are not security controls.**

In a client-side app on a delegated user token, the confirming user and any would-be tamperer
are the *same principal*. A signed-in administrator who wants to create arbitrary folders can
open the browser console and call the Drive API directly; no amount of client-side plan
validation prevents that, and pretending otherwise would be the dangerous part.

What those mechanisms actually buy:

- the plan hash catches inputs that changed between preview and confirmation (staleness) and
  bugs that would write something other than what was shown;
- pre-write revalidation catches Drive changing underneath a stale preview;
- neither is claimed to defend against a malicious authorized user.

Consequences we accept, all documented in `docs/operations/create-structure.md` and surfaced
in the UI rather than hidden:

- **Concurrency is narrowed, not eliminated.** The in-flight guard is module state in one
  browser tab. Two tabs or two administrators can still race, and Drive permits duplicate
  folder names. Execution re-checks afterwards and warns, but cannot prevent it.
- **`drive.file` is not usable.** Idempotency requires listing children of canonical parents
  the app did not create. The broader `drive` scope is required.
- **Environment variables are public.** They are identifiers, not secrets.

## What this decision does *not* relax

Every other high-risk requirement is implemented in full: read-only preview against live
Drive, explicit per-warning acknowledgement and a separate final confirmation, server-side-of-
the-browser-boundary plan regeneration from validated inputs only, idempotent execution,
Shared Drive containment checks on every created item, precise partial-failure reporting with
no false rollback claim, and a durable audit row per attempt.

Missing canonical roots are treated as blocking architecture drift and are never
auto-created.

## Revisiting this

Move to option B or C when any of these becomes true:

- a non-administrator needs to trigger creation (requires a real server-side policy check);
- concurrent creation by multiple administrators becomes routine (requires a real lock);
- the organization wants Drive writes attributable to a system identity rather than a person;
- lifecycle transitions (Pipeline → Portfolio, decline/archive) are implemented — these move
  existing content and are materially more dangerous than creating empty folders, and should
  not ship on this architecture.

> **Note (ADR 0004, 2026-08-27).** This trigger has been examined once and judged not to have
> fired. The *additive* half of the Portfolio transition — adding the operating folders 05-12 to
> an organization folder a human has already moved — now ships, and it moves no content: RADAR
> still has no `files.update` and no `addParents`. The **move itself remains unimplemented and
> human**, and this trigger stays in force for it and for decline/archive. See
> [ADR 0004](0004-portfolio-operating-folders-are-additive.md), which also records the
> properties of this architecture that the additive case does change.

The domain layer (`src/radar/`) and the port interfaces (`registryPort`, `auditPort`, the
Drive adapter) were kept free of React and of network concerns specifically so that a server
implementation can reuse them unchanged.
