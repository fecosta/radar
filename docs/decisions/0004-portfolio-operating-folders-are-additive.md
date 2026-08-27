# ADR 0004 — Portfolio operating folders are additive; the lifecycle move stays human

- **Status:** Proposed. Decisions 2, 3 and 4 are partly superseded by
  [ADR 0005](0005-legacy-portfolio-objects-only-on-proven-absence.md) for the from-scratch case;
  the additive structure described here is unchanged.
- **Date:** 2026-08-27
- **Deciders:** RADAR owner. **Approval is not yet recorded.** This ADR must not be marked
  Accepted, and the feature must not be deployed to the production Shared Drive, until the
  owner approves both this decision and the specification amendment in *Outstanding* below.
  Approval basis offered: the approved **RADAR v06 Canonical Folder Tree — Automation
  Specification** (`docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`), PORTFOLIO CREATION
  RULE clause 3 and the EMPTY STRUCTURE CREATION RULE's Portfolio note.
- **Affects:** `AGENTS.md` §3 invariant 9 (approval moves the folder and adds operating
  folders), §5 (risk), §8 (Drive safety); ADR 0001 (client-side controlled writes);
  `CLAUDE.md` non-negotiable rules on Portfolio and Drive safety.

## Context

`Create structure` offered six structure types and refused Portfolio entirely. The refusal was
correct about the danger and too broad about the rule. The PORTFOLIO CREATION RULE (spec
L229-232) has three clauses:

> - Move existing Pipeline folder to Portfolio; do not create/copy a new object folder.
> - Preserve Sourcing, Screening/Concept Review, Diligence/Investment Committee, and Legal Due Diligence history.
> - Add subfolders 05-12 after approval.

Clauses 1 and 2 were enforced. Clause 3 was not implemented at all, and the specification's own
note about this tool (L394) states the intended split directly:

> Portfolio note: do not create a separate Portfolio object from scratch. When a Pipeline
> organization is approved, follow the Portfolio Creation Rule: move the existing Pipeline
> folder to Portfolio and add the Portfolio operating subfolders while preserving history.

The gap was user-visible. `Classify` already resolved the full Portfolio `00`–`12` path set
(`src/utils/radarClassify.js:248-272`), so RADAR would tell someone to file a disbursement in
`02_PORTFOLIO/Education/Aprendo+/08_Disbursements` — a folder that did not exist and that RADAR
offered no way to create. Two features of the same tool contradicted each other.

## Decision

### 1. A seventh structure type that adds folders and creates no object

`portfolio_operating_folders` — "Portfolio operating folders" — collects an organization name
and a theme, and creates exactly `05_Onboarding`, `06_Investment_Docs`, `07_Execution`,
`08_Disbursements`, `09_Reports`, `10_MEL_Evidence`, `11_Photos_and_Videos`,
`12_Decisions_and_Transitions` inside an organization folder that a human has already moved
into Portfolio.

The id is deliberately **not** `portfolio_organization`. That name denotes the object-creating
structure clause 1 forbids, and `structureInputs.test.js` still asserts it is unsupported.

### 2. The object folder is unreachable, not merely blocked

The safety property is structural rather than procedural. A template's destination now has
three parts:

| part | meaning | failure |
|---|---|---|
| `parentSegments` | canonical architecture | `MISSING_CANONICAL_PARENT` — drift, never repaired |
| `requireExistingSegments` | a folder a human must have moved | `OBJECT_FOLDER_NOT_FOUND` — a workflow step has not happened |
| `createdSegments` | what the plan creates | — |

For this type `createdSegments` is **empty** and the organization folder sits in
`requireExistingSegments`. Because `expandTemplate` derives plan items from `createdSegments`
and `nodes()`, the object folder is never a plan item — so `createFolder(parent, objectName)`
is not a call that exists to be guarded. A runtime check was the alternative and was rejected:
it would leave the forbidden write reachable and protected only by correct placement.

Resolving the object folder in the preview also fixes a defect the alternative would have
shipped: `canAddChildren` now probes the folder RADAR actually writes into, rather than the
theme container above it.

### 3. The destination guard judges outcomes, not structure types

