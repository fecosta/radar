# RADAR — known issues

Found while writing [using-radar.md](using-radar.md), by reading the code rather than by
testing. Every entry is verified against source and carries a `file:line`.

Ordered by **user impact**, not by effort. Nothing here has been fixed — this is a triage list.

The two items already recorded as deliberate divergences in `src/utils/__evals__/radarCases.js`
are referenced at the end rather than restated.

---

## Breaks the app for the user

### 1. An expired session looks like "no results"

**Symptom.** After roughly an hour, every search returns **"Nothing matches yet"** — identical
to a genuine empty result. The word "session" never appears. The user concludes RADAR has lost
their Drive.

**Cause.** Nothing refreshes the token; it is requested once on load
(`src/hooks/useAuth.js:118-122`). There is no 401 handler anywhere. `executeSearch` catches every
failure with `console.error('Search error:', err)` and no user-facing state
(`src/hooks/useDriveSearch.js:86-88`) — and results are cleared *before* the request is made
(`:54-58`), so the list is already empty and stays that way.

**Recovery today.** Reload the page, which silently re-authenticates. Nothing tells the user
this.

**Worth noting.** Every Drive failure takes this same silent path — 403 rate limits, 404s,
malformed queries, network drops. A visible error state would cover all of them at once.

### 2. The debounce does not debounce

**Symptom.** Typing an 11-character word fires **11 separate Drive searches**. Fast typing can
trip Drive's rate limit, which then surfaces as issue 1 — a silently empty list.

**Cause.** `executeSearch` lists `query` in its own dependency array
(`src/hooks/useDriveSearch.js:93`), so it is a new function identity on every keystroke.
`useCallback(debounce(...), [executeSearch])` therefore returns a **fresh** `debounce` closure
each keystroke (`:96-101`), each with its own `let timer` (`src/utils/helpers.js:79`) still
`undefined` — so the previous keystroke's timer is never cancelled.

Results stay *correct*, because a `searchIdRef` guard discards stale responses
(`useDriveSearch.js:51`, `:76`). That guard is what hides the symptom and why this has gone
unnoticed.

**Also:** two identical searches fire on first paint, from `:110-114` and `:117-121`.

### 3. Browsing into a folder never shows files

**Symptom.** A folder holding 40 documents and two subfolders shows **two rows**. A folder
holding 40 documents and no subfolders does not open at all — it pops the detail panel instead,
which reads as broken.

**Cause.** `listSubfolders` hard-codes `mimeType = 'application/vnd.google-apps.folder'` into the
query (`src/utils/driveApi.js:216`).

This is the most surprising behaviour in the application.

### 4. Area filters are not recursive

**Symptom.** Selecting an Area shows only the handful of items sitting loose at the top of it.
Users read this as "the Area is empty".

**Cause.** The filter is `'<id>' in parents` — direct children only
(`src/utils/driveApi.js:70`).

### 5. Search and filters look dead while browsed into a folder

**Symptom.** Typing or changing a filter appears to do nothing. The search really runs — the
spinner turns and the result count updates — but the list keeps showing folder contents.
The count row and the list openly disagree.

**Cause.** `displayItems = currentBrowseItems ?? search.results` (`src/App.jsx:350`).

---

## Wrong or misleading

### 6. The Owner column shows the last modifier

**Symptom.** Filtering by Owner "Ana" returns rows whose Owner column says "Beto". The column
contradicts the filter directly beside it.

**Cause.** `file.lastModifyingUser?.displayName || file.owners?.[0]?.displayName || '—'`
(`src/components/FileList.jsx:94`), while the Owner filter matches `'<email>' in owners`
(`src/utils/driveApi.js:90`).

**Either** rename the column to "Last edited by" **or** show `owners[0]` first. The detail panel
already gets this right — it shows "Last by" and "Owner" as separate rows.

### 7. Language detection resolves ties to Spanish

**Symptom.** An English description renders Spanish labels.

**Cause.** Detection counts stop-word presence for `es`, `en`, `pt` and sorts
(`src/utils/radarClassify.js:30-42`). `Object.entries` yields `es` first and `Array.sort` is
stable, so an all-zero score returns **Spanish**. Any English phrase containing none of the 16
English stop words is affected — including these real strings from the eval fixtures:

- `ecosystem mapping and architecture`
- `blank reusable template model`
- `organization-wide comms brand campaign`
- `People HR hiring and performance review records`
- `reusable MEL methodology and indicator dictionary`

**Also:** a single accented character anywhere adds +3 to a language. `Emergency Response plan
for São Paulo` becomes Portuguese; `Photos for Fundación Niñez` becomes Spanish. The accent can
be inside an organisation name.

**Related.** `translateWhy` only covers 12 sentences per language
(`src/utils/radarClassify.js:411-442`), so most "why" text stays English even when the labels do
not. Worth deciding whether partial translation is better or worse than none.

### 8. "Clear all" silently resets Sort

**Symptom.** A user who sorted Name A→Z and then clears filters loses the sort without being
told.

