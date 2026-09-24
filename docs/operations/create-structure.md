# Create structure — operations guide

How the canonical folder creator works, what it deliberately will not do, and what has to be
configured before it is useful.

Governance documents outrank this file. If it disagrees with the approved RADAR policy or the
v06 canonical specification (`docs/specs/2026-08-18_RADAR_Folder_Tree_v06.txt`), those win and
this file is the bug.

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
| Portfolio operating folders | `02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/{theme}/{name}` — **must already exist** | — (change `Object_Type` by hand) |
| Existing Portfolio investment | `02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/{theme}/{name}` — **must not exist anywhere** | Portfolio |
| Beca Tech partner or provider | `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/04_Partners_and_Providers/{Partners\|Providers}/{name}` | — |

Themes are **per structure type**, not one global list (v06 design rule 2):

| Structure type | Themes offered |
|---|---|
| Pipeline organization | `Education`, `Democracy` |
| Venture Building initiative | `Education`, `Democracy` |
| In-house program | `Education`, `Democracy`, `Cross_Thematic` |
| Portfolio operating folders | `Education`, `Democracy` |
| Existing Portfolio investment | `Education`, `Democracy` |

`Cross_Thematic` is used only where the canonical tree defines it and is not a general
"other" category, so the creator rejects it for Pipeline and Venture Building outright.
**Emergency Response** needs no structure type of its own: it is an In-house program with
theme `Cross_Thematic` and object name `Emergency_Response`, using the standard template.

`0A_EXPLORATION` is not creatable here. An exploration folder has no template — it is a plain folder under
`0A_EXPLORATION/{theme}`. Preview does read those three theme folders, to warn when an
object being promoted to Pipeline still has an exploration home (design rule 19).

Forums are exactly Board, Leadership Team, All Team and Offsites — Concept Review and
Investment Committee are project-level investment gates and can never be selected here
(policy §3.1, spec design rule 6). `05_Weekly_Email` is deliberately **not** a forum: the v06
formal-governance template applies only to those four, and the weekly email folder is a
pre-existing restricted folder the creator never touches (see
[access-control.md](access-control.md)).

The yearly Meeting Log is a **Google document**; everything else is a folder.

## What it deliberately will not do

Each of these is enforced by a test, not just by convention.

- **No Portfolio *object* creation, and no lifecycle move.** Approval *moves* the complete
  Pipeline folder to Portfolio and preserves its history. A "new Portfolio object" button would
  produce exactly the rebuilt-instead-of-moved folder the policy forbids, so there is none —
  and RADAR has no move verb at all, so it cannot perform the move either. What it does offer
  is **Portfolio operating folders**, which *adds* subfolders 05–12 to a folder a human has
  already moved, and blocks if that folder is not there. See
  [ADR 0004](../decisions/0004-portfolio-operating-folders-are-additive.md).
- **No Master Registry lifecycle change.** A Registry row is matched on Object_Name + Theme +
  Object_Type, so writing a Portfolio row would append a duplicate rather than update the
  existing Pipeline one. RADAR reports the change and never makes it.
- **No Portfolio object for an organization that already has a folder.** *Existing Portfolio
  investment* builds a complete object, but only after searching the whole Shared Drive and
  finding no folder of that name. If one exists — in Pipeline, Venture Building, Exploration, an
  archive, or Portfolio itself — it blocks and names the path. See
  [ADR 0005](../decisions/0005-legacy-portfolio-objects-only-on-proven-absence.md).
- **No root-tree bootstrap and no launch seeds.** A missing canonical root is architecture
  drift: it is reported to the administrator and never repaired automatically. No sample
  organizations are ever created.
- **No dated gate packages.** A new pipeline object gets empty `02_Concept_Review` and
  `04_Investment_Committee` folders. The dated package is created when the gate happens.
- **No deletion, move, rename or permission change.** Ever, on any path.
- **No LLM.** Structure generation is deterministic template expansion.

## Required access

Entering RADAR at all requires an approved organization domain *and* access to the Shared
Drive — see [access-control.md](access-control.md). This section is about the additional role
needed to *create* structures once inside.

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

Must already exist, with these columns present in the header row. Columns are matched **by
name**, so order does not matter and extra columns of your own are left untouched:

```
Timestamp | Actor | Structure_Type | Inputs | Destination_Path | Plan_Hash | Operation_Id |
Outcome | Created_Items | Reused_Items | Registry_Result | Warnings | Failure_Stage | Error
```

RADAR does not create or repair it: an audit trail the audited system can silently recreate
is not much of an audit trail. One row is appended per attempted execution — success, partial
success and failure alike. Events are assembled field by field from a known shape, and keys
matching `token|secret|password|credential|authorization|api key` are dropped, so tokens and
file contents cannot leak in.

