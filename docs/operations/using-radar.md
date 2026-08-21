# Using RADAR

How to sign in and use the three RADAR workflows: **Search**, **Classify**, and
**Create structure**.

This guide covers the *application*. For **where a document belongs** — the folder taxonomy,
the lifecycle rules, the routing questions — see the approved **RADAR Folder Use Guidelines**,
circulated separately. This guide never repeats the taxonomy, so the two cannot contradict each
other as the tree evolves.

Known rough edges are listed in [radar-known-issues.md](radar-known-issues.md). If something
here does not match what you see, that file is the first place to look.

---

## First-time tour

The first time you reach RADAR after a successful sign-in, a short tour opens: a welcome screen,
one step each for Search, Classify and Create structure, and a closing screen. It takes under a
minute and teaches what the three workflows are for — the detail is in the rest of this guide.

- **You can leave at any point.** "Skip for now" or "Skip tour" closes it, and so does Escape.
  Skipping counts as having seen it, so it will not reappear at every sign-in.
- **You can reopen it whenever you like** with **Take the RADAR tour** in the top bar.
- **It reads nothing and changes nothing.** The tour requests no additional Drive permission,
  makes no Drive or Sheets request, and changes no file, folder or permission. The step about
  Create structure describes that workflow without opening it, precisely so it cannot prompt you
  for write access you have not chosen to grant.
- **Whether you have seen it is remembered in your browser**, not in an account. So it reappears
  if you clear your browser storage, use a different browser, or sign in on another device — and
  each person on a shared browser gets their own first run.

---

## What RADAR is

RADAR searches your Shared Drive, tells you where a document officially belongs, and builds
approved folder structures for you.

**What it will never do**, on any screen:

> Nothing is deleted, moved or renamed, and no permissions are changed.

It never grants or removes anyone's access either. Search and Classify are strictly read-only.
Create structure is the only feature that writes anything, it only ever *adds* folders, and
running it twice creates nothing new.

RADAR is not a replacement for Drive. When you want to open, edit or share a file, RADAR hands
you off to Drive itself.

---

## Getting in

### The route

1. Go to the **Employee Hub** and open the **RADAR microsite**.
2. Open the **Drive Finder** from the link at the top of the page.
3. **Sign in with your VélezReyes+ Google account.**

### One confusing thing, before you start

The application answers to several names. All of these are the same tool:

| Where you see it | What it says |
|---|---|
| How you are told to find it | RADAR Drive Finder |
| The browser tab | Vélezreyes+ Drive Search |
| **The Google permission screen** | **Vélezreyes Drive Search** |
| The app itself | RADAR |

The third one matters. When Google asks you to grant access, the dialog will say
**"Vélezreyes Drive Search"** — lowercase `r`, no `+`. That is RADAR. You are right to be
careful about unfamiliar apps requesting Drive access; this one is expected.

### The three checks

The sign-in screen tells you what RADAR is about to verify:

> **RADAR checks three things**
> 1. A verified Google identity
> 2. An approved organization domain
> 3. Access to the RADAR Shared Drive
>
> All three. RADAR never grants access — that stays a Google Workspace administrator action.

While they run you will see a spinner and **"Checking RADAR access…"**. That one message covers
all three checks, so it does not tell you which is in progress.

### If you are refused

Two of the three checks can fail on **Google's own pages, before RADAR loads at all**. Knowing
which screen you are looking at tells you whether to retry, switch account, or ask for help.

#### On Google's pages — RADAR never appears

| What you see | What it means | What to do |
|---|---|---|
| `Error 403: org_internal` | The OAuth audience is set to Internal and your account is outside that Workspace | Ask the RADAR owner. No RADAR setting changes this. |
| `Error 403: access_denied`, or "has not completed the Google verification process" | RADAR is in Testing and your account is not on its test-user list | Ask the RADAR owner to add you. There are only 100 slots. |
| "Google hasn't verified this app" | Expected while RADAR is in Testing | Choose **Advanced → Continue**. |

#### On RADAR's own screens

**"Access not authorized"**

