# Create structure — operations guide

How the canonical folder creator works, what it deliberately will not do, and what has to be
configured before it is useful.

Governance documents outrank this file. If it disagrees with the approved RADAR policy or the
v05 canonical specification, those win and this file is the bug.

## What it does

Adds a third primary workflow beside Search and Classify. An administrator picks an approved
structure type, supplies its details, previews the result against the live Shared Drive,
confirms explicitly, and RADAR creates the missing folders.

RADAR's first write-capable feature, so every guardrail in `AGENTS.md` §8 applies: preview,
revalidation, explicit confirmation, idempotency, audit, precise partial-failure reporting,
and no auto-creation of missing canonical roots.

## Supported structures

| Structure | Destination | Registry record |
|---|---|---|
| Pipeline organization | `02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/{theme}/{name}` | Pipeline |
| Venture Building initiative | `02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/{theme}/{name}` | Venture_Building |
| In-house program | `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/{theme}/{name}` | In_House_Program |
| Policy | `03_INSTITUTIONAL/00_POLICIES/{name}` | — |
| Formal governance meeting | `03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/{forum}/{YYYY}/{YYYY-MM-DD_Forum}` | — |
| Annual OKR cycle | `01_STRATEGY/03_OKRs/{YYYY}` | — |

Themes are exactly `Education` and `Democracy`. Forums are exactly Board, Leadership Team,
All Team and Offsites — Concept Review and Investment Committee are project-level investment
gates and can never be selected here (policy §3.1, spec design rule 6).

The yearly Meeting Log is a **Google document**; everything else is a folder.

## What it deliberately will not do

Each of these is enforced by a test, not just by convention.

- **No Portfolio creation.** Approval *moves* the complete Pipeline folder to Portfolio and
  preserves its history. A "new Portfolio object" button would produce exactly the
  rebuilt-instead-of-moved folder the policy forbids. The transition workflow is out of scope.
- **No root-tree bootstrap and no launch seeds.** A missing canonical root is architecture
  drift: it is reported to the administrator and never repaired automatically. No sample
  organizations are ever created.
- **No dated gate packages.** A new pipeline object gets empty `02_Concept_Review` and
  `04_Investment_Committee` folders. The dated package is created when the gate happens.
- **No deletion, move, rename or permission change.** Ever, on any path.
- **No LLM.** Structure generation is deterministic template expansion.

## Required access

There is **no RADAR-specific admin list**. The signed-in user's Google Drive role is the
authorization, and Google enforces it:

- The preview probes `capabilities/canAddChildren` on the destination parent and blocks the
  flow when the answer is no.
- That probe is a courtesy. The authoritative refusal is the 403 Google returns on the write.

In practice: **Content Manager or higher on the RADAR Shared Drive.** Everyone else can open
the workflow and will be told they cannot create there.

## Google OAuth scopes

Search and Classify run on `drive.readonly`. Write scopes are requested **incrementally**,
only when an administrator opens Create structure, so an ordinary reader never consents to
anything that can modify the Shared Drive.

| Scope | Why |
|---|---|
| `https://www.googleapis.com/auth/drive` | create folders and Google documents; list children of canonical parents |
| `https://www.googleapis.com/auth/spreadsheets` | read/append the Master Registry and audit spreadsheets |

`drive.file` would be narrower and was preferred, but it is unusable here: idempotency
depends on listing the children of canonical parents that this app did not create, which
`drive.file` does not grant. Without that listing, a rerun could not tell an existing folder
from a missing one and would create duplicates.

The elevated token is held in React state for the session only. It is never persisted to
`localStorage`, never logged, and never sent anywhere except Google's own APIs.

## Configuration

See `.env.example`. All four variables are `VITE_`-prefixed and therefore embedded in the
browser bundle — acceptable because none is a secret. They are identifiers. RADAR holds no
client secret, no API key and no service-account key.

| Variable | Required | Effect if unset |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | yes | no sign-in |
| `VITE_SHARED_DRIVE_ID` | yes | Create structure refuses to run |
| `VITE_RADAR_REGISTRY_SHEET_ID` | no | Registry reported `PENDING_CONFIGURATION`, never as written |
| `VITE_RADAR_AUDIT_SHEET_ID` | no | **no durable audit trail**, stated plainly in the UI |

### Master Registry

Columns are matched **by name** from the header row, so column order does not matter. These
must exist: `Object_Name`, `Theme`, `Object_Type`, `Official_Folder_Link`. RADAR also writes
`Strategic_Focus`, `Country_or_Geography`, `Owner` and `Last_Updated` when those columns are
present, and leaves every other column alone.

`Current_Stage_or_Status` is **never written**. The specification is explicit that a human
determines type and status and that automation must not infer an investment decision.

Upsert is idempotent and matched on canonical identity (name + theme + object type,
case-insensitively). A row already pointing at a *different* official folder is reported as a
conflict and left untouched — one object has exactly one official home.

### Audit spreadsheet

Must already exist with this exact header row, in this order:

```
Timestamp | Actor | Structure_Type | Inputs | Destination_Path | Plan_Hash | Operation_Id |
Outcome | Created_Items | Reused_Items | Registry_Result | Warnings | Failure_Stage | Error
```