### Creating the two spreadsheets

RADAR deliberately does not create these for you. Both take about a minute by hand.

**1. Master Registry**

Create a Google Sheet in the Shared Drive — the canonical home per the v06 spec is
`02_INVESTMENTS_AND_PROGRAMS/00_MASTER_INDEXES/00_Master_Registry`. Paste this into cell
**A1** (it is tab-separated, so it spreads across the row):

```
Object_Name	Theme	Strategic_Focus	Object_Type	Current_Stage_or_Status	Country_or_Geography	Owner	Official_Folder_Link	Last_Updated	Decline_or_Closure_Reason	Decision_Link
```

Only `Object_Name`, `Theme`, `Object_Type` and `Official_Folder_Link` are strictly required;
the rest are populated when present.

**2. Audit log**

Create a second Google Sheet. Paste this into cell **A1**:

```
Timestamp	Actor	Structure_Type	Inputs	Destination_Path	Plan_Hash	Operation_Id	Outcome	Created_Items	Reused_Items	Registry_Result	Warnings	Failure_Stage	Error
```

All fourteen are required. Consider restricting access to this sheet more tightly than the
Drive itself — it records who did what.

**3. Wire them up**

Take each ID from its URL:

```
https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit#gid=0
```

Put them in `.env`:

```
VITE_RADAR_REGISTRY_SHEET_ID=...
VITE_RADAR_AUDIT_SHEET_ID=...
```

**Restart the dev server.** These are build-time variables, so Vite does not pick up an edited
`.env` on hot reload — the app will keep reporting "not configured" until you restart.

> **Note:** these two spreadsheet IDs are the only things RADAR touches that are *not* pinned
> to the configured Shared Drive. Everything else is verified to be inside it. That is a
> deliberate consequence of configuring them by ID: it lets the audit log live somewhere with
> tighter access than the Drive. The trade-off is that a mistyped ID points RADAR at whatever
> spreadsheet that ID happens to name, so check them.

### Troubleshooting the Registry and audit sheets

Failures name their cause in the result screen, and the browser console carries the structured
error (`[RADAR] audit write failed`).

| Message | Cause | Fix |
|---|---|---|
| "The Google Sheets API is not enabled for this Google Cloud project" | the Sheets API was never enabled — see setup step 2 in the README | enable it in **APIs & Services → Library**, wait ~1 minute, retry |
| "Your Google sign-in is missing the Google Sheets permission" | the token was issued without the `spreadsheets` scope | sign out, sign back in, accept the permission request |
| "No audit spreadsheet is configured…" | `VITE_RADAR_AUDIT_SHEET_ID` unset or empty | set it, then restart the dev server |
| "…could not be found — check `VITE_RADAR_AUDIT_SHEET_ID`" | the ID names no spreadsheet | re-copy the ID from the URL |
| "…header row is missing required columns" | sheet exists, columns wrong | paste the header row above into A1 |
| "Google refused access…" | no edit access, or the Sheets permission was declined | get access; sign out and back in to re-consent |
| "No Master Registry is configured…" | `VITE_RADAR_REGISTRY_SHEET_ID` unset | set it, then restart the dev server |
| "…already records a different official folder" | the object already has an official home | resolve the Registry row by hand; RADAR will not create a second home |

A failed audit or Registry write never rolls back the folders — they were created. Fix the
configuration and re-run: creation is idempotent, so the existing folders are reused and only
the missing record is written.

**Both Google APIs must be enabled.** Drive and Sheets are enabled separately in the Cloud
project. With only Drive enabled, every part of RADAR works except spreadsheet writes, so the
first symptom is a successful structure creation whose audit row never appears. The console log
(`[RADAR] audit write failed`) carries Google's verbatim message under `details.apiMessage`,
including the project number and activation link; the on-screen message stays generic on
purpose.

## Local development