`FORBIDDEN_DESTINATION_SEGMENTS` — a flat prefix list — became
`forbiddenDestinationReason(destination, items)` with three type-blind rules:

- **A.** Nothing may be created anywhere under `99_ARCHIVE`. No exceptions: unlike Portfolio
  there is no additive archive structure, and the decline transition genuinely moves content.
- **B.** A plan whose destination is under Portfolio must have an empty `createdSegments`.
- **C.** No planned item's `fullPath` may be a Portfolio object folder (exactly four segments
  deep), which catches a template that hides the organization name outside `createdSegments`.

A per-type exemption flag was rejected as the obvious hole: a new template would only have to
add itself. These rules describe the forbidden *outcome*, and are strictly stricter than the
list they replace — all seven structures satisfy them.

### 4. RADAR writes nothing to the Master Registry

`registry.applicable` is `false`, so no upsert runs. The reason is mechanical as well as
principled: `registrySheet.js:69-89` matches a row on Object_Name + Theme + **Object_Type**, so
an upsert under a Portfolio type would not find the object's existing `Pipeline` row and would
**append a duplicate** — two rows for one object, in the register the specification requires to
be singular. The specification is also explicit that "Human action determines status/type" and
that automation "does not infer investment decisions".

Instead the plan carries `REGISTRY_TRANSITION_REQUIRED`, which the administrator must
acknowledge before the write and which is restated on the result screen and recorded in the
audit row. Plan advisories are now restated in the result generally, which also makes true an
existing claim in `create-structure.md` about the restricted-folder advisory.

### 5. Existence alone is not evidence of preserved history

"The folder exists" cannot distinguish a folder moved with its history from an empty shell
someone created by hand — and helping RADAR populate a shell would produce exactly the
rebuilt-instead-of-moved object clause 1 forbids. The preview therefore probes for retained
history (`01_Meetings`, `02_Sourcing`, `00_Overview_and_Contacts`, and the Venture Building
equivalents, since design rule 9 also moves ventures into Portfolio) and raises
`NO_RETAINED_HISTORY` when it finds none.

This is an acknowledgement, not a block, because the evidence is heuristic: a legacy
organization may hold its record under non-canonical names, and hard-blocking would strand a
legitimate object with no way forward. It is raised only in the suspicious case, so it never
becomes a checkbox ticked by reflex.

### 6. A structure's own destination is not a lifecycle conflict

The Portfolio lifecycle scope is this type's own destination, so it would have matched on every
run and forced the administrator to acknowledge "its lifecycle should move the existing folder
rather than create a new one" — the opposite of what they are doing. The scan now skips the
scope equal to the plan's own destination, derived from the plan rather than keyed on type. The
declined-archive and Exploration scopes still apply, because an object in Portfolio that is
also filed as declined is genuine drift.

## Why ADR 0001's blocker does not apply

ADR 0001 (L105-107) says to leave this architecture when "lifecycle transitions (Pipeline →
Portfolio, decline/archive) are implemented", because they "move existing content and are
materially more dangerous than creating empty folders".

Nothing here moves content, and nothing can: `driveStructureApi.js` exposes only
`verifySharedDrive`, `findExactChildren`, `resolvePath`, `canAddChildren`, `createFolder` and
`createGoogleDoc`. There is no `files.update` and no `addParents`. The **move remains
unimplemented and human**.

The counter-argument deserves recording rather than dismissing, because it is not weak:

1. **The trigger names the transition, not the move.** Clause 3 is a clause *of* a lifecycle
   rule, so shipping it makes "Pipeline → Portfolio is implemented" half-true. This ADR is the
   record that the half shipped is the additive half, deliberately.
2. **A property ADR 0001 relied on has changed.** Its blast-radius argument assumed an
   erroneous write produces an empty folder in the right container — visible drift, trivially
   deleted. This is the first time RADAR writes *inside* a folder holding irreplaceable
   history. The bytes are still not moved, but the failure mode is not the one ADR 0001
   assessed.
3. **A compensating control stops applying.** The duplicate-root post-check
   (`executeStructure.js:247-263`) is skipped when a structure creates no root. That is honest
   — there is no root to duplicate — but it is one fewer control than the other six have.
