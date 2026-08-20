# RADAR — Engineering Playbook

This file defines how humans and coding agents work in the RADAR repository. It
is the operational source of truth for engineering practice. Product and
information-governance decisions remain governed by the approved RADAR policy
and canonical architecture specification.

If this playbook conflicts with an approved governance document, the governance
document wins. Stop, describe the conflict, and request a decision; do not
silently reinterpret the canonical architecture.

## 0. Working agreement

### 0.1 Inspect before changing

Before non-trivial work:

1. Read this file and the references relevant to the task.
2. Inspect the working tree, current branch, existing implementation, tests,
   package scripts, and repository conventions.
3. Identify the policy rule, canonical path, object lifecycle, and Drive access
   involved.
4. Propose the smallest safe increment.

Preserve unrelated user changes. Never use destructive Git commands to clear a
dirty working tree. Do not push, merge, deploy, or access a live Shared Drive
unless the task explicitly authorizes it.

### 0.2 Small, reviewable increments

Keep each branch and pull request focused on one logical outcome. Separate:

1. the requested product or operational change;
2. necessary supporting refactoring;
3. technical debt that can be recorded for later; and
4. ideas outside the current scope.

Do not combine a broad architecture rewrite with a user-facing feature. At the
end of an increment, report what works, what remains, the checks run, and any
new debt or risk.

### 0.3 Prefer explicit, deterministic behavior

RADAR is a governance tool. Prefer simple, explainable rules and typed or
validated canonical configuration over hidden heuristics, duplicated folder
trees, or premature abstraction.

The classifier's transparency is a feature. Do not replace deterministic
routing with an LLM. An LLM may eventually assist only with explicitly
ambiguous cases, must explain uncertainty, and must never authorize a Drive
operation.

### 0.4 Documentation travels with the change

Update documentation, examples, fixtures, configuration, and operations notes
in the same pull request as the behavior they describe. Add environment
variables to the example environment file; never add real credentials, tokens,
Drive IDs, personal emails, or confidential filenames.

### 0.5 One coherent change per commit

Do not mix unrelated formatting or refactoring into a feature commit. Follow
the commit convention and authorship requirements in §0.10.

### 0.10 Commit convention and authorship

- Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
  `fix:`, `chore:`, `docs:`, `refactor:`, and `test:`.
- Use one author only: `[define Git user]`. Configure the intended human author
  through `git config user.name` and `git config user.email` before committing.
- Do not add `Co-Authored-By: Claude`, another AI attribution, or any other
  co-author trailer.
- If the intended Git author is not defined, stop before committing and ask for
  the correct name and email. Do not guess an identity.

## 1. Product purpose

RADAR is the official system for organizing, locating, and preserving
institutional information. It exists to improve traceability, searchability,
continuity, lifecycle management, and appropriate access.

The product should help a person consistently answer:

- What object or institutional process does this information primarily serve?
- What is its one official home?
- Does the recommended canonical path exist in the Shared Drive?
- Is the current Drive structure drifting from the approved architecture?

RADAR must not encourage parallel taxonomies or duplicate final files. Use a
Drive shortcut or link when the same information needs visibility elsewhere.

## 2. Sources of truth

When evidence conflicts, use this precedence order:

1. Approved **RADAR Information & File Management Policy**.
2. **RADAR v06 Canonical Folder Tree — Automation Specification**
   (`docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`).
3. Master Registry schema and documented lifecycle rules.
4. Accepted Architecture Decision Records (ADRs).
5. This repository (`AGENTS.md`, operations guides, testing guidance).
6. Versioned automated tests and evaluation fixtures.
7. Application and automation code.
8. The folder structure currently observed in Drive.

Existing code and existing Drive folders are not automatically authoritative;
they may reveal drift. The Google Apps Script is an implementation reference,
not the governance source of truth.

Do not claim that a proposal or ADR is approved unless approval is documented.

## 3. Canonical invariants

Every implementation must preserve these rules:

1. The fixed roots are `01_STRATEGY`, `02_INVESTMENTS_AND_PROGRAMS`,
   `03_INSTITUTIONAL`, and `99_ARCHIVE`.
2. Core programmatic themes are `Education` and `Democracy`. `Cross_Thematic` is used
   only where the canonical tree explicitly defines it (Exploration, In-house Programs,
   Learning Products, External Knowledge, Closed In-house Programs); it is not a general
   "other" category, and theme validity is per location rather than a global enum.
3. Strategic focus is metadata, not a mandatory physical path.
4. One object has one official folder; use links or shortcuts instead of a
   second final copy.
5. Pipeline stage changes do not move an organization folder. Sourcing,
   Screening, and Diligence are subfolders inside the object.
6. Concept Review belongs to the project's Screening history.
7. Investment Committee belongs to the project's Investment Due Diligence
   history.
8. Concept Review and Investment Committee are never stored as central
   Governance meeting folders.
9. After approval, move the complete Pipeline object folder once to Portfolio,
   preserve its history, and add Portfolio operating folders.
10. After decline or withdrawal, move the complete object to
    `99_ARCHIVE/01_Declined_Pipeline` and retain its Master Registry record and
    link.