```bash
cp .env.example .env      # then fill in real values — point at a TEST Shared Drive
npm install
npm run dev               # http://localhost:5173
npm run test              # 617 tests; no Google credentials required
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
| a folder the structure must be added *inside* does not exist | the approved folder has not been moved there yet; RADAR will not build it |
| two folders share that organization's name | RADAR will not guess which is the official home |
| the object already has a folder elsewhere in the Drive | an object has one official folder; move that one instead of building a second |
| the object is already in Portfolio | *Portfolio operating folders* is the right tool; building 00-04 into it would fabricate history |

Warnings requiring explicit acknowledgement (not blocking): the restricted beneficiary-data
folder; an object name that already exists in Portfolio or the declined-pipeline archive; the
Master Registry `Object_Type` change a Portfolio transition needs; and a Portfolio object folder
that shows no evidence of retained history.

A lifecycle location is *not* warned about when it is the structure's own destination — finding
the organization in Portfolio is the entire point of the Portfolio operating folders type.

## Sensitive folders

`05_Participants_and_Beneficiary_Data` in the In-house Program template is marked
**restricted** in the preview and requires a separate acknowledgement before creation.

**RADAR creates the folder but does not configure its access.** No permissions API is called
and no user or group is invented. The result reports that permission configuration is still
required, under "Still to do by hand" — plan advisories are restated on the result screen, so
this promise is now kept rather than merely documented. Nothing in the UI ever claims that
access has been restricted.

Apply the access policy by hand, before any participant or beneficiary data is stored.

## Portfolio operating folders

The only structure that **adds to a folder RADAR did not create**, so it works differently from
the others and the differences are the point.

**Preconditions.** The organization folder must already sit at
`02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/{theme}/{name}`, because a human moved it there after
approval. RADAR does not move folders and never creates the object folder.

**What it creates.** Exactly eight folders, inside that existing folder (spec DYNAMIC TEMPLATE
— PORTFOLIO ORGANIZATION, subfolders 05-12):

```
05_Onboarding   06_Investment_Docs   07_Execution   08_Disbursements
09_Reports      10_MEL_Evidence      11_Photos_and_Videos   12_Decisions_and_Transitions
```

**What it never touches.** `00_Overview_and_Contacts`, `01_Meetings`, `02_Sourcing`,
`03_Screening` and `04_Diligence` are the retained history the approval preserves. They are
**absent from the plan entirely** — not "reused", not resolved — so RADAR has no write target
there at all.

**Why it cannot fabricate an object folder.** The organization name is part of the path that
must already exist, not part of what the plan creates. Since plan items derive from what is
created, the object folder is never a plan item, so creating it is not a call that exists to be
blocked. Verified on the write path too: execution re-plans and re-previews before writing.

**The two manual steps around it.** RADAR owns only the middle one:

1. Move the approved Pipeline folder into Portfolio, by hand, in Drive.
2. Run Create structure → Portfolio operating folders.
3. In the Master Registry, set `Object_Type` to `Portfolio` and update the stage, by hand.

Step 3 is deliberate: a Registry row is matched on Object_Name + Theme + Object_Type, so an
automatic write would append a duplicate row instead of updating the existing one — and the
specification reserves type and status decisions for a human. The preview requires the
administrator to acknowledge this before writing, and the result screen restates it.

**Two acknowledgements are specific to this type.** The Registry change above, and — when the
folder contains none of the folders a moved object would carry — a warning that it may be an
empty shell created by hand. The second is a warning rather than a block because a legacy
organization may hold its record under non-canonical names.

See [ADR 0004](../decisions/0004-portfolio-operating-folders-are-additive.md).

## Which Portfolio structure to use

Two structures write into Portfolio and their preconditions are **opposite**. You do not have to
decide correctly in advance — each one blocks and names the other — but the rule is:

| Situation | Structure | Why |
|---|---|---|
| A Pipeline organization was approved | move the folder yourself, then **Portfolio operating folders** | Approval moves the complete folder and keeps its history. RADAR adds 05-12. |
| A grant or investment predates RADAR and has no folder anywhere | **Existing Portfolio investment** | There is nothing to move. RADAR builds the complete 00-12. |
| The organization already has a folder somewhere else | neither — move that folder first | An object has exactly one official folder. |

**Why building from scratch is restricted at all.** The v06 PORTFOLIO CREATION RULE forbids
creating an object folder *instead of moving one*, and the harm it names is losing history that
exists. RADAR enforces that as a question about live Drive rather than a blanket ban: it searches
the whole Shared Drive for the name and refuses if it finds anything. You may build from scratch
only when there is genuinely nothing to move.

That search is case-insensitive but **cannot fold accents** — `Fundacion Luminar` will not match
`Fundación Luminar`. Read the destination before confirming.

An object that arrived by a move is refused with a message pointing at *Portfolio operating
folders*. That refusal matters: building `00`-`04` into a folder that already carries real
history would create an empty `03_Screening/02_Concept_Review` asserting a gate that never
happened, which no later reader could tell from a real one.

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

### Recovering Portfolio operating folders added to the wrong organization

Worth stating separately, because this is the one structure that writes *inside* a folder
holding real history, and "retry is safe" is true but not sufficient advice.

If the operating folders were added to the wrong organization folder — the wrong name typed, or
the right name matching a stray folder — RADAR cannot undo it: there is no delete, move or
rename verb. Recovery is manual:

1. Open the folder from the audit row's `Created_Items` paths, or from the result screen's link.
2. Confirm each of the eight folders is empty. RADAR only ever created empty folders, so any
   content means someone has since filed into them — stop and ask the RADAR owner.
3. Delete the eight empty folders by hand.
4. Re-run against the correct organization, using the preview's Drive link to verify the folder
   before confirming.

Nothing in the retained history (`00`–`04`) can be affected: those folders are never in the
plan, so RADAR neither writes to them nor resolves them as write targets.

## Beca Tech partner or provider

Beca Tech-specific; the generic In-house program template is unchanged. Proposed in
[ADR 0006](../decisions/0006-beca-tech-partner-and-provider-folders.md), which also holds the
specification amendment it depends on.

- **Inputs.** Organization type (`Partner` or `Provider`, a closed list) and organization name.
  No theme, owner, country, strategic focus, meeting-log year or Registry fields.
- **Destination.** Fixed:
  `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/04_Partners_and_Providers/{Partners|Providers}`.
  Every one of those folders must already exist. A missing one is a *Missing canonical parent*
  block and nothing is written — RADAR never creates `Partners` or `Providers`.
- **Creates.** `{name}/Proposal`, `{name}/Agreement`, `{name}/Reports`. Nothing else.
- **Re-running.** An existing organization folder is reused, and only missing standard folders
  are created, so an organization with `Proposal` and `Agreement` gets just `Reports`.
- **Scope of a name.** Matching is inside the chosen container only. `Partners/Acme` and
  `Providers/Acme` are independent: these are operational folders, not Registry objects with
  one official home, so no Drive-wide search runs.
- **No Registry record, no permissions.** Existing Drive access applies unchanged.

## Known limitations

1. **Concurrency is narrowed, not eliminated.** The in-flight guard is module state in one
   browser tab, not a distributed lock. Two tabs or two administrators acting simultaneously
   can still race, and Drive permits duplicate folder names. Execution re-checks after
   creating and raises a `DUPLICATE_CREATED` warning, but cannot prevent the race. Closing it
   needs a server-side lock — Apps Script `LockService` or a backend. That is the extension
   point.
2. **Operation results are in-memory.** Status and retry survive re-renders but not a page
   reload. The audit spreadsheet is the durable record.
3. **The classifier is only partly migrated.** `canonicalTree.js` is the single source of
   truth for the creator. `src/utils/radarClassify.js` now imports the theme constants from
   it — so there is one definition of where `Cross_Thematic` is valid — but still builds its
   folder *paths* from inline template literals. `src/radar/classifierEquivalence.test.js`
   proves the two representations agree and fails the build if they drift; migrating the
   remaining path literals is the documented next step (`AGENTS.md` §4 stages it behind
   exactly this kind of equivalence test).
4. **Pre-existing:** the read-only search helper in `src/utils/driveApi.js` escapes
   apostrophes but not backslashes in Drive queries. Left untouched to preserve Search
   behavior. New code uses `escapeDriveQueryValue`, which escapes both.
5. **`Current_Stage_or_Status` is never populated** by automation, by design.
6. **A moved Portfolio folder cannot be told from a copied one.** RADAR verifies the
   organization folder exists and probes for retained-history folders, but if someone *copied*
   instead of moving, the Pipeline folder is left behind and RADAR does not detect it. The
   acknowledgement asks the administrator to confirm. Detecting the leftover is an extension
   point.
7. **No check that the Portfolio folder is the right organization.** Because RADAR writes no
   Registry row for the transition, it also runs no Registry cross-check. Identity rests on an
   exact folder-name match plus the administrator confirming via the preview's Drive link. A
   read-only Registry assertion is the natural next control; it is deferred because it would
   make a configured Registry a hard precondition. See ADR 0004.
8. **Classify slugs object names; the creator does not.** Classify suggests
   `.../Sample_Org/...` while the folder built is `.../Sample Org/...`. Pre-existing, affects
   all object types, and pinned by a test in `classifierEquivalence.test.js`.

## Extension points

Left clean, with no partial unsafe behavior:

- Pipeline → Portfolio **move**. The operating-folders half now ships; moving the folder stays
  human and needs the move verb this architecture does not have (ADR 0001, ADR 0004).
- Detecting a Pipeline folder left behind when someone copied instead of moving
- Decline/withdrawal → `99_ARCHIVE/01_Declined_Pipeline`, retaining the Registry record
- Venture graduation
- Dated Concept Review / Investment Committee gate packages
- Server-side locking and a server-enforced authorization boundary