> Your Google account belongs to an organization that is not currently authorized to use RADAR.
> Sign in with another account or contact your RADAR administrator.

Your email domain is not on the approved list. If you have a second account on an approved
domain, use **"Sign in with another account"** — that is the only self-service fix. Otherwise an
administrator has to add the domain, **and redeploy**, because the list is compiled into the
app at build time. Domain matching is exact: `mail.your-org.com` is not `your-org.com`.

**"RADAR Shared Drive access required"**

> Your organization is authorized, but this Google account does not currently have access to the
> RADAR Shared Drive. Ask your RADAR administrator to grant access, then try again.

Your organization is fine; this individual account is not a member of the Shared Drive. Only an
administrator can fix it. Once they have, press **"Retry"** — no need to sign out. Until then
this screen is the system working correctly, not a fault.

**"We couldn't verify your RADAR access"**

> Your Google account was signed in, but RADAR could not confirm Shared Drive access. Try again
> or sign out.

**This is not a permissions problem** — Google was unreachable, rate-limited, or returned an
error. Press **"Try again"** before escalating. If it happens to everyone, tell the RADAR owner.

**"RADAR is not configured correctly"**

> RADAR cannot check access because it is missing part of its setup. This is not a problem with
> your account — contact the RADAR owner.

Nobody can sign in until this is fixed. Nothing you do will help.

### What access you need

| To do this | You need |
|---|---|
| Search, Classify | **Viewer** on the RADAR Shared Drive |
| Create structure | **Content Manager** on the RADAR Shared Drive |

As the sign-in screen puts it: *"Content Manager access on the Shared Drive is required only for
Create structure."* There is no separate RADAR permission list — your Drive role *is* your
permission, and Google enforces it.

---

## Search

### What the query searches

Everything — **file names and file contents**, not just names. Searching `concept note` finds
files with those words inside them, not only files called that.

- There is no minimum length; one character searches.
- **An empty box is not "no search"** — it lists everything in the Shared Drive, newest first.
  Clearing the box restores the full listing rather than emptying it.
- When you first arrive you are already looking at the 50 most recently modified files.

### Filters

Filters combine with **AND** — each one narrows the result further. Every chip row is
single-select: clicking the active chip switches it off, and an active chip shows a `×`.

| Filter | What it does |
|---|---|
| **Area** | Top-level folders, read live from the Drive. Labels are tidied for display, so a folder named `01_Legal_Docs` appears as the chip "Legal Docs". |
| **Type** | Docs, Sheets, Slides, PDF, Folders, Images. |
| **Owner** | Up to eight people, labelled by first name. |
| **Modified** | Two date boxes: the first is **after**, the second is **before**. |
| **Sort** | Newest first (default), Oldest first, Name A→Z, Name Z→A. |

Three things about filters that surprise people:

- **Area matches only that folder's direct children**, not everything nested inside it. An Area
  with hundreds of files spread through subfolders can look nearly empty.
- **The date boxes look identical** — the browser ignores their labels. The left one is *after*,
  the right one is *before*. "Before 2026-08-20" excludes the 20th itself.
- **"Clear all" also resets your Sort** back to Newest first.

The result count reads **"14 results"** and so on, but it counts *rows loaded so far*, not total
matches. After **"Load more results"** it becomes 100. It is never a match total.

### The results list

Four columns: **Name · Type · Owner · Modified**. File size appears as small grey text beside
the name, and only for files that have one — Google Docs, Sheets, Slides and folders do not.

Dates are relative for the first week — `Just now`, `12m ago`, `5h ago`, `3d ago` — then
absolute, like `Aug 12`. Note that `1d ago` means *24 to 47 hours ago*, not "yesterday": a file
edited yesterday evening may well show `18h ago`. The exact timestamp is not available in the
list; open the file in Drive for that.

> **Owner column caveat.** It shows the **last person to modify** the file, falling back to the
> owner. So filtering by Owner "Ana" can return rows whose Owner column reads "Beto". See
> [known issues](radar-known-issues.md).

### Clicking

- **Single click** a file → opens the detail panel on the right.
- **Single click** a folder → browses into it.
- **Double click** anything → opens it in Drive, in a new tab.

