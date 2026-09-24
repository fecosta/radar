# ADR 0006 — BecaTech+ partner and provider organization folders

- **Status:** Accepted (2026-09-24). Both acceptance conditions are met: the owner approvals
  below are recorded, and the specification amendment has been made (see *Resolved
  2026-09-24*). Until then this ADR was Proposed.
- **Date:** 2026-09-24
- **Deciders:** RADAR Owner and the Education functional owner.
  - **Education functional owner:** raised the recurring need and approved it for
    implementation in RADAR, as recorded in the request that produced this change.
  - **RADAR Owner:** approved on 2026-09-24, in these words: "Within the existing BecaTech+
    In-house Program, RADAR may create standardized organization workspaces under the existing
    `04_Partners_and_Providers/Partners` and `04_Partners_and_Providers/Providers` folders. Each
    organization workspace contains exactly `Proposal`, `Agreement`, and `Reports`. This is a
    BecaTech+-specific extension and does not change the generic In-house Program template."
    The RADAR Owner also confirmed that the live Shared Drive folder is named `BecaTech+`.
  - That satisfies `AGENTS.md` §3 (RADAR Owner and relevant functional owner). The
    specification amendment was the remaining condition. The RADAR Owner directed it on
    2026-09-24, and it has been made.
  - Acceptance approves the canonical rule, not a production release. The feature still has to
    pass test-Shared-Drive validation (`AGENTS.md` §5, §8) before it is used on production.
- **Affects:** v06 DYNAMIC TEMPLATE - IN-HOUSE PROGRAM (BecaTech+ only), EMPTY STRUCTURE
  CREATION RULE; `AGENTS.md` §3 invariant 19 (Beca Tech special template), §5 (risk), §8 (Drive
  safety); ADR 0001 (client-side controlled writes).

## Context

The Education team keeps creating the same folders by hand for each organization BecaTech+
works with. BecaTech+'s `04_Partners_and_Providers` already holds two containers, `Partners`
and `Providers`, and each organization under them gets `Proposal`, `Agreement` and `Reports`.

v06 does not describe any of this. It says only that "Beca Tech" uses the In-house Program
template, which leaves `04_Partners_and_Providers` empty. Adding permanent folders below it is a
canonical change and needs a record.

## Decision

### 1. One BecaTech+-specific structure type

`beca_tech_partner_or_provider` — shown as "BecaTech+ partner or provider". It collects two
fields:

- `organizationKind`: a closed allowlist, `partner` → `Partners`, `provider` → `Providers`
  (`BECA_TECH_ORGANIZATION_KINDS` in `canonicalTree.js`, validated like governance forums);
- `objectName`: the organization name, validated by the same folder-name rules as every other
  structure and kept exactly as typed.

It creates `[Organization_Name]/Proposal`, `/Agreement` and `/Reports`. Nothing else. The
bare id `beca_tech` stays unsupported, because it names creating the program itself.

### 2. Scoped to BecaTech+, not the In-house template

Only BecaTech+ has shown the need. Adding `Partners`/`Providers` to the generic template would
create them in every new In-house program, Emergency_Response included, and would be an
organization-wide change nobody has asked for. A test asserts the generic template still
produces an empty `04_Partners_and_Providers`.

### 3. The destination is fixed and must already exist

```
02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/BecaTech+/04_Partners_and_Providers/{Partners|Providers}
```

The whole path is `parentSegments`, so a missing level — `BecaTech+`,
`04_Partners_and_Providers`, or the chosen container — is `MISSING_CANONICAL_PARENT`: drift,
blocked, nothing written, never repaired. Only the organization folder is in
`createdSegments`. No input can change the path: there is no theme field, and override keys
are rejected as they are for every structure.

### 4. The physical folder is `BecaTech+`

The repository used to spell the folder `Beca_Tech`, both in the classifier and in its
evaluation fixtures. The RADAR Owner confirmed that the live folder is `BecaTech+`, so the
repository now follows the Drive. The Drive folder is not renamed. The same reasoning ADR 0003
applied to `05_Weekly_Email`: a path RADAR hands out has to resolve.

- `SEGMENTS.BECA_TECH` in `canonicalTree.js` is the one machine-readable definition. The
  classifier's BecaTech+ base path now reads it instead of repeating the literal.
- Human-readable prose ("Beca Tech is treated as an Education In-house Program…") and the
  classifier's input keywords (`beca tech`, `beca_tech`) are not paths and are unchanged.
- Document-name tokens are also unchanged: the Meeting Log name `YYYY_Beca_Tech_Meeting_Log` and
  suggested file names such as `…_Beca_Tech_Photo_or_Video_…`. They are file names, not the
  folder, and only the folder spelling was confirmed.

### 5. Identity is scoped to the chosen container

