# ADR 0007 — A historical closed project's archive folder, only on proven absence

- **Status:** Proposed. The RADAR Owner's approval is recorded below and the specification has
  been amended. The functional owners' approval is not yet recorded, and it is the remaining
  condition for Accepted.
- **Date:** 2026-11-12; revised 2026-11-13 for the historical-migration clarification
- **Supersedes, in part:** ADR 0004 guard rule A ("nothing may be created anywhere under
  `99_ARCHIVE`, no exceptions") and ADR 0005 decision 4 ("`99_ARCHIVE` keeps its absolute
  prohibition"). It adds one narrow exception and changes nothing else in either ADR.
- **Deciders:** the RADAR Owner, and the functional owners of Portfolio, Venture Building and
  In-house Programs for Education and Democracy (AGENTS.md §3).
  - **RADAR Owner:** approved. The approval was confirmed by the requester in the request that
    produced this change, on 2026-11-13; see *Approval record*. The Owner's own decision date and
    verbatim wording are not recorded in this repository.
  - **Functional owners:** approval **not recorded**. Until it is, this ADR must not be marked
    Accepted, and the structure must not be used on or deployed to the production Shared Drive.
  - The implementation was built on a feature branch ahead of approval, at the repository
    maintainer's request.

## Context

The organization has projects — Portfolio organizations, Ventures and In-house Programs — that
closed in the past, some of them months ago. Organizing their documentation is the final stage
of the RADAR Shared Drive migration. A stakeholder asked Create structure to build a standard
archive folder for each one:

```text
99_ARCHIVE/{02_Closed_Portfolio|03_Closed_Ventures|04_Closed_In_House_Programs}/{Education|Democracy}/
└── [Historical Closed Project Name]/
    ├── Investment Documents/
    ├── Execution Documents/
    └── MEL Evidence/
```

`Cross_Thematic` stays in the canonical tree under `04_Closed_In_House_Programs`. The stakeholder
did not ask for this structure there.

The stakeholder clarified (2026-11-13) that this is **not** a request to automate closing
currently active projects. It is also not yet known where every historical project's documents
live: some have no organized folder, others may already have one, possibly outside the archive.
Historical closure is therefore no licence to create a second official home.

What the governing sources say:

- **v06 defines the containers and nothing beneath them.** All three categories and their theme
  folders exist in the tree. There is no closed-object template, and the three folder names
  appear nowhere in the specification. This is a new canonical structure, not an implementation
  detail. AGENTS.md §3 requires owner approval for it, and AGENTS.md §10 requires an ADR.
- **Closure is a move.** Design rule 4 says one object has one official folder. Rule 8 says a
  decline moves the entire object. Rule 9 says a closed venture moves the complete folder to
  Archive. AGENTS.md §13 forbids rebuilding or copying an object whose lifecycle requires a move.
  RADAR has no move verb (ADR 0001).
- **The guard said no, absolutely.** `forbiddenDestinationReason` rule A refused every path under
  `99_ARCHIVE`, because "an archived object by definition already had a home."

That justification has the same gap ADR 0005 found in Portfolio. A project that closed without
ever having an organized folder had no home, so there is nothing to move. Refusing to build one
leaves it permanently in breach of rule 4. The historical projects in the migration are exactly
this case.

## Scope: historical onboarding, not project closure

- **Included — historical archive onboarding.** Portfolio, Venture and In-house projects that
  closed before they were ever managed as active objects in RADAR. They are given an archive
  location for their key historical documentation, as the final stage of the Shared Drive
  migration. Never having been active in RADAR does not mean having no folder in Drive, so the
  existence checks in decisions 1, 1a and 3 are mandatory.
- **Not included — closing an active RADAR project.** That project already has an official
  folder, so the existence check blocks this structure, and it cannot serve as a closure
  shortcut. RADAR provides no general-purpose closure workflow. Closing an active project is a
  separate future capability: see *Extension points* in
  [create-structure.md](../operations/create-structure.md).

The decisions below are unchanged: eligibility, duplicate prevention, the three names, the
category allowlist, Education and Democracy only, retry, no document movement, no permission
changes, and manual Registry responsibility.

## Decision

### 1. One new structure, for proven absence only

`closed_object_archive` ("Historical closed project (archive)") builds `{name}` with three
children named exactly as requested, directly inside `99_ARCHIVE/{category}/{theme}`. It declares
`requireNoOtherHome`, so before anything is written the preview runs ADR 0005's single
Drive-wide, case-insensitive folder-name search. A hit anywhere blocks and shows its path: active
areas, another closed category, the other theme, or `07_Legacy_Structure`. The block says the
existing folder must be reviewed and organized through the manual migration process. RADAR
does not move, rename, copy or delete it.

A project that **has** a folder gets nothing from RADAR. So the three folders never land beside
an object's own `06_Investment_Docs`, `07_Execution` or `10_MEL_Evidence`, which would give one
document type two homes inside one object.

RADAR never looks for, moves or copies the project's documents. The new folders start empty.

| Scenario | Behavior |
|---|---|
| A. No folder anywhere | Builds the object folder and its three folders after preview and confirmation |
| B. RADAR's own partial run at the destination | Resumes: reuses what exists, creates the rest (decision 3) |
| C. A folder for the project elsewhere | Blocks with `OBJECT_HAS_ANOTHER_HOME` and the path; human review |
| D. The destination already holds other content | Blocks with `OBJECT_ALREADY_IN_ARCHIVE`; nothing changed; human review |

### 1a. The existence search covers the project's other spellings

Historical folders were named by different people on different systems, so a name match must
not depend on how it was typed. `nameVariants()` in `structureInputs.js` adds two kinds of
deterministic variant to the one Drive query: the other Unicode encoding of the same visible name
(macOS writes NFD, Windows NFC), and spaces swapped with the underscores Classify's suggested
names use. Drive's `name =` already ignores case. It fails closed: a variant can only add a
block. Reuse at the destination still requires the exact name.

Accents are deliberately **not** folded. `Fundacion` and `Fundación` stay different, because
folding is one-directional (a name typed without accents cannot be expanded back) and blocks
genuinely different names. The wizard asks the administrator to check for other spellings before
confirming. Because the search is shared, *Existing Portfolio investment* gets the same coverage.

### 2. Rule A is narrowed, not removed

The guard stays type-blind and judges the plan's own data. An archive destination is permitted
only when **all** of these hold:

- the plan declares `requireNoOtherHome`;
- it creates exactly one segment, the object folder;
- `parentSegments` is exactly `[99_ARCHIVE, one of the three closed-object categories,
  Education|Democracy]`. `CLOSED_OBJECT_CATEGORIES` in `canonicalTree.js` is the allowlist;
- no planned item is deeper than the object folder's direct children.

Everything else under `99_ARCHIVE` is refused exactly as before: `01_Declined_Pipeline`,
`05`–`08`, `Cross_Thematic`, additive archive structures, bootstrapping a category or theme
container, and deep trees. An undeclared plan is also refused.

### 3. Re-running resumes RADAR's own partial folder

ADR 0005 accepted that its from-scratch structure is not idempotent: once the folder exists, it
blocks. Here that would leave a partial failure stuck until someone deleted folders by hand. So
when the search hit **is** the destination, the preview lists that folder's children (a new
read-only `listChildren` call under the already-granted `drive` scope):

