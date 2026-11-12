# ADR 0007 — A closed object's archive folder, only on proven absence

- **Status:** Proposed
- **Date:** 2026-11-12
- **Supersedes, in part:** ADR 0004 guard rule A ("nothing may be created anywhere under
  `99_ARCHIVE`, no exceptions") and ADR 0005 decision 4 ("`99_ARCHIVE` keeps its absolute
  prohibition"). It adds one narrow exception and changes nothing else in either ADR.
- **Deciders:** the RADAR Owner, and the functional owners of Portfolio, Venture Building and
  In-house Programs for Education and Democracy. **Approval is not yet recorded.** The repository
  maintainer asked for the implementation to be built ahead of approval, on a feature branch.
  This ADR must not be marked Accepted, and the structure must not be used on or deployed to the
  production Shared Drive, until both conditions in *Outstanding* are met.

## Context

A stakeholder asked Create structure to build a standard folder for closed objects:

```text
99_ARCHIVE/{02_Closed_Portfolio|03_Closed_Ventures|04_Closed_In_House_Programs}/{Education|Democracy}/
└── [Closed Object Name]/
    ├── Investment Documents/
    ├── Execution Documents/
    └── MEL Evidence/
```

`Cross_Thematic` stays in the canonical tree under `04_Closed_In_House_Programs`. The stakeholder
did not ask for this structure there.

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

That justification has the same gap ADR 0005 found in Portfolio. A closed object that never had
a folder had no home, so there is nothing to move. Refusing to build one leaves it permanently
in breach of rule 4. Closed grants and programs that predate RADAR are exactly this case.

## Decision

### 1. One new structure, for proven absence only

`closed_object_archive` ("Closed object (archive)") builds `{name}` with three children named
exactly as requested, directly inside `99_ARCHIVE/{category}/{theme}`. It declares
`requireNoOtherHome`, so before anything is written the preview runs ADR 0005's single
Drive-wide, case-insensitive folder-name search. A hit anywhere blocks with "move that complete
folder instead": active areas, another closed category, the other theme, or `07_Legacy_Structure`.

A closed object that **has** a folder is moved by a human and gets nothing from RADAR. So the
three folders never land beside an object's own `06_Investment_Docs`, `07_Execution` or
`10_MEL_Evidence`, which would give one document type two homes inside one object. The
stakeholder accepted that overlap if it ever arose, but with this design it cannot.

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

- if they are only folders bearing this plan's own child names, the folder is RADAR's earlier
  run, and the preview reuses what exists and creates the rest;
- anything else means a real object, and the preview blocks with `OBJECT_ALREADY_IN_ARCHIVE`.
  That covers a file, a moved object's own folder, or a planned name taken by a file.

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
reporting, and one audit row per attempt all apply unchanged. ADR 0001's revisit trigger
("lifecycle transitions … decline/archive") has not fired: nothing is moved.

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
- **Inherited residual gaps.** Drive's name search does not fold accents or Unicode
  normalization. Two administrators racing are not serialized. The resume rule trusts any folder
  whose only children carry the three planned names, so a human-made folder with exactly that
  shape is treated as RADAR's own. That is harmless, because RADAR only adds missing siblings and
  never touches their content.
- **The folder names break the canonical convention.** Every other canonical folder is a
  numbered snake_case name. These follow the request verbatim (`Investment Documents`, not
  `01_Investment_Documents`). The specification states no folder-naming rule, so this is flagged
  rather than changed.
- **Classify is unchanged.** It already routes closure records to
  `99_ARCHIVE/{category}/{theme}/{object}`. `classifierEquivalence.test.js` now proves the
  container agrees with this structure. It does not route documents into the three new folders.

## Outstanding, and deliberately not done here

Both are needed before this ADR can be Accepted.

1. **Owner approval.** The RADAR Owner and the relevant functional owners must approve this
   decision, recorded in their words as ADR 0006 does. The approval should also answer three
   questions:
   - Are the three names final as written, or should they follow the numbered snake_case
     convention?
   - Should `Cross_Thematic` closed in-house programs be included?
   - Who owns updating the Registry row for these objects?
2. **Specification amendment**, made at the Owner's direction:
   - add a CLOSED OBJECT ARCHIVE TEMPLATE under the `99_ARCHIVE` section: "For a closed
     Portfolio organization, Venture or In-house Program that never had an official folder,
     RADAR may create `[Object]/Investment Documents`, `Execution Documents` and `MEL Evidence`
     under `02_Closed_Portfolio`, `03_Closed_Ventures` or `04_Closed_In_House_Programs` /
     `Education|Democracy`. A closed object with a folder is moved, never rebuilt.";
   - add "Closed object (archive)" to *Current structure types shown in the tool*.