Single click has a deliberate quarter-second pause, so that a double click can be told apart.

> **Browsing shows subfolders only.** When you click into a folder you see its *subfolders* —
> never the files inside it. A folder holding 40 documents and two subfolders shows two rows,
> and a folder holding 40 documents and no subfolders opens the detail panel instead of
> browsing. To see files in a folder, double-click it and use Drive.

Use the **"Back"** pill to come out one level. The folder names beside it are labels, not links.

> **While you are inside a folder, searching and filtering appear to do nothing.** The search
> really runs and the result count updates, but the list keeps showing folder contents until you
> press Back. If typing seems to have no effect, check whether you are browsed into a folder.

### The detail panel

Shows the file type, its full name, and whichever of these exist: **Size, Modified, Created,
Last by, Owner**. Size is missing for folders and Google-native files, which is normal.

**"Open in Drive"** opens a new tab and leaves RADAR untouched. From there Drive applies its own
permissions — RADAR itself is read-only, but in that tab you may well be able to edit.

### If results suddenly go empty

**"Nothing matches yet"** normally means your filters are too narrow. But if you have been in
the app for around an hour and *everything* returns nothing, your Google session has expired.
RADAR does not currently say so.

**Reload the page.** That signs you back in silently and results return.

---

## Classify

Answers the question *"where should I save this?"* — in English, Spanish or Portuguese.

### What you fill in

| Field | Required? | Notes |
|---|---|---|
| **Description** | **Yes** | Describe the document in plain language. Leaving it blank gives you `Please describe what you want to save.` |
| **Object** | No | The organisation, programme or topic. Worth filling in — see below. |
| **Context** | Defaults to Auto | Auto, Exploration, Pipeline, Portfolio, Venture, In-house, Institutional. |
| **Theme** | Defaults to Auto | Auto, Education, Democracy, Cross-thematic. |

**Cmd+Enter** (or Ctrl+Enter) in the description box classifies. Plain Enter adds a new line.

**Fill in Object when you know it.** Left blank, RADAR tries to infer it from your wording and
does not always get the capitalisation right — typing `Aprendo+` yourself gives you
`…/Education/Aprendo+/…`, while relying on inference can produce a lower-cased folder name.

### Language

Labels adapt to the language of your description. Two things to know:

- Detection reads the **description only** — the Object field is not considered.
- Short English phrases with no common English words in them are often read as **Spanish**. If
  the labels come back in the wrong language, add a few ordinary words ("notes for the meeting"
  rather than "meeting notes"). **The folder path is unaffected** — only the wording around it.

Note also that the *folder path and file name are never translated*, and many of the "Why"
explanations stay in English even when the labels do not.

### Reading the result

| Part | What it is |
|---|---|
| **Recommended location** | The official folder. Has a **Copy** button. |
| **Suggested file name** | The naming convention applied to your document. Has a **Copy** button. |
| **Why:** | Why that folder, in one sentence. Read this. |
| **Other possible locations** | Near-miss alternatives. No copy button. |
| **To improve this recommendation** | The specific inputs that would sharpen the answer. |
| **Special RADAR case** | Appears only for Beca Tech, Democracia+ and Emergency Response. |

### Confidence — and what to do about it

| Band | What it means | What to do |
|---|---|---|
| **High confidence** | A clear winner, well ahead of the runner-up | Use the path. Just check for any `[…]` segment. |
| **Medium confidence** | A winner, but something scored close behind | **Read "Why", then check "Other possible locations"** — the runner-up may be the better home. Setting Context usually settles it. |
| **Low confidence** | Nothing matched convincingly | **Do not file from this result.** Add the concrete noun the tree uses — "board minutes", "disbursement", "concept note", "participant data" — fill in Object, and set Context and Theme explicitly. |

### Square brackets are not folder names

If the recommended path contains something in square brackets, **that is not a folder — it is
RADAR telling you which single decision is still missing.** Never create it literally.

