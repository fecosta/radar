# ADR 0005 — A Portfolio object may be created from scratch, only on proven absence

- **Status:** Proposed
- **Date:** 2026-08-27
- **Supersedes:** ADR 0004 decisions 2 (structural unreachability), 3 (guard rules B and C) and
  4 (no Registry write), for this one structure. ADR 0004's additive structure is unchanged and
  remains the correct tool for an approved Pipeline object.
- **Deciders:** RADAR owner. **Approval is not yet recorded.** This ADR must not be marked
  Accepted, and the feature must not be deployed to the production Shared Drive, until the owner
  approves it *together with ADR 0004* and the specification amendments in *Outstanding* below.
  The two must be decided as one package: ADR 0004 is itself still Proposed, and this one
  reverses part of it.
- **Affects:** `AGENTS.md` §3 invariant 9, §5 (risk), §8 (Drive safety); ADR 0004; `CLAUDE.md`
  non-negotiable rules on Portfolio.

## Context

RADAR could not give an official folder to a grant or investment that predates it.

`portfolio_operating_folders` (ADR 0004) adds only `05`–`12` and requires the object folder to
already exist, because approval *moves* it. An investment made before this architecture existed
never had a Pipeline folder to move, so onboarding one meant creating the object folder,
`00_Overview_and_Contacts`, `01_Meetings`, the correctly-named yearly Meeting Log document and
`Raw_Notes/YYYY` **by hand in Drive**, then running the additive structure, then typing the
Registry row. Six manual steps, and the `NO_RETAINED_HISTORY` warning told the operator they may
be doing something the policy forbids.

### The governance conflict, stated rather than resolved

The corpus has **no migration, backfill or legacy-onboarding provision at all**.
`99_ARCHIVE/07_Legacy_Structure` appears once in the specification as a bare tree node with no
rule attached.

**Against creating a Portfolio object from scratch.** Spec L394 sentence 1 is unconditional:
*"do not create a separate Portfolio object from scratch."* `create-structure.md` states *"No
sample organizations are ever created."* And ADR 0004's own *Outstanding* section asks the owner
to amend the spec while *"keep[ing] the from-scratch object and the move prohibited"* — this ADR
reverses that request, which is why that section is being rewritten rather than left to
contradict this.

**For.** Spec L230's subject is *"**existing** Pipeline folder"*: the prohibition is the
complement of a move, and a move presupposes something to move. "Separate" most coherently means
"separate from the Pipeline folder that already exists". Design rule 4 — *"One object = one
official folder"* — is **violated by the status quo**: a live grant has zero, and refusing to
create one leaves it permanently in violation of the more fundamental rule. Design rule 9 already
admits a non-Pipeline route into Portfolio. And the specification contradicts itself here: LAUNCH
SEED EXAMPLES requires *"1 Portfolio organization (e.g., Aprendo+), including
Photos_and_Videos"* to exist, with content, while supplying no mechanism and forbidding the tool
from producing one. Aprendo+ is a real, currently-active investment predating RADAR.

The harm clause 1 actually names is **losing history that exists**. This decision preserves that
harm-avoidance while serving the case the rule was not written about.

## Decision

### 1. `existing_portfolio_investment` — the complete canonical object

Creates all of `00`–`12` (25 items: 24 folders plus the yearly Meeting Log document) at
`02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/{theme}/{name}`.

`00`–`04` and `05`–`12` are composed from **shared constants** also used by the Pipeline and
additive-Portfolio templates, so a legacy object is byte-identical in shape to one that arrived
by the approval route and the three cannot drift. `classifierEquivalence.test.js` holds them
together.

The id is deliberately not `portfolio_organization`: that names the *unguarded* structure the
rule forbids, and the tests banning it are unchanged and still pass.

### 2. The prohibition becomes a precondition, verified against live Drive

The structure declares `requireNoOtherHome`, and the preview refuses unless the object has no
folder **anywhere in the Shared Drive**:

- a folder found elsewhere → `OBJECT_HAS_ANOTHER_HOME`, naming its path — move it and use the
  additive structure;
- a folder found at the destination → `OBJECT_ALREADY_IN_PORTFOLIO`, routing explicitly to the
  additive structure.

Because `executeStructure` re-plans and re-previews before writing, this holds on the write path,
not only in the browser.

The second block is not a nicety. Without it, this structure pointed at an object that arrived by
a move would **scaffold fabricated history into it** — an empty
`03_Screening/02_Concept_Review` inside a real Portfolio folder asserts a gate that never
happened, and no later reader could distinguish it from a real one. It also makes the two
Portfolio structures **mutually exclusive by live Drive state**, which is a better answer to "how
does the operator choose?" than any wording on a card.

### 3. One drive-wide search, not an enumeration of lifecycle areas

The check is a single Shared-Drive-wide query for the folder name, not a walk of Pipeline,
Venture Building, Exploration, the archives and so on. That enumeration was the original design
and is worse on every axis: roughly seventy Drive reads against one; and it can only find homes
someone remembered to list, missing a subportfolio folder, `07_Legacy_Structure`, or any area
added to the tree later.