RADAR does not create or repair it: an audit trail the audited system can silently recreate
is not much of an audit trail. One row is appended per attempted execution — success, partial
success and failure alike. Events are assembled field by field from a known shape, and keys
matching `token|secret|password|credential|authorization|api key` are dropped, so tokens and
file contents cannot leak in.

## Local development

```bash
cp .env.example .env      # then fill in real values — point at a TEST Shared Drive
npm install
npm run dev               # http://localhost:5173
npm run test              # 332 tests; no Google credentials required
npm run build
```

There are no lint, format or type-check scripts in this repository.

Drive and Sheets are faked in memory for every test (`src/services/__fixtures__/fakeDrive.js`),
so the suite never touches a real drive. CI runs `npm run test` and `npm run build` only.

## Deployment

The app is static (`npm run build` → `dist/`). Add the production origin to the OAuth
consent screen's authorized JavaScript origins and set the environment variables in the
hosting platform. Because the variables are build-time, changing a Shared Drive or
spreadsheet id requires a rebuild.

Roll out progressively, per `AGENTS.md` §11: point `VITE_SHARED_DRIVE_ID` at a **test Shared
Drive** first and run the manual verification below before pointing at production.

## Safety model, stated precisely

- **Preview is read-only.** Only the Drive client's read methods are reachable from it.
- **The browser never submits a tree that gets executed.** Execution takes `(type, inputs,
  confirmedHash)` and regenerates the plan itself. Keys that look like an override
  (`destination`, `parentId`, `driveId`, `items`, `template`, …) are rejected outright.
- **The plan hash is an integrity and staleness check, not a security control.** RADAR runs
  in the browser with the user's own Drive token, so the confirming user and any would-be
  tamperer are the same principal — someone determined to create arbitrary folders can
  already call the Drive API directly. FNV-1a is not cryptographic and is not treated as one.
  Its job is to catch inputs that changed after the preview. The real authorization boundary
  is the Shared Drive ACL, enforced by Google.
- **Everything is re-checked immediately before writing**, because Drive can change between
  preview and confirmation.
- **Every created item is verified to be in the configured Shared Drive.** A mismatch stops
  the operation.

### Blocking conflicts

Creation is refused, and nothing is written, when:

| Condition | Why |
|---|---|
| a canonical parent is missing | architecture drift; roots are never auto-created |
| a canonical path segment is duplicated | the destination is ambiguous |
| a planned item exists with the wrong type | reusing it would corrupt the structure |
| two or more items match a planned name exactly | RADAR will not guess which is official |
| the user cannot add children to the destination | not authorized |
| the Registry records a different official folder | would create a second official home |

Warnings requiring explicit acknowledgement (not blocking): the restricted beneficiary-data
folder, and an object name that already exists in Portfolio or the declined-pipeline archive.

## Sensitive folders

`05_Participants_and_Beneficiary_Data` in the In-house Program template is marked
**restricted** in the preview and requires a separate acknowledgement before creation.

**RADAR creates the folder but does not configure its access.** No permissions API is called
and no user or group is invented. The result reports that permission configuration is still
required. Nothing in the UI ever claims that access has been restricted.

Apply the access policy by hand, before any participant or beneficiary data is stored.

## Recovery after partial failure

There is no transactional cleanup in this architecture, so there is none pretended.

If a write fails partway, RADAR stops immediately, **deletes nothing**, and reports exactly
which items were created and which were not. The result says the items were left in place and
that no rollback occurred.

**Retry is safe.** Execution is idempotent: a rerun reuses every existing item by exact name,
expected MIME type and expected parent, and creates only what is missing. The "Retry safely"
button re-previews against live Drive first.

If Drive creation succeeded but the Registry write failed, the outcome is partial success and
retrying completes the Registry record without touching the folders.

## Known limitations

1. **Concurrency is narrowed, not eliminated.** The in-flight guard is module state in one
   browser tab, not a distributed lock. Two tabs or two administrators acting simultaneously
   can still race, and Drive permits duplicate folder names. Execution re-checks after
   creating and raises a `DUPLICATE_CREATED` warning, but cannot prevent the race. Closing it
   needs a server-side lock — Apps Script `LockService` or a backend. That is the extension
   point.
2. **Operation results are in-memory.** Status and retry survive re-renders but not a page
   reload. The audit spreadsheet is the durable record.
3. **The classifier is not yet migrated.** `canonicalTree.js` is the single source of truth
   for the creator, but `src/utils/radarClassify.js` still builds paths from inline template
   literals. `src/radar/classifierEquivalence.test.js` proves the two agree and fails the
   build if they drift; migrating the classifier to consume the config is the documented next
   step (`AGENTS.md` §4 stages it behind exactly this kind of equivalence test).
4. **Pre-existing:** the read-only search helper in `src/utils/driveApi.js` escapes
   apostrophes but not backslashes in Drive queries. Left untouched to preserve Search
   behavior. New code uses `escapeDriveQueryValue`, which escapes both.
5. **`Current_Stage_or_Status` is never populated** by automation, by design.

## Extension points

Left clean, with no partial unsafe behavior:

- Pipeline → Portfolio transition (move the folder, then add operating folders 05–12)
- Decline/withdrawal → `99_ARCHIVE/01_Declined_Pipeline`, retaining the Registry record
- Venture graduation
- Dated Concept Review / Investment Committee gate packages
- Server-side locking and a server-enforced authorization boundary