| What you see | What it wants |
|---|---|
| `[Education\|Democracy]` | Pick Education or Democracy on the Theme chips. RADAR refuses to guess. |
| `[Education\|Democracy\|Cross_Thematic]` | Same, at a location where Cross-thematic is also valid. |
| `[Object]` | Type the organisation, programme or topic into **Object**. |
| `[Organization_Name]` | Name the organisation managed through Democracia+. |
| `[Select_Function]` | Say which institutional function it is — Comms, Finance, People, Tech, Ops, Legal, MEL, Charity. |
| `[More information needed]` | Rewrite the description with a concrete noun. |

You will also see `[Education|Democracy]` if you select **Cross-thematic** somewhere it is not
allowed — Pipeline, Portfolio and Venture Building are Education or Democracy only. That is why
you can have Cross-thematic selected and still be asked to choose a theme.

### The three special cases

Mention any of these by name — in the description or in Object — and RADAR takes over the
Context and Theme chips, **overriding whatever you selected**:

- **Beca Tech** → always an Education In-house Program, at
  `…/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech`.
- **Democracia+** → always a Democracy Venture Building initiative, using its own expanded
  structure. An organisation managed *through* Democracia+ goes inside it, under
  `04_Subportfolio_and_Organizations`.
- **Emergency Response** → always a Cross_Thematic In-house Program, at
  `…/04_IN_HOUSE_PROGRAMS/Cross_Thematic/Emergency_Response`, using the standard In-house
  template unchanged.

### The suggested file name

The format is `YYYY-MM-DD_Object_DocumentType_STATUS_v01`, for example:

```
2026-06-15_Beca_Tech_Photo_or_Video_DRAFT_v01
```

- The date is **today**, not any date in your description.
- The status is **DRAFT unless you say otherwise**. Write "approved", "signed", "for review" or
  "superseded" in the description to change it.
- The version is always `v01`; bump it yourself.

### Worked examples

Real cases from RADAR's own test suite. Dates shown are the test clock; live output uses today.

| You type | RADAR returns |
|---|---|
| `Board meeting minutes and decisions from our August board meeting` | `03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/01_Board/2026/2026-06-15_Board_Meeting/04_Notes_and_Minutes` |
| `Necesito guardar las fotos del evento de Beca Tech de este año` | `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/Education/Beca_Tech/09_Photos_and_Videos` |
| `Concept Review deck for Fundacion Luminar` + Object `Fundacion Luminar`, Theme Education | `02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundacion_Luminar/03_Screening/02_Concept_Review/2026-06-15_Concept_Review/01_PreReads_and_Deck` |
| `Aprendo+ evaluation report and MEL evidence` + Object `Aprendo+` | `02_INVESTMENTS_AND_PROGRAMS/02_PORTFOLIO/Education/Aprendo+/10_MEL_Evidence` |
| `organization managed through Democracia+ subportfolio` + Object `CivicaLab` | `02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/Democracy/Democracia+/04_Subportfolio_and_Organizations/CivicaLab` |
| `exploratory topic research and background, a possible opportunity we have not taken to pipeline` + Object `Tema Nuevo`, Theme Cross-thematic | `02_INVESTMENTS_AND_PROGRAMS/0A_EXPLORATION/Cross_Thematic/Tema_Nuevo` |
| `sourcing notes for a new opportunity` + Object `NewOrg`, Theme **Cross-thematic** | `02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/`**`[Education|Democracy]`**`/NewOrg/02_Sourcing` — Cross-thematic is not valid in Pipeline |
| `draft` | `[More information needed]`, low confidence |

Notice the third example: the Concept Review lives **inside the project**, under Screening — not
in central Governance. That distinction is one of the main things Classify exists to enforce.

---

## Create structure

Builds an approved folder structure in the Shared Drive. This is the only workflow that writes
anything, and it only ever adds folders.

### The extra permission

The first time you open the tab you are asked for more Google permission:

> Search and Classify are read-only. Creating folders needs additional Google permission, which
> RADAR requests only when you open this workflow.
>
> **What you are granting** — Permission to create Drive items and update the Registry and audit
> spreadsheets, using your own Google account.
>
> RADAR can never do more than your Drive role already allows. If you are not a Content Manager
> on the RADAR Shared Drive, Google will refuse the operation.

