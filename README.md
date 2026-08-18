# RADAR - Repository for Assets, Decisions, Analysis, and Research

A standalone React app that connects to your Google Shared Drive and provides full-text search, filters, and direct file access.

## Features

- **Full-text search** — searches file names AND file contents via Google Drive API
- **Live metadata** — last modified date, owner, file size
- **Direct links** — click any result to open it in Google Drive
- **Filters** — by folder/area, thematic tag, file type, owner, and date range
- **Classify** — deterministic routing of a described file to its official RADAR folder
- **Create structure** — build an approved canonical folder structure in the Shared Drive
- **OAuth 2.0** — secure login with your Google Workspace account
- **Multi-organization access** — approved partner organizations can sign in, with Google Drive
  still deciding what each individual may read

### Access control

Signing in with Google is not enough. RADAR grants access only when all three hold:

```
verified Google identity  AND  approved organization domain  AND  Shared Drive access
```

- The approved organizations come from `VITE_RADAR_ALLOWED_DOMAINS`. Matching is exact, so
  `fake-your-org.com` and `mail.your-org.com` do not pass.
- **An approved domain grants nobody anything.** It only makes an organization eligible.
  Whether a person may read a file is decided by Google against the Shared Drive ACL, on that
  person's own token, on every request.
- RADAR keeps no list of authorized users and never provisions access: no Drive invitations, no
  permission changes, no Google Group membership changes.
- Restricted areas stay governed by the `radar-*` Google Groups, which RADAR neither reads nor
  manages.

How to onboard and offboard an organization: **[docs/operations/access-control.md](docs/operations/access-control.md)**.
Why the model is shaped this way, and its limitation: **[docs/decisions/0002-multi-organization-authentication.md](docs/decisions/0002-multi-organization-authentication.md)**.

### Create structure

The one workflow that writes to Drive. An administrator picks one of six approved structures
(Pipeline organization, Venture Building initiative, In-house program, Policy, formal
governance meeting, annual OKR cycle), previews it against the live Shared Drive, confirms
explicitly, and RADAR creates only the missing folders.

- Requires **Content Manager or higher on the RADAR Shared Drive**. RADAR keeps no admin list
  of its own — your Drive role is the authorization and Google enforces it.
- Write scopes (`drive`, `spreadsheets`) are requested **only** when you open this workflow.
  Search and Classify stay on `drive.readonly`.
- Preview is read-only; creation is idempotent, so retrying is always safe.
- Nothing is ever deleted, moved, renamed, or has its permissions changed.
- Missing canonical roots are reported as architecture drift, never auto-created.

Full details, configuration and known limitations: **[docs/operations/create-structure.md](docs/operations/create-structure.md)**.
Why writes are client-side: **[docs/decisions/0001-client-side-controlled-drive-writes.md](docs/decisions/0001-client-side-controlled-drive-writes.md)**.

---

## Setup (step by step)

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it `velezreyes-drive-search` → **Create**

### 2. Enable the Google APIs

Both are required. Go to **APIs & Services → Library** and enable each:

1. **Google Drive API** — search, then click **Enable**
2. **Google Sheets API** — search, then click **Enable**

The Sheets API is what the Master Registry and the audit log use. Skipping it is easy to miss
because search, classification and folder creation all keep working — only spreadsheet writes
fail, with a `403` that says *"Google Sheets API has not been used in project … or it is
disabled"*.

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - App name: `Vélezreyes Drive Search`
   - User type: see **Who can authenticate** below — this depends on whether RADAR must admit
     more than one organization
   - Scopes: add `https://www.googleapis.com/auth/drive.readonly`
   - For Create structure, also add `https://www.googleapis.com/auth/drive` and
     `https://www.googleapis.com/auth/spreadsheets`. These are requested incrementally, so
     users who only search never consent to them.

4. Back in Credentials, select **Web application**
5. Add **Authorized JavaScript origins**: `http://localhost:5173`
6. Add **Authorized redirect URIs**: `http://localhost:5173`
7. Copy the **Client ID** — you'll need it below

