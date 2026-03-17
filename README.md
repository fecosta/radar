# Vélezreyes+ Drive Search

A standalone React app that connects to your Google Shared Drive and provides full-text search, filters, and direct file access.

## Features

- **Full-text search** — searches file names AND file contents via Google Drive API
- **Live metadata** — last modified date, owner, file size
- **Direct links** — click any result to open it in Google Drive
- **Filters** — by folder/area, thematic tag, file type, owner, and date range
- **OAuth 2.0** — secure login with your Google Workspace account

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
4. Back in Credentials, select **Web application**
5. Add **Authorized JavaScript origins**: `http://localhost:5173`
6. Add **Authorized redirect URIs**: `http://localhost:5173`
7. Copy the **Client ID** — you'll need it below

### 4. Configure the app

Create a `.env` file in the project root:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
VITE_SHARED_DRIVE_ID=your-shared-drive-id-here
```

### 5. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Deploying to production

For production (e.g., Vercel, Netlify):

1. Add your production domain to the OAuth consent screen's authorized origins
2. Set the environment variables in your hosting platform
3. `npm run build` → deploy the `dist/` folder

---

## Tech stack

- **React 18** + Vite
- **Google Identity Services** (OAuth 2.0)
- **Google Drive API v3** (REST, called directly from browser)
- No backend required — runs entirely client-side