Press **"Grant permission to continue"**. If you decline, nothing is lost — Search and Classify
keep working and you can press it again.

**Expect to be asked more than once.** The tab is deliberately discarded when you switch away
from it, so it never holds write permission in a tab nobody is looking at. Coming back asks
again. That is the design, not a bug.

### The six structure types

| Type | Creates it under | Themes offered |
|---|---|---|
| **Pipeline organization** | `02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/{theme}/` | Education, Democracy |
| **Venture Building initiative** | `02_INVESTMENTS_AND_PROGRAMS/03_VENTURE_BUILDING/{theme}/` | Education, Democracy |
| **In-house program** | `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/{theme}/` | Education, Democracy, **Cross_Thematic** |
| **Policy** | `03_INSTITUTIONAL/00_POLICIES/` | — |
| **Formal governance meeting** | `03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/{forum}/{year}/` | — |
| **Annual OKR cycle** | `01_STRATEGY/03_OKRs/` | — |

Two deliberate absences:

- **There is no Portfolio option.** When a Pipeline organization is approved you *move* its
  existing folder to Portfolio and add the operating subfolders — you never build a new one, or
  you lose its history.
- **Emergency Response is not a type.** It is an **In-house program** with theme
  `Cross_Thematic` and the name `Emergency_Response`.

Governance meetings cover Board, Leadership Team, All Team and Offsites only. Concept Review and
Investment Committee are project gates and belong with the project, never here.

### The five steps

**1 · Structure type** — pick one of the six cards; the chosen one shows a "Selected" pill.
Arrow keys move the selection. Press **Continue**.

**2 · Details** — the fields depend on the type. Required fields are marked `*`; everything else
says "(optional)". Names are used **exactly as typed** — accents, spaces, `+`, `&`, hyphens and
apostrophes are all kept. Strategic focus is metadata only and never becomes a folder.

Once the details are valid, a **Destination** line shows the full path you are about to create.
Press **"Validate and preview"** (it reads "Checking Drive…" while it works). Field errors only
appear after you press it.

**3 · Preview** — RADAR checks the live Drive. Nothing has been written yet.

Each row in the tree says what will happen to it, in words:

| Marker | Meaning |
|---|---|
| `+` **Will create** | Does not exist; RADAR will create it. |
| `=` **Already exists** | Exists with the right name and type; it will be **reused, not duplicated**. |
| `!` **Conflict** | Present but unusable. Blocks the run. |

A **blocking conflict** stops everything, and nothing is written. The most common is:

> **Missing canonical parent** — The canonical folder "…" does not exist. This is drift from the
> approved architecture — RADAR will not create canonical roots.

In plain terms: every structure has a fixed home in the approved tree, and RADAR only ever adds
the *last* part of that path. The folders above it must already exist. If one is missing, part
of the official tree has been renamed, moved or deleted. **Nothing you type will fix this** —
the RADAR owner has to restore that folder, then you re-run.

Others you may hit: two folders with the same name on the path (ambiguous destination),
duplicates at the destination, a name already taken by something that is not a folder, or a
Master Registry record already pointing that object somewhere else. Each says what to
de-duplicate or resolve in Drive first.

**Warnings** are different — they do not block, but each must be ticked before you can create.
One flags a **restricted folder** (see below); another notices that a folder with the same name
already exists in Portfolio, the Declined Pipeline archive or Exploration, which usually means
the object should be *moved* rather than rebuilt. RADAR only reports that; it never moves
anything.

**4 · Confirm** — the last screen before anything is written:

> **This writes to Drive.** {n} items will be created. Nothing is deleted, moved, or renamed.
> Running it twice creates nothing new.

Tick every acknowledgement and the final confirmation, then press **"Create structure"**. While
it runs: *"Creating the structure in Drive. Do not close this tab."*

**5 · Result** — **"Structure created"**, or "Partly completed" / "Nothing was created" /
"Creation failed". You get the destination, a link to open the folder in Drive, and expandable
lists of what was **Created** and what was **Reused**.

### If something goes wrong