**Cause.** `clearFilters` resets `sortBy` (`src/hooks/useDriveSearch.js:138`), but `hasFilters`
excludes it (`:141`) — so sorting is "not a filter" for the purpose of showing the row, yet is
one for the purpose of clearing.

### 9. "Docs" already includes PDFs, next to a separate "PDF" chip

**Symptom.** Two chips overlap, with no way to express "Docs but not PDFs".

**Cause.** The Docs branch matches Google Docs **plus `application/pdf`** plus `.docx`
(`src/utils/driveApi.js:77`), and chips are single-select. Docs is a strict superset of PDF.

**Also:** there are no chips for Forms, Text, CSV, Video or Audio, though
`src/utils/helpers.js:40-59` labels all of them. Those files are only reachable with no type
filter.

### 10. The date boxes are unlabelled, and "Before" is exclusive

**Symptom.** Two identical empty `dd/mm/yyyy` boxes with nothing to say which is which.

**Cause.** They rely on `placeholder` (`src/components/Filters.jsx:101-102`), which browsers
ignore for `type="date"`.

**Also:** values pass through as bare dates, read by Drive as midnight UTC with a strict
comparison — so **"Before 2026-08-20" excludes everything modified on the 20th**
(`src/utils/driveApi.js:93-99`). Nothing on screen reveals the off-by-one-day.

---

## Accessibility

### 11. Result rows cannot be reached by keyboard, and names cannot be copied

**Symptom.** There is **no way to open a file, browse a folder or see details without a mouse**.
Screen readers get an unlabelled run of text rather than rows.

**Cause.** `FileRow` is a bare `<div onClick>` with no `role`, no `tabIndex` and no key handler
(`src/components/FileList.jsx:21-33`).

**Also:** `userSelect: 'none'` on the same element (`:32`) means a filename cannot be selected
with the mouse either — and because of the 230 ms click discriminator, an attempted drag-select
instead fires a single click and opens the detail panel.

This is the largest accessibility gap in the app. Everything else — the mode tabs, the chip
groups, the structure tree — implements roving tabindex properly, which makes the results list
the conspicuous exception.

### 12. The Classify description box has no label

**Symptom.** The main input on the Classify tab is announced without a name.

**Cause.** The textarea has neither a `<label>` nor an `aria-label`
(`src/components/Classify.jsx:303-324`); it is identified only by a heading above it. The
"Object" field's label is a `<span>`, not a `<label htmlFor>`, so it is not programmatically
associated either (`:118-130`).

`src/components/CreateStructure/ui.jsx` already has a `Field` component that does this
correctly — real `<label htmlFor>`, `aria-describedby`, `aria-invalid`. Classify predates it.

---

## Cosmetic

### 13. The description placeholder has unbalanced quotes

`Board meeting minutes for August' or 'Fotos del evento de Beca Tech`
(`src/components/Classify.jsx:310`) — the opening quote is missing and the closing one is
stranded. Presumably meant to be `'Board meeting minutes for August' or 'Fotos del evento de
Beca Tech'`.

### 14. The application has three names

| Where | Name |
|---|---|
| v06 spec, and how users are told to find it | RADAR Drive Finder |
| Browser tab (`index.html:6`) | RADAR — Drive Finder |
| **Google consent screen** (`README.md:93`) | **Vélezreyes Drive Search** |
| The app itself | RADAR |

Was four. The browser tab now matches the name the specification uses for this app (spec L25,
L153, L382), so the tab and the instructions users follow finally agree.

The consent screen is the one that matters, and it is still wrong: it is the single moment a
user is right to be suspicious of an unfamiliar app requesting Drive access, and it shows a
lowercase `r` and no `+`. Unlike the browser title, it is a Google Cloud Console setting rather
than a repo setting, and renaming a live OAuth app is worth doing deliberately.

`package.json`'s `name` field is also still `velezreyes-drive-search`, but nobody sees it.

### 15. "Cross-thematic" the chip, `Cross_Thematic` the folder

The Theme chip reads **Cross-thematic** with a hyphen
(`src/components/Classify.jsx:20-24`); the folder it produces is `Cross_Thematic` with an
underscore. Harmless, but it makes the returned path look like a typo.

---

## Already recorded elsewhere

These two are pinned as deliberate divergences in `src/utils/__evals__/radarCases.js` and are
listed here only so this file is a complete picture:

- **Free-text object names are lower-cased.** Mentioning `Aprendo+` in the description without
  filling in Object yields `…/Education/aprendo+/…`. Supplying the Object field gives correct
  casing (`radarCases.js:64-70`).
- **`application review notes` lands in `01_Application`** rather than `02_Application_Review`.
  Both rules score 12 and the sort is stable, so the earlier-registered rule wins
  (`radarCases.js:71-77`).

There is also a **dead rule**: `03_INSTITUTIONAL/02_TRANSVERSAL_AREAS/Legal/Contract_Templates`
scores 8 (`src/utils/radarClassify.js:344`) but the generic Templates rule scores a fixed 14
(`:373-374`), so "contract template" always returns `03_INSTITUTIONAL/06_TEMPLATES`. The user
guide does not promise the Legal path.
