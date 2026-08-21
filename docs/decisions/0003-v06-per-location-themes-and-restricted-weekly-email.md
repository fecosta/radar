# ADR 0003 — Theme validity is per location, and restricted access stays out of the code

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** RADAR owner. Approval basis is the approved **RADAR v06 Canonical Folder
  Tree — Automation Specification** (`docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`,
  basis line: "v05 architecture + Leadership Team feedback + implemented Drive changes")
  and **RADAR Folder Use Guidelines v02**.
- **Affects:** `AGENTS.md` §3 invariant 2 (programmatic themes), §4 (incremental
  migration), §8 (Drive safety); `CLAUDE.md` precedence and non-negotiable rules.

## Context

v06 introduced `Cross_Thematic` alongside `Education` and `Democracy`, but only in specific
places, and design rule 2 is explicit that it "is used only where explicitly defined". The
Guidelines restate it: "Cross_Thematic is not a general 'other' folder."

The code could not express that. `THEMES` in `src/radar/canonicalTree.js` was one frozen
array consumed by every themed template, the wizard dropdown and `validateTheme` at once.
Adding a third entry would have made `Cross_Thematic` valid for Pipeline organizations and
Venture Building initiatives too — a canonical violation, and the exact "general other
folder" v06 forbids.

Separately, `03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/05_Weekly email` was created in
the Shared Drive at the CEO's request and must be restricted to the Leadership Team.

## Decision

### 1. Theme validity is resolved per canonical area, never globally

`canonicalTree.js` now exports `THEMES` (the two core themes), `CROSS_THEMATIC`,
`THEMES_WITH_CROSS_THEMATIC`, and a `THEMES_BY_AREA` map with a `themesForArea(area)`
accessor. Each themed template declares a `themeArea`; `validateStructureInput` validates
against that area's list, and the wizard renders that area's options.

Consequences, all intended:

- Only **In-house program** gains `Cross_Thematic` in the creator. Pipeline organization and
  Venture Building initiative reject it, with an error naming only the themes their location
  permits.
- `isCanonicalTheme(value, area)` now requires an area. It had no callers, so the signature
  change costs nothing.
- The classifier resolves a theme per destination (`themeFor`). Selecting `Cross_Thematic`
  for a Pipeline question yields the `[Education|Democracy]` placeholder and reports the
  theme as still needed, rather than silently substituting a core theme RADAR has no basis
  to choose.

### 2. `0A_EXPLORATION` is a second-level area, not a fifth root

v06 places it inside `02_INVESTMENTS_AND_PROGRAMS`, so invariant 1 (four fixed roots) is
untouched and this is not a canonical-root change.

No seventh structure type is added. v06 lists exactly six, and an exploration folder has no
template — it is a plain folder under `0A_EXPLORATION/{theme}`. The creator therefore cannot
target it, asserted by a guard test. Preview does *read* the three theme folders, to warn
when an object being promoted to Pipeline still has an exploration home (design rule 19,
"do not keep duplicate official homes"). Detection only; nothing is moved.

### 3. Emergency Response gets no special template

It is an In-house program with theme `Cross_Thematic` and object name
`Emergency_Response`, using the standard template unchanged. The classifier recognizes it as
a special *case* — like Beca Tech and Democracia+ — so it can explain the placement, but the
folder structure is ordinary. A test asserts the expanded tree is byte-identical to any
other In-house program's.

### 4. `05_Weekly email` is recorded as restricted; the permission is applied by hand

RADAR records the folder in the canonical model and documents the procedure. It does **not**
apply the permission, and gains no permissions code.

Two facts drove this. First, Shared Drive membership is a *floor*: a folder cannot normally
be made more restrictive than its Drive. The one supported mechanism is Google's
**limited-access** folder setting, applied by a Shared Drive Manager — the older per-item
restriction inside shared folders was withdrawn on 2025-09-22. Second, `CLAUDE.md`'s Drive
safety rule forbids the application changing access to Drive content at all.

The uncomfortable part, recorded deliberately: `STRUCTURE_WRITE_SCOPES` already requests the
full `auth/drive` scope for Create structure, so `permissions.create` would require **no new
consent**. Nothing but the absence of code prevents a permissions write. That absence is the
control, which is why this ADR states it rather than leaving it to be rediscovered.

The folder is also **not** a governance forum. The v06 formal-governance template "applies
only to Board, Leadership Team, All Team, Offsites", and adding a fifth forum would have
handed the weekly email a dated `01_Agenda … 05_Decisions_and_Actions` meeting package it
has no use for.

## Alternatives rejected

**A third entry in the global `THEMES` array.** One line, and wrong: it would have made
`Cross_Thematic` selectable for Pipeline and Venture Building, contradicting design rule 2.

**Deriving theme rules from the observed Drive.** `AGENTS.md` §4: "Do not turn observed
Drive drift into canonical configuration automatically." The approved specification is the
source, not the folder listing.

**A read-only permissions drift check** — reading `inheritedPermissionsDisabled` and the
permission list to report whether the folder really is Leadership-only. Genuinely aligned
with RADAR's mission of exposing drift, and feasible within `drive.readonly`. Deferred, not
refused: the owner is applying the restriction by hand and no drift signal is needed yet.
Recorded here so the option is not re-derived from scratch.

**Migrating the classifier's inline path literals wholesale.** Out of scope. Per §4 the
equivalence harness (`src/radar/classifierEquivalence.test.js`) must come first; this change
extends that harness to cover the per-area theme rules and imports the theme constants from
the canonical model, which is one step of that staged migration rather than the whole of it.

## Consequences

- `PLAN_VERSION` moves to `radar-v06`. A wizard session left open across the deploy fails its
  hash check and must re-preview. That is the designed behaviour for a specification change:
  `executeStructure` refuses to write a plan that no longer matches what was confirmed.
- Archive sections `02_Closed_Portfolio`, `03_Closed_Ventures` and
  `04_Closed_In_House_Programs` are now theme-partitioned in the classifier. They always
  should have been; the theme segment was missing for the core themes too, which is why the
  requested `Cross_Thematic` archive folder was unreachable.
- `Cross_Thematic` is deliberately absent from `01_Research_Projects` (which uses
  `Institutional` for non-thematic work), `02_Thematic_Strategies`,
  `01_Ecosystem_Architecture`, `02_Closed_Portfolio` and `03_Closed_Ventures`.

## Resolved 2026-08-21 — the Weekly Email folder name

The open item recorded here was that `05_Weekly email` broke the tree's `snake_case`
convention, with a space and a lowercase "email", and that both v06 documents and the live
Drive folder spelled it that way.

The Drive folder has since been renamed to **`05_Weekly_Email`**, matching the convention the
rest of the tree uses. The RADAR Owner chose to follow the Drive, so `SEGMENTS.WEEKLY_EMAIL`,
the classifier route, the evaluation case, the Drive test fixture and the operations docs all
now read `05_Weekly_Email`. The reason to follow rather than wait: the classifier hands this
path to users, and a recommended path that does not resolve is a live defect, not a
cosmetic one.

**Outstanding, and deliberately not done here:** the v06 specification text
(`docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`, three places) still reads
`05_Weekly email`. That document is precedence authority #2 and amending it is the owner's
action, not something to change in passing — so the repository currently holds code that
disagrees with its own governing specification on this one literal. Recorded here so it stays
tracked divergence rather than drift. It closes when the specification text is corrected.