`Partners/Acme` and `Providers/Acme` are independent. These are operational folders inside one
object, not Registry lifecycle objects, so design rule 4 ("one object = one official folder")
is about BecaTech+ itself and not about them. Applying the Portfolio-style Drive-wide absence
check would invent a rule the specification does not state. This is the narrowest reading;
if the owners decide an organization may appear in only one of the two containers, a
sibling-container check is the extension point.

### 6. No Registry row, no permission changes

`registry.applicable` is `false`, and no new `Object_Type` is invented. The folders are not
marked restricted and no advisory is raised: nothing in the policy or specification names
them as sensitive. Existing Drive access applies. The Drive client exposes no permissions
verb, which `driveStructureApi.test.js` asserts.

### 7. Safety model inherited unchanged

Preview is read-only. The plan hash is checked, the user confirms explicitly, inputs are
revalidated and preview is re-run before writing. Every item is checked to be inside the
Shared Drive. Exact-name reuse keeps the run idempotent. A name held by a file, or two exact
matches, blocks. Partial failure is reported and a retry is safe. Every run is audited. No
planner, preview or execution code changed. The structure is expressed entirely in the
existing template model.

## Alternatives rejected

- **Two cards, one per container.** They would be almost identical. A controlled selector is
  one validated field.
- **Letting RADAR create a missing `Partners`/`Providers`.** That is repairing canonical
  architecture, which the creator never does.
- **A general "add folders here" tool.** That is out of scope, and it is the arbitrary writer
  ADR 0001's safety model exists to prevent.
- **Renaming the Drive folder to `Beca_Tech`.** The Drive is the observed state the owner
  confirmed, and RADAR never renames folders.

## Consequences

- Education staff create an organization workspace through the standard wizard.
- Every Classify recommendation for BecaTech+ now returns `…/Education/BecaTech+/…`, which is
  the path that exists. The three evaluation fixtures were corrected to match.
- `classifierEquivalence.test.js` pins both sides to the literal `BecaTech+`, so reverting
  either the classifier or the creator to `Beca_Tech` fails the build.
- `PLAN_VERSION` is unchanged: no existing plan changes shape.
- If another In-house program adopts the convention, the extension point is a program-keyed
  version of `BECA_TECH_PARTNERS_AND_PROVIDERS_SEGMENTS`. Do not change the generic template
  without an organization-wide decision.

## Resolved 2026-09-24 — the specification amendment

The RADAR Owner directed the amendment below, and it was applied to
`docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt` on 2026-09-24:

- a new **SPECIAL TEMPLATE - BECATECH+ PARTNERS AND PROVIDERS** clause after SPECIAL CASE -
  EMERGENCY RESPONSE. It uses the text proposed below, plus two points the Owner's approval and
  decisions 3 and 6 already implied: missing parents are drift and never auto-created, and
  these organizations are not Master Registry objects;
- "BecaTech+ partner or provider" added to "Current structure types shown in the tool";
- an `Amended:` line in the header naming this ADR.

The generic DYNAMIC TEMPLATE - IN-HOUSE PROGRAM is unchanged. The divergence between the
specification and the code that this ADR recorded is closed.

**Not closed here:** the entries ADR 0005 requests for "Portfolio operating folders" and
"Existing Portfolio investment" are still missing from the same list. ADRs 0004 and 0005 remain
Proposed, and their amendments were not part of this approval.

The original request is kept below unaltered.

## Outstanding, and deliberately not done here (as originally proposed)

The specification is precedence authority #2 and is not edited from code (ADR 0003, 0004,
0005). The RADAR Owner needs to make two amendments to the controlled specification, and then
to the copy at `docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`:

1. Add a BecaTech+ clause, for example after SPECIAL CASE - EMERGENCY RESPONSE:

   ```
   SPECIAL TEMPLATE - BECATECH+ PARTNERS AND PROVIDERS
   Path: 02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/BecaTech+/04_Partners_and_Providers
   04_Partners_and_Providers
   ├── Partners
   │   └── [Organization_Name]
   │       ├── Proposal
   │       ├── Agreement
   │       └── Reports
   └── Providers
       └── [Organization_Name]
           ├── Proposal
           ├── Agreement
           └── Reports
   - Partners and Providers are BecaTech+-specific organization containers and must already exist.
   - One organization folder is created beneath the selected container, with exactly Proposal, Agreement and Reports.
   - This does not change the generic In-house Program template and adds no top-level category.
   - RADAR does not manage permissions for these folders.
   ```

2. Add "BecaTech+ partner or provider" to "Current structure types shown in the tool" (this
   combines with the list changes ADR 0005 requests).

Optionally, the specification's Beca Tech references (LAUNCH SEED EXAMPLES, OPEN VALIDATIONS)
could name the folder `BecaTech+`. They are prose and are left to the Owner.

Once these land, change this ADR's status to Accepted. Until then this is a **recorded
divergence**.