#### Who can authenticate

The functional requirement: **the OAuth application must permit Google accounts from the
organizations RADAR intends to authorize.** Consent-screen options and any verification
requirements change over time, so confirm the current choices in the Google Cloud Console
rather than trusting a label written here.

- A consent screen restricted to your own Google Workspace admits **only** your own Workspace.
  That is sufficient when everyone using RADAR has a `your-org.com` account, and it was the
  original assumption of this project.
- Admitting partner organizations requires a consent screen that accepts accounts outside your
  Workspace. Configure it for the organizations you intend to authorize.

Widening the consent screen does not widen access to RADAR, and this is the point of the design:

```
Google OAuth          → verifies identity
RADAR allowed-domain  → verifies the organization is approved
Google Shared Drive   → verifies this individual account actually has access
```

A consent screen that admits a wider set of accounts simply hands more identities to RADAR's
domain rule, which refuses the ones that are not approved. Anyone who gets past that is then
refused by Google unless they genuinely have Shared Drive access. Approving a domain still
grants no Drive membership to anyone — see
[docs/operations/access-control.md](docs/operations/access-control.md).

### 4. Configure the app

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
VITE_SHARED_DRIVE_ID=your-shared-drive-id-here

# Organizations RADAR accepts identities from. Comma separated, matched exactly.
# Unset means NOBODY can sign in — an empty list never means "allow everyone".
VITE_RADAR_ALLOWED_DOMAINS=your-org.com,partner-org.org

# Optional — used only by Create structure. Unset means the feature degrades honestly
# (Registry reported as pending; no durable audit trail, stated in the UI).
VITE_RADAR_REGISTRY_SHEET_ID=your-master-registry-spreadsheet-id-here
VITE_RADAR_AUDIT_SHEET_ID=your-audit-log-spreadsheet-id-here
```

Point `VITE_SHARED_DRIVE_ID` at a **test Shared Drive** while developing — Create structure
writes for real. Never commit a real Drive or spreadsheet ID.

All `VITE_` values are build-time: **restart the dev server** after editing `.env`, and rebuild
and redeploy after changing them in production, or the old values stay compiled into the bundle.

### 5. Install and run

```bash
npm install
npm run dev     # http://localhost:5173
npm run test    # unit + UI tests; no Google credentials required
npm run build
```

There are no lint, format, or type-check scripts in this repository. Drive and Sheets are
faked in memory for every test, so the suite never touches a real Drive.

---

## Deploying to production

For production (e.g., Vercel, Netlify):

1. Add your production domain to the OAuth consent screen's authorized origins
2. Ensure the Drive API is enabled, and the consent screen admits the organizations you intend
   to authorize (see [Who can authenticate](#who-can-authenticate))
3. Set the environment variables in your hosting platform — including
   `VITE_RADAR_ALLOWED_DOMAINS`, without which **nobody can sign in**
4. Grant the intended users or groups access to the RADAR Shared Drive in Google Workspace.
   RADAR cannot do this and will refuse anyone who lacks it
5. `npm run build` → deploy the `dist/` folder

Environment values are compiled into the bundle at build time, so changing the approved
organizations always requires a rebuild and redeploy. Removing an *individual* does not: that is
a Shared Drive permission change and takes effect on their next request.

---

## Tech stack

- **React 18** + Vite
- **Google Identity Services** (OAuth 2.0, with incremental authorization for writes)
- **Approved-domain gate + Shared Drive verification** at sign-in; no user database
- **Google Drive API v3** and **Sheets API v4** (REST, called directly from browser)
- **Vitest** (+ jsdom and Testing Library for the wizard UI)
- No backend required — runs entirely client-side

RADAR holds **no** service-account key, client secret, or API key. Every Google call uses the
signed-in user's own OAuth token, and access is enforced by Google against that user's Drive
permissions. The `VITE_`-prefixed variables are embedded in the bundle and publicly readable;
they are identifiers, not credentials.