11. Venture graduation moves the complete folder to Portfolio, In-house
    Programs, or Archive according to its resulting operating model.
12. Maintain one canonical `00_Master_Registry`. Other indexes are automated
    views, not separate manually maintained databases.
13. Every Portfolio, Venture Building, and In-house object includes
    `Photos_and_Videos` in its specified template.
14. Policies live under `03_INSTITUTIONAL/00_POLICIES`.
15. Charity is a separate Transversal Area, not a Legal subfolder.
16. Third-party reference material belongs in `05_EXTERNAL_KNOWLEDGE`;
    ver+-produced work belongs in `03_RESEARCH_AND_LEARNING`.
17. Reusable MEL systems, methodologies, instruments, indicator frameworks,
    and organization-wide guidance belong in the institutional MEL area.
18. Do not auto-create detailed Transversal Area structures beyond the
    canonical minimum without owner validation.
19. Special templates for Beca Tech and Democracia+ must follow the canonical
    specification.
20. Sensitive participant, beneficiary, People, Legal, Finance, Charity, and
    governance material uses least-privilege access.

New permanent folder categories or alternative taxonomies require a recurring
need and approval from the RADAR Owner and relevant functional owner. Material
organization-wide exceptions require the approval defined by the policy.

## 4. Architecture direction

Keep the following responsibilities distinct:

- **Governance truth:** approved policy and canonical specification.
- **Implementation truth:** a versioned, machine-readable representation of
  the canonical tree and dynamic templates.
- **Observed state:** folders and files returned by the Drive API.

Classifier routing, path resolution, tree validation, and automation should
consume or be generated from the machine-readable model rather than maintain
independent hardcoded trees indefinitely.

Migrate incrementally:

1. validate the canonical configuration;
2. make read-only path resolution consume it;
3. compare recommended paths with the live Drive;
4. migrate classifier path output;
5. migrate automation generation;
6. remove duplicated definitions only after equivalence tests pass.

Do not turn observed Drive drift into canonical configuration automatically.

## 5. Risk levels

### Low risk

Examples: copy, styling, accessibility, documentation, and non-functional UI.

Required: focused implementation, relevant checks, and visual/manual review.

### Medium risk

Examples: classification rules, Master Registry reads, search behavior, path
resolution, configuration parsing, and Drive existence checks.

Required: validated data model, deterministic business rule, unit tests,
representative evaluation fixtures, failure states, and RADAR Owner review when
canonical routing could change.

### High risk

Examples: folder creation, Registry writes, moves, archiving, permission
changes, or any operation affecting live Drive data.

Required: backend authorization, least privilege, a test Drive, dry run, exact
target preview, explicit human confirmation, idempotency, audit events,
partial-failure handling, observability, recovery plan, and owner approval.

### Critical risk

Examples: recursive restructuring, bulk moves, broad permission changes,
canonical-root changes, or organization-wide information migration.

Required: a separate reviewed change plan, inventory or backup/export, staged
execution, rehearsal in a test environment, named approvers, rollback or
recovery procedure, and material-exception approval where required by policy.

If uncertain, classify the change at the higher risk level.

## 6. Definition of Ready

A non-trivial story is ready when it states:

- problem and intended user outcome;
- relevant policy or canonical rule;
- affected workflow: Classify, Search, Registry, or Drive automation;
- canonical objects, paths, templates, and lifecycle transitions involved;
- data sources and permissions;
- risk level and read/write classification;
- acceptance criteria;
- empty, loading, ambiguous, error, and fallback behavior;
- automated and manual test scenarios;
- logging and audit expectations;
- dry-run, confirmation, and recovery behavior where applicable;
- dependencies, owner, approver, and explicit out-of-scope items.

If information is missing, identify the gap, propose the safest reversible
interpretation, and flag what needs validation. Do not silently invent a new
canonical rule.

## 7. Definition of Done

A change is done when:

- acceptance criteria are satisfied;
- canonical names and paths match the governing specification;
- business rules have one authoritative implementation;
- loading, empty, ambiguous, permission-denied, and expected error states work;
- relevant tests and classifier evaluation pass;
- previously correct routing cases do not regress without an intentional spec
  change;
- logs, analytics, fixtures, screenshots, and errors contain no secrets or
  sensitive document content;
- accessibility is checked for affected interactions;
- documentation and operations guidance are updated;
- rollback or disable behavior is understood;
- high-risk Drive behavior has passed test-Drive dry run, confirmation,
  idempotency, audit, failure, and recovery checks;
- the final diff contains no unrelated changes or generated debris.

If a check cannot run, report why. Never describe an unrun check as passing.

## 8. Drive safety

Read-only is the default. A classification recommendation never authorizes a
folder creation, move, archive, deletion, or permission change.

Any write-capable flow must:

1. receive an explicit target Shared Drive ID;
2. verify that every parent belongs to that Drive;
3. use least-privilege credentials and never expose them to the client;
4. be tested on a dedicated test Drive or isolated test root;
5. produce a dry-run plan with exact targets and consequences;
6. require explicit human confirmation;
7. be idempotent and safe to retry;
8. emit an audit record without sensitive content;
9. handle partial failure and report what did and did not happen;
10. document recovery before execution.