4. **`STRUCTURE_WRITE_SCOPES` already holds full `auth/drive`.** A move would need no new user
   consent. The absence of the code is the only control. Recording that is more useful than not.

What makes the additive half safe, and is asserted by tests rather than by this prose:

- the plan never lists `00`–`04`, so the retained history is never a write target;
- the only Drive verbs that exist are create-verbs;
- every created item is verified inside the configured Shared Drive (`assertInSharedDrive`);
- the object folder cannot be fabricated (decision 2), on the write path as well as in preview,
  because `executeStructure` re-plans from raw inputs and re-previews before writing.

## Consequences

- Approval can be completed in the tool for the first time: move the folder, add 05-12, retype
  the Registry row. RADAR owns only the middle step and says so.
- `Classify` and `Create structure` now agree on the Portfolio subtree, and
  `classifierEquivalence.test.js` holds them to it.
- Structures may now require a folder to pre-exist. This is a new capability in the model and
  the extension point a future decline/graduation flow would build on — though those need the
  move verb, which this ADR does not grant.
- Every plan hash changes shape (the destination gained fields). Harmless: hashes are compared
  only within one preview→confirm cycle and none is persisted.

### Known limitations

- **RADAR verifies the folder exists and looks moved; it cannot prove it is the moved
  original.** A human who copied instead of moving leaves a Pipeline folder behind, and RADAR
  does not detect it. The acknowledgement text asks the administrator to confirm.
- **No verification that the folder is the right organization.** With no Registry write there is
  also no Registry cross-check, so identity rests on an exact folder-name match plus the
  administrator confirming via the Drive link the preview now offers. Blast radius is eight
  empty folders in a real object folder; nothing is overwritten and a re-run is idempotent. A
  read-only Registry assertion (require `Official_Folder_Link` to match the resolved folder) is
  the natural next control and was deliberately deferred: it would make a configured Registry a
  hard precondition, which this deployment does not yet satisfy.
- **No recovery verb.** If the folders land in the wrong object, recovery is a human deleting up
  to eight empty folders. RADAR has no delete, move or rename.
- **The Meeting Log does not roll over.** This type takes no year and creates no document, so a
  Portfolio object entering its second year has no new yearly log. The same gap exists for
  Pipeline objects today.
- **Classify still slugs object names** (`Sample_Org`) while the creator keeps them verbatim
  (`Sample Org`). Pre-existing, affects all object types, and now recorded by a test in
  `classifierEquivalence.test.js`.

## Outstanding, and deliberately not done here

> **Superseded by ADR 0005 (2026-08-27).** The request below asked the Owner to keep the
> from-scratch Portfolio object prohibited. That is no longer what is being requested: ADR 0005
> permits one for an object proven to have no folder anywhere, to serve grants and investments
> that predate RADAR and so never had a Pipeline folder to move. **Do not send this version.**
> The current, combined request is in ADR 0005's *Outstanding* section, and the two ADRs must be
> decided as one package — this one is still Proposed, and ADR 0005 reverses part of it.
>
> The original text is kept below unaltered, because a governance record that quietly rewrites
> what it once asked for is worth less than one that shows the change.

The specification's EMPTY STRUCTURE CREATION RULE (L385-392) enumerates "Current structure
types shown in the tool" as exactly six, and L394's Portfolio note reads as though the tool has
no Portfolio option at all. Both need the RADAR Owner's amendment:

1. add a seventh entry, "Portfolio operating folders", to the list at L385-392;
2. reword L394's second half so it keeps the from-scratch object and the move prohibited while
   naming the additive option the tool now provides.

The specification is precedence authority #2 and is not edited from code. Until those
amendments land this is a **recorded divergence**, on the same footing as the `05_Weekly_Email`
divergence in ADR 0003 — and the reason this ADR stays *Proposed*.

## Revisiting this

Leave this decision behind if any of the following becomes true:

- the Pipeline → Portfolio **move** is to be automated — that needs the move verb, a
  server-side authorization boundary, and ADR 0001's own revisit trigger;
- the Master Registry becomes reliably configured, at which point the deferred read-only
  official-folder assertion should become a blocking precondition;
- a second structure needs `requireExistingSegments`, which would justify generalizing the
  retained-history evidence check rather than keeping its marker list Portfolio-shaped.
