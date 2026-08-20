# RADAR — Claude Code Instructions

Read `AGENTS.md` before every non-trivial task. It is the complete engineering
playbook for this repository.

## Mission

RADAR organizes, locates, and preserves institutional information through one
official home per file, canonical object/lifecycle structures, and appropriate
access. The application should make routing explainable and expose drift
between the approved architecture and the observed Shared Drive.

## Precedence

When sources conflict:

1. Approved RADAR Information & File Management Policy.
2. RADAR v06 Canonical Folder Tree — Automation Specification
   (`docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`).
3. Master Registry schema and lifecycle rules.
4. Accepted ADRs.
5. `AGENTS.md` and repository operations/testing guidance.
6. Tests and evaluation fixtures.
7. Code.
8. Current Drive structure.

Stop and report material conflicts. Do not silently change the canonical
architecture or treat existing code/Drive state as authority.

## Non-negotiable rules

- Fixed roots: `01_STRATEGY`, `02_INVESTMENTS_AND_PROGRAMS`,
  `03_INSTITUTIONAL`, `99_ARCHIVE`.
- Core programmatic themes are `Education` and `Democracy`. `Cross_Thematic` is valid
  only where the canonical tree defines it — Exploration, In-house Programs, Learning
  Products, External Knowledge, and Closed In-house Programs — and is not a general
  "other" category.
- One object, one official folder; use links/shortcuts instead of duplicate
  final files.
- Pipeline stages remain inside the object folder.
- Concept Review stays under project Screening.
- Investment Committee stays under project Investment Due Diligence.
- Neither gate belongs in central Governance.
- Approval moves the complete Pipeline object once to Portfolio and preserves
  history.
- Decline/withdrawal moves the complete object to Archive while retaining its
  Master Registry record/link.
- Maintain one `00_Master_Registry`; other indexes are automated views.
- Policies live under `03_INSTITUTIONAL/00_POLICIES`.
- Do not add permanent folder categories without required owner approval.
- The classifier is deterministic and explainable; do not replace it wholesale
  with an LLM.

## Drive safety

Read-only is the default. Never let a recommendation automatically create,
move, archive, delete, or change access to Drive content.

Do not access or write to a live Shared Drive unless the task explicitly
authorizes it. Any write requires a test Drive, exact Drive/parent validation,
least privilege, dry run, explicit human confirmation, idempotency, audit,
partial-failure handling, and a documented recovery plan.

Never commit credentials, tokens, Drive IDs, personal data, beneficiary data,
confidential notes, or production file inventories.

## Before changing code

1. Run `git status` and preserve unrelated work.
2. Inspect the current branch, code, tests, package manager, and scripts.
3. Read the relevant policy/specification, ADR, operations, and testing files.
4. Identify risk: low, medium, high, or critical, as defined in `AGENTS.md`.
5. State the smallest safe increment and its acceptance criteria.

Do not push, merge, deploy, or perform live Drive operations without explicit
authorization. Do not use destructive Git commands to clear existing work.

## Task routing

| Task involves | Read first |
|---|---|
| Folder names, paths, templates, lifecycle | Canonical v06 specification (`docs/specs/`) |
| Ownership, exceptions, sensitive access | Approved RADAR policy |
| Classifier or path resolver | Canonical config, evaluation fixtures, testing guidance |
| Master Registry | Registry schema and lifecycle documentation |
| Drive API or Apps Script | Drive operations guide and automation source |
| Architecture change | `docs/decisions/` and ADR convention |
| Setup, CI, deployment, rollback | `README.md`, workflow files, `docs/operations/` |

## Implementation expectations

- Prefer validated canonical configuration over duplicated hardcoded trees.
- Keep governance truth, implementation configuration, and observed Drive state
  distinct.
- Make small, reviewable changes and avoid unrelated refactoring.
- Use fictional, non-sensitive test data.
- Add regression cases for intentional classifier-rule changes.
- Handle loading, empty, ambiguous, permission-denied, and expected error
  states.
- Update documentation and operations notes in the same change.
- Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
  `fix:`, `chore:`, `docs:`, `refactor:`, and `test:`.
- Use one author only: `[define Git user]`. If the intended human Git author is
  not configured, stop before committing and request the correct name and
  email; never guess an identity.
- Do not add `Co-Authored-By: Claude`, another AI attribution, or any other
  co-author trailer.

## Verification

Use only commands that actually exist in this repository. Inspect
`package.json`, the lockfile, and CI configuration before choosing commands.

As applicable, run:

- formatting check;
- lint;
- type checking;
- unit tests;
- classifier evaluation;
- production build;
- JSON/YAML validation;
- `git diff --check`.

CI and automated tests must never write to the production Shared Drive. If a
check cannot run, report the reason; never describe it as passing.

Finish by reporting changed files, decisions, checks and results, canonical
discrepancies, remaining risks, and exact `git status`.