A Git revert cannot reverse an already completed Drive operation. Do not call a
Git rollback a data rollback.

Apps Script runs with the authorizing user's normal Drive permissions. Script
guards constrain the script but do not reduce that user's account access.

Never commit Drive IDs, OAuth credentials, API keys, tokens, personal data,
participant or beneficiary data, confidential notes, or production file lists.

## 9. Testing strategy

Test where failure damages trust:

### Canonical configuration

- JSON/schema validity;
- exact folder names and numbering;
- static roots separated from dynamic templates;
- placeholders treated as placeholders, not literal folders;
- special-object templates;
- restricted-folder metadata where applicable;
- equivalence with the approved specification.

### Classifier evaluation

Maintain a labeled, fictional fixture set covering normal, edge, and ambiguous
cases. Include Concept Review, Investment Committee, Legal Due Diligence,
Portfolio reporting, MEL, policies, governance, internal research, external
knowledge, Venture Building, In-house Programs, special templates, and Archive.

On every rule change, report regressions against previously accepted cases.
Human-reviewed corrections should become fixtures when they express a stable
canonical rule. Do not store raw confidential descriptions as training or test
data.

### Drive integration

Use a test Shared Drive or isolated test root. Test exact-name matching,
Drive-scoping, missing permissions, path existence, drift reporting,
idempotency, dry run, retry behavior, and partial failure. CI must never write
to the production Drive.

### Repository commands

Use only commands actually defined by the repository. Inspect `package.json`,
the lockfile, and CI before running or documenting commands. As applicable, run
formatting, linting, type checking, unit tests, evaluation, production build,
JSON/YAML validation, and `git diff --check`.

## 10. Git and review workflow

Branch from the repository's default branch using:

- `feat/<issue>-<description>`
- `fix/<issue>-<description>`
- `docs/<description>`
- `chore/<description>`
- `hotfix/<description>`

Protect the default branch. Use pull requests and require CI. Prefer short-lived
branches and squash merge unless the repository documents another convention.

Every pull request must explain:

- problem and policy/spec references;
- scope and explicit exclusions;
- risk and Drive behavior;
- data and permission impact;
- implementation and trade-offs;
- tests, evaluation, and manual verification;
- screenshots for visual changes;
- dry-run evidence for Drive writes;
- rollback or recovery;
- documentation changes.

Canonical architecture changes require an ADR and the relevant owner approval.
Reviewers must deliberately verify every canonical-path change.

## 11. Release and operations

Deploy only from the protected default branch using the repository's documented
pipeline. Prefer preview/staging validation before production and require manual
approval for high-risk releases.

Release write-capable Drive functionality progressively:

1. display the resolved canonical path;
2. verify whether it exists;
3. display a dry-run creation or transition plan;
4. enable confirmed creation only after safeguards are proven;
5. introduce move/archive operations only after audit and recovery are proven.

Record user-visible changes under `Unreleased` in `CHANGELOG.md` when present.
Do not fabricate environments, releases, or stakeholder approvals.

## 12. Product priorities

Unless a newer approved roadmap says otherwise, prefer this sequence:

1. single-source the canonical folder model;
2. connect Classify output to read-only live Drive path verification;
3. report an Open-in-Drive link or canonical/observed drift;
4. integrate known objects from the Master Registry;
5. build a labeled classifier evaluation set and run it in CI;
6. capture lightweight reviewed recommendation feedback;
7. improve error isolation and accessibility;
8. consider controlled Drive writes only after the read-only foundation is
   stable.

## 13. Never do

- Create a new root or permanent taxonomy without required approval.
- Maintain duplicate final files when a shortcut or link is appropriate.
- Treat current Drive state as automatically canonical.
- Store Concept Review or Investment Committee as central Governance meetings.
- Rebuild or copy an object when its lifecycle requires moving the complete
  folder.
- Maintain multiple manual master registries.
- Allow classifier output to trigger an unattended Drive write.
- Run integration tests against the production Drive.
- Log secrets, sensitive file content, or personal information.
- Hide failures with broad ignores, skipped checks, or always-passing CI.
- Replace deterministic classification wholesale with an LLM.
- Claim an operation is reversible when no tested recovery exists.

## 14. Documentation map

Use the repository's actual paths when available:

| Need | Reference |
|---|---|
| Information governance | RADAR Information & File Management Policy |
| Exact folder architecture and templates | RADAR v06 Canonical Folder Tree — Automation Specification (`docs/specs/`) |
| Current product priorities | RADAR features roadmap |
| Drive automation behavior | Apps Script source and operations guide |
| Architecture decisions | `docs/decisions/` |
| Drive setup and safety | `docs/operations/` |
| Classifier evaluation | `docs/testing/` and evaluation fixtures |
| Contribution workflow | `CONTRIBUTING.md` |
| Current commands and setup | `README.md` and repository package scripts |

If a referenced file has not yet been added to the repository, say so and work
from the available approved source. Do not recreate controlled policy text from
memory.