- if they are only **empty** folders bearing this plan's own child names, the folder is RADAR's
  earlier run, and the preview reuses what exists and creates the rest;
- anything else is historical content that needs human review, and the preview blocks with
  `OBJECT_ALREADY_IN_ARCHIVE`. That covers a file, a moved object's own folder, a planned name
  taken by a file, and a planned folder that already holds documents. Enriching an existing
  archive folder is a separate product decision, not part of this one.

This applies to archive destinations only. *Existing Portfolio investment* keeps ADR 0005's
block-always behaviour unchanged.

### 4. No Registry write, and no inference of closure

`registry.applicable` is false. Building an archive folder is not evidence that an object was
closed, and the specification says a human decides status and type. The plan carries a
`manualTransition` advisory, which must be acknowledged before execution. It tells the
administrator to make sure the object has one Registry row, then set `Current_Stage_or_Status`,
`Decline_or_Closure_Reason`, `Decision_Link` and `Official_Folder_Link` by hand.

### 5. Education and Democracy only

The template declares its own `themes` list (`THEMES`), narrower than the canonical rule for
`04_Closed_In_House_Programs`. `templateThemes()` reads it, so the validator, the picker and the
form agree. `THEMES_BY_AREA` is unchanged.

### 6. Safety model inherited unchanged

