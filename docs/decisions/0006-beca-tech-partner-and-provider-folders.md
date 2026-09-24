# ADR 0006 — Beca Tech partner and provider organization folders

- **Status:** Proposed
- **Date:** 2026-09-24
- **Deciders:** RADAR owner and the Education functional owner. The request, stated in the task
  that produced this change, is that the recurring need was raised by the Education functional
  owner and approved for implementation in RADAR. **The RADAR Owner's approval of the canonical
  change is not recorded here** (`AGENTS.md` §3 requires both). This ADR must not be marked
  Accepted, and the structure must not be used against the production Shared Drive, until that
  approval and the specification amendment in *Outstanding* are recorded.
- **Affects:** v06 DYNAMIC TEMPLATE - IN-HOUSE PROGRAM (Beca Tech only), EMPTY STRUCTURE
  CREATION RULE; `AGENTS.md` §3 invariant 19 (Beca Tech special template), §5 (risk), §8 (Drive
  safety); ADR 0001 (client-side controlled writes).

## Context

The Education team keeps creating the same folders by hand for each organization Beca Tech
works with. Beca Tech's `04_Partners_and_Providers` already holds two containers, `Partners`
and `Providers`, and each organization under them gets `Proposal`, `Agreement` and `Reports`.

v06 does not describe any of this. It says only that Beca Tech uses the In-house Program
template, which leaves `04_Partners_and_Providers` empty. Adding permanent folders below it is a
canonical change and needs a record.

## Decision

### 1. One Beca Tech-specific structure type

`beca_tech_partner_or_provider` — "Beca Tech partner or provider". It collects two fields:

- `organizationKind`: a closed allowlist, `partner` → `Partners`, `provider` → `Providers`
  (`BECA_TECH_ORGANIZATION_KINDS` in `canonicalTree.js`, validated like governance forums);
- `objectName`: the organization name, validated by the same folder-name rules as every other
  structure and kept exactly as typed.

It creates `[Organization_Name]/Proposal`, `/Agreement` and `/Reports`. Nothing else. The
bare id `beca_tech` stays unsupported, because it names creating the program itself.

### 2. Scoped to Beca Tech, not the In-house template

Only Beca Tech has shown the need. Adding `Partners`/`Providers` to the generic template would
create them in every new In-house program, Emergency_Response included, and would be an
organization-wide change nobody has asked for. A test asserts the generic template still
produces an empty `04_Partners_and_Providers`.

### 3. The destination is fixed and must already exist

```
02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/04_Partners_and_Providers/{Partners|Providers}
```

The whole path is `parentSegments`, so a missing level — `Beca_Tech`,
`04_Partners_and_Providers`, or the chosen container — is `MISSING_CANONICAL_PARENT`: drift,
blocked, nothing written, never repaired. Only the organization folder is in
`createdSegments`. No input can change the path: there is no theme field, and override keys
are rejected as they are for every structure.

`Beca_Tech` is spelled as the classifier routes it and its evaluation fixtures assert. The
request that produced this change wrote `BecaTech+`, and the specification prose writes "Beca
Tech" with no folder literal. The repository was followed. If the live folder is spelled
differently, preview blocks with a missing-parent error rather than writing anywhere, and the
fix is one constant (`SEGMENTS.BECA_TECH`) — after checking against the classifier, which uses
the same literal.

### 4. Identity is scoped to the chosen container

`Partners/Acme` and `Providers/Acme` are independent. These are operational folders inside one
object, not Registry lifecycle objects, so design rule 4 ("one object = one official folder")
is about Beca Tech itself and not about them. Applying the Portfolio-style Drive-wide absence
check would invent a rule the specification does not state. This is the narrowest reading;
if the owners decide an organization may appear in only one of the two containers, a
sibling-container check is the extension point.

### 5. No Registry row, no permission changes

`registry.applicable` is `false`, and no new `Object_Type` is invented. The folders are not
marked restricted and no advisory is raised: nothing in the policy or specification names
them as sensitive. Existing Drive access applies. The Drive client exposes no permissions
verb, which `driveStructureApi.test.js` asserts.

### 6. Safety model inherited unchanged

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

## Consequences

- Education staff create an organization workspace through the standard wizard.
- `classifierEquivalence.test.js` holds the classifier's Beca Tech
  `04_Partners_and_Providers` route and the creator's parent path to the same folder.
- `PLAN_VERSION` is unchanged: no existing plan changes shape.
- If another In-house program adopts the convention, the extension point is a program-keyed
  version of `BECA_TECH_PARTNERS_AND_PROVIDERS_SEGMENTS`. Do not change the generic template
  without an organization-wide decision.

## Outstanding, and deliberately not done here

The specification is precedence authority #2 and is not edited from code (ADR 0003, 0004,
0005). The RADAR Owner needs to make two amendments:

1. Add a Beca Tech clause, for example after SPECIAL CASE - EMERGENCY RESPONSE:

   ```
   SPECIAL TEMPLATE - BECA TECH PARTNERS AND PROVIDERS
   Path: 02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/04_Partners_and_Providers
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
   - Partners and Providers are Beca Tech-specific organization containers and must already exist.
   - One organization folder is created beneath the selected container, with exactly Proposal, Agreement and Reports.
   - This does not change the generic In-house Program template and adds no top-level category.
   - RADAR does not manage permissions for these folders.
   ```

2. Add "Beca Tech partner or provider" to "Current structure types shown in the tool" (this
   combines with the list changes ADR 0005 requests).

Until these land, this is a **recorded divergence**, and it is why this ADR stays *Proposed*.