It also buys **case-insensitivity for free**. Drive's `name =` operator is case-insensitive and
`findExactChildren` deliberately re-filters strictly in JS; the drive-wide search simply does not
re-filter. This is a deliberate asymmetry, and the principle is worth stating:

> **Strict matching to decide what to reuse; loose matching to decide what to prohibit.**

The strict matcher must fail closed when it is choosing a folder to write into. The prohibition
matcher must fail closed when it is deciding whether a duplicate exists — and those are opposite
directions. Reusing the strict one here would have made every near-miss create a second home.

### 4. The guard is relaxed by declaration plus shape, never by structure type

`forbiddenDestinationReason` still refuses to plan a Portfolio object folder. It now permits one
when the destination declares `requireNoOtherHome` **and** has exactly the right shape: one
created segment, anchored directly on a themed Portfolio container, and any item at object depth
must be that structure's own root.

The shape pins are not decoration. Without them a template could set the flag and create the
canonical *theme container* — architecture the creator must never bootstrap — or smuggle an
object folder in as an ordinary node. The rule stays type-blind: it judges what a plan would
write and what it promises to verify, never which type asked.

`99_ARCHIVE` keeps its absolute prohibition. No declaration earns it, because an archived object
by definition already had a home.

### 5. The Registry conflict check becomes type-blind

A Registry row's identity includes `Object_Type` — correct for deciding *which row to write*,
and a trap for asking *whether this object already has an official folder*. A legacy grant's row
is likely to say `Pipeline` or `Exploration`; a Portfolio-typed lookup misses it, reports no
conflict, and appends a second row, in the register the specification requires to be singular.

The two questions are now asked separately: `conflictIdentity` (name + theme, via a new
`lookupAnyType`) for the block, and the unchanged three-field `identity` for the upsert. The
block message names the type it found — *"already records X as Pipeline"* is actionable where
*"already recorded"* is not.

This is the read-only Registry assertion ADR 0004 named as *"the natural next control"* and
deferred. It arrives here as a requirement, because this structure writes a row where the
additive one wrote none.

## What is given up, stated plainly

ADR 0004's guarantee was structural: `createdSegments` was empty, so `createFolder(parent,
objectName)` was **not a call that existed**. That is now gone for this one structure. The
forbidden write exists and is gated by a runtime check plus a static declaration that the check
is expected.

A pure function cannot verify that anyone still *runs* the check. A future refactor could delete
the preview step and every static guard test would still pass. The replacement is a behavioural
test that seeds a decoy folder in each lifecycle area and asserts the preview blocks — it fails
if the check is removed, which the static tests cannot detect. That is a lower level of assurance
than "the call does not exist", and this ADR does not pretend otherwise.

## Known limitations

- **Accent and spelling variants still slip through.** Drive's query operator folds case but not
  accents, so `Fundacion Luminar` will not match `Fundación Luminar`, and neither will an
  abbreviation or a renamed folder. Unicode normalization differs between macOS (NFD) and
  Windows (NFC) for the same visible name. The mitigations are the Registry conflict check —
  looser than Drive matching, since it lowercases and trims — and the operator reading the
  destination before confirming. Neither is complete.
- **The race is now load-bearing where it was not.** Two administrators, one creating the object
  in Pipeline and one here, will not see each other: `operationStore` is module state in one
  browser tab, not a distributed lock. Previously this outcome was structurally impossible under
  Portfolio. The duplicate-root post-check applies and warns, but only after both exist.
- **A partial failure leaves a partial object.** Recovery is a human deleting empty folders;
  RADAR has no delete, move or rename. Re-running is not idempotent for this structure by design
  — once the folder exists, the additive structure is the correct tool, and this one blocks.
- **This must not become the launch-seed mechanism.** "No sample organizations are ever created"
  stands, and the banned-substring tests still enforce it.

## Outstanding, and deliberately not done here

The specification needs three amendments from the RADAR Owner, replacing the two requested in
ADR 0004:

1. Add both new structures to the "Current structure types shown in the tool" list.
2. Reword L394 so sentence 1's scope is explicit — the from-scratch prohibition applies to an
   object that **has a folder elsewhere**, which approval moves and never rebuilds — and name the
   narrow legacy exception.
3. Add a clause to the PORTFOLIO CREATION RULE, or a new LEGACY OBJECT RULE, stating the
   precondition (no folder anywhere in the Shared Drive) and recording that such an object's
   `02`–`04` are **empty by construction and assert no history**. Without this the specification
   has no rule covering the artefact this feature produces, and the next reader cannot tell an
   empty legacy `03_Screening` from one whose contents were lost.

The specification is precedence authority #2 and is not edited from code. Until these land this
is a **recorded divergence**, and the reason this ADR stays *Proposed*.

## Revisiting this

- If accent-insensitive or fuzzy matching becomes available, the prohibition check should adopt
  it — the residual gap above is the main one.
- If the Master Registry becomes reliably configured, consider making it a hard precondition for
  this structure: for an object with no folder anywhere, the Registry row is the only evidence
  RADAR can have that the object is real and already tracked.
- If a second structure needs `requireNoOtherHome`, generalize the block messages, which name
  Portfolio explicitly today.
