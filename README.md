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

### 2. Enable the Google Drive API

1. Go to **APIs & Services → Library**
2. Search for **Google Drive API** → click **Enable**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - User type: **Internal** (for Workspace accounts)
   - App name: `Vélezreyes Drive Search`
   - Scopes: add `https://www.googleapis.com/auth/drive.readonly`
   - For Create structure, also add `https://www.googleapis.com/auth/drive` and
     `https://www.googleapis.com/auth/spreadsheets`. These are requested incrementally, so
     users who only search never consent to them.
4. Back in Credentials, select **Web application**
5. Add **Authorized JavaScript origins**: `http://localhost:5173`
6. Add **Authorized redirect URIs**: `http://localhost:5173`
7. Copy the **Client ID** — you'll need it below

### 4. Configure the app

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
VITE_SHARED_DRIVE_ID=your-shared-drive-id-here

# Optional — used only by Create structure. Unset means the feature degrades honestly
# (Registry reported as pending; no durable audit trail, stated in the UI).
VITE_RADAR_REGISTRY_SHEET_ID=your-master-registry-spreadsheet-id-here
VITE_RADAR_AUDIT_SHEET_ID=your-audit-log-spreadsheet-id-here
```

Point `VITE_SHARED_DRIVE_ID` at a **test Shared Drive** while developing — Create structure
writes for real. Never commit a real Drive or spreadsheet ID.

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
2. Set the environment variables in your hosting platform
3. `npm run build` → deploy the `dist/` folder

---

## Tech stack

- **React 18** + Vite
- **Google Identity Services** (OAuth 2.0, with incremental authorization for writes)
- **Google Drive API v3** and **Sheets API v4** (REST, called directly from browser)
- **Vitest** (+ jsdom and Testing Library for the wizard UI)
- No backend required — runs entirely client-side

RADAR holds **no** service-account key, client secret, or API key. Every Google call uses the
signed-in user's own OAuth token, and access is enforced by Google against that user's Drive
permissions. The `VITE_`-prefixed variables are embedded in the bundle and publicly readable;
they are identifiers, not credentials.