Preview, explicit confirmation, revalidation immediately before writing, exact-name reuse,
Shared Drive containment, no delete, move, rename or permission verb, precise partial-failure
reporting, and one audit row per attempt — blocked and failed runs included — all apply unchanged. ADR 0001's revisit trigger
("lifecycle transitions … decline/archive") has not fired: nothing is moved, and no active
project is closed.

## Alternatives rejected

- **Add the three folders to a closed object a human has moved** (the ADR 0004 additive
  pattern). It respects the move, but the moved object already holds canonical equivalents, so it
  would create parallel homes for the same documents. It was offered and not chosen.
- **Build both cases.** That means two structures with opposite preconditions and twice the
  guard surface, for a case whose value is doubtful (see above).
- **Remove rule A, or exempt this type by id.** The guard's design rejects type-keyed
  exemptions: a new template would only have to add itself.
- **Block always on re-run, as ADR 0005 does.** It is strictly safer, but a transient Drive error
  would then need a human deletion before retry, and RADAR cannot delete.

## Consequences

- **The archive is no longer unreachable.** One shape-pinned, declared exception exists, and its
  safety rests on a live-Drive check rather than a structural impossibility, as in ADR 0005.
- **Residual gaps.** The search does not fold accents or punctuation, so a project filed as
  `Fundacion Luminar` or `Fundación-Luminar` is not found when `Fundación Luminar` is typed. The
  administrator's check before confirming is the control. Two administrators racing are not
  serialized. An empty folder a human made with exactly the planned names is treated as RADAR's
  own. That is harmless, because RADAR only adds empty siblings.
- **Live behavior is not evidenced here.** The variant query and resume rule are tested against
  the fake Drive. The requester reports integration validation as completed, but no record of it
  exists in this repository (see *Outstanding*).
- **The folder names break the canonical convention.** Every other canonical folder is a
  numbered snake_case name. These follow the request verbatim (`Investment Documents`, not
  `01_Investment_Documents`). The specification states no folder-naming rule, so this is flagged
  rather than changed.
- **Classify is unchanged.** It already routes closure records to
  `99_ARCHIVE/{category}/{theme}/{object}`. `classifierEquivalence.test.js` now proves the
  container agrees with this structure. It does not route documents into the three new folders.

## Approval record (2026-11-13)

The requester confirmed on 2026-11-13 that the RADAR Owner approved this feature and authorized
the following. These are the requester's words, not the Owner's verbatim text:

1. a historical closed-project structure under `02_Closed_Portfolio`, `03_Closed_Ventures` and
   `04_Closed_In_House_Programs` (decision 1);
2. Education and Democracy (decision 5);
3. creating a new archive project folder only when no existing official project folder is found
   in the configured Shared Drive (decisions 1, 1a and 3);
4. exactly three subfolders: `Investment Documents`, `Execution Documents`, `MEL Evidence`
   (decision 1);
5. the narrowly scoped exception to the prohibition on creating folders within `99_ARCHIVE`
   (decision 2);
6. all existing restrictions on duplicate official folders, permissions, lifecycle transitions
   and document movements preserved (decisions 4 and 6).

`Cross_Thematic` is not included. The approval covers organizing previously closed projects
during the historical migration. It does not authorize automatically closing or moving active
projects.

## Resolved 2026-11-13

- **The four points proposed for approval**: the structure, creation only where no existing
  folder is found, the three names and the archive exception. All four are approved by the
  RADAR Owner (items 1–5 above).
- **Naming.** The three names are final as written, with spaces and capitalisation, not the
  numbered snake_case convention.
- **`Cross_Thematic`** is excluded.
- **Specification amendment.** Made at the RADAR Owner's direction in
  `docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`: a new SPECIAL TEMPLATE - HISTORICAL CLOSED
  PROJECT ARCHIVE section, the structure-type list entry, and an `Amended:` header line that
  records the pending functional-owner approval.

## Outstanding, and deliberately not done here

1. **Functional-owner approval**, recorded in their words as ADR 0006 does. This is the
   condition for Accepted.
2. **Who owns** updating these projects' Master Registry rows. The approval keeps those updates
   manual but names no owner.
3. **Who reviews** a historical project's existing folder when RADAR finds one, and through
   which migration process.
4. **Test Shared Drive dry-run evidence** before production use (AGENTS.md §5, §8). Integration
   validation was reported as completed, but no environment, date or results are recorded.