**Retrying is always safe.** RADAR never rolls back: if it stops partway, the folders it already
made are left in place and listed. **"Retry safely"** re-checks the live Drive first, then
creates only what is missing. You will need to re-tick the acknowledgements — nothing is
re-created blindly.

A **partly completed** result can also mean every folder was created but the Master Registry or
the audit log could not be updated. The message says which, and retrying completes it.

### Restricted folders — your job afterwards

Creating an **In-house program** produces `05_Participants_and_Beneficiary_Data`, and you must
acknowledge this:

> This structure contains a restricted folder. RADAR creates it but cannot configure its access
> — permissions must be applied by hand before any participant or beneficiary data is stored.

RADAR does not touch permissions, and nothing in the UI ever claims it did. **Before any
participant data goes in**, a Shared Drive **Manager** must restrict it:

1. Right-click the folder → **Manage access**
2. Turn on **Limited access**
3. Add the `radar-*` Google Group that should keep access — a group, not individuals

Two facts make the obvious approach fail. Shared Drive membership is a **floor, not a ceiling**,
so adding a group to a folder can only *widen* access. **"Limited access" is the only supported
way to go below Drive membership.** Everyone else keeps seeing the folder greyed out and can
request access — that is deliberate, because RADAR's own rules name that folder as the official
home.

---

## For administrators

The detail lives in two existing documents; this is the orientation.

**Onboarding someone is two separate steps**, and neither implies the other:

1. Add them as a test user in the Google Cloud Console — capped at 100.
2. Grant them access to the RADAR Shared Drive in Google Workspace.

Miss the first and they are refused on Google's page. Miss the second and they reach RADAR and
see "RADAR Shared Drive access required" — which is correct behaviour, not a fault.

- Grant the narrowest role that fits: **Viewer** to read RADAR, **Content Manager** only for
  Create structure.
- Changing the approved domains requires a **rebuild and redeploy**. Removing an individual does
  not — that is a Drive permission change and takes effect on their next request.
- RADAR provisions nothing. It never adds anyone to a Drive, never modifies permissions, and
  never changes group membership.

Full detail: **[access-control.md](access-control.md)** for onboarding, offboarding, the three
layers, restricted folders and troubleshooting. **[create-structure.md](create-structure.md)**
for scopes, the Registry and audit spreadsheets, and the safety model.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Everything returns "Nothing matches yet" after a while | Your session expired after about an hour | **Reload the page.** |
| Searching or filtering seems to do nothing | You are browsed into a folder | Press **Back**. |
| A folder will not open | It has no subfolders — browsing only shows subfolders | Double-click to open it in Drive. |
| An Area looks almost empty | Area matches direct children only | Search by name instead. |
| Labels are in the wrong language | Detection read your description as another language | Add a few ordinary words in your language. The path is unaffected. |
| The Owner column disagrees with the Owner filter | The column shows the last person to modify | Use the detail panel, which shows Owner separately. |
| Asked for permission again in Create structure | The tab is discarded when inactive, by design | Grant it again. |
| "Missing canonical parent" | Part of the approved tree has been renamed, moved or deleted | Tell the RADAR owner. You cannot fix this from the app. |
| Search is slow or intermittently empty | Fast typing can trip Drive's rate limit | Pause a moment, then reload. |

### Before reporting a problem

Include: which tab, what you typed or selected, the **exact** on-screen message, the file or
folder name, and whether reloading helped. If it is a Create structure issue, say which step and
what the Preview said. The browser console often holds a more specific message than the screen
does — open it with F12 and copy anything in red.

---

## See also

- **RADAR Folder Use Guidelines** — where documents belong. Circulated separately.
- **[radar-known-issues.md](radar-known-issues.md)** — the rough edges, with status.
- **[access-control.md](access-control.md)** — access, onboarding, restricted folders.
- **[create-structure.md](create-structure.md)** — how the creator works and what it refuses.
- **[../specs/2026-08-18_RADAR_Folder_Tree_v06.txt](../specs/2026-08-18_RADAR_Folder_Tree_v06.txt)**
  — the approved canonical tree.
