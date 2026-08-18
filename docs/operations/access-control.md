# Access control — who can use RADAR

How RADAR decides whether to let someone in, how an administrator onboards a partner
organization, and how access is removed.

Governance documents outrank this file. If the approved RADAR policy and this guide disagree,
the policy wins and this file is the bug.

The decision recorded here is proposed, not yet approved: see
[docs/decisions/0002-multi-organization-authentication.md](../decisions/0002-multi-organization-authentication.md).

## The rule

```
verified Google identity  AND  approved organization domain  AND  Shared Drive access
```

All three. Any one of them failing denies access to the application.

## The three layers

Each answers a different question, and each has a different authority. Collapsing them is the
mistake this design exists to prevent.

| Layer | Question | Who decides | Configured where |
|---|---|---|---|
| Google OAuth | Who is this person? | Google | Google Cloud OAuth client |
| RADAR allowed-domain rule | Is this organization one RADAR accepts identities from? | RADAR configuration | `VITE_RADAR_ALLOWED_DOMAINS` |
| Google Shared Drive | May this individual account read RADAR data? | Google Drive ACL | Shared Drive membership |

Below those, unchanged and untouched by RADAR:

| Layer | Question | Who decides |
|---|---|---|
| Google Groups / folder permissions | May this person open *this particular* restricted folder? | Drive ACL and `radar-*` group membership |

### Approved domain ≠ Shared Drive membership

This is the single most important thing on this page.

Adding a domain to `VITE_RADAR_ALLOWED_DOMAINS` grants **nobody** access to **anything**. It
says only that RADAR is willing to consider accounts from that organization. Whether a given
person can read a given file remains a Google Drive decision, made against that person's own
OAuth token on every request.

RADAR never provisions access. It does not add anyone to a Shared Drive, does not modify Drive
permissions, and does not change Google Group membership. There is no permissions write and no
Admin SDK call in the codebase. Granting access is an administrator action in Google Workspace,
and it is deliberately outside this login check.

## Configuration

| Variable | Effect if unset |
|---|---|
| `VITE_RADAR_ALLOWED_DOMAINS` | **Nobody can sign in.** RADAR reports that it is misconfigured. An empty list never means "allow everyone". |
| `VITE_SHARED_DRIVE_ID` | **Nobody can sign in.** There is no drive to verify against, which is a setup failure, not a permission denial. |

```
VITE_RADAR_ALLOWED_DOMAINS=your-org.com,partner-org.org
```

Whitespace, casing and a stray trailing comma are tolerated; these are equivalent:

```
VITE_RADAR_ALLOWED_DOMAINS=your-org.com,partner-org.org
VITE_RADAR_ALLOWED_DOMAINS= Your-Org.com , PARTNER-ORG.org ,
```

Matching is **exact**. Approving `your-org.com` does not approve `mail.your-org.com`,
`fake-your-org.com`, or `your-org.com.example.net`.

Both variables are build-time. Changing either requires a **rebuild and redeploy**, or a dev
server restart locally.

## Onboarding an organization

Five steps, in this order. Steps 2–4 are Google administration and cannot be done from RADAR.

1. **Approve the domain in RADAR configuration.** Add it to `VITE_RADAR_ALLOWED_DOMAINS` in the
   hosting platform.
2. **Configure Google OAuth so those users can authenticate.** The OAuth application must
   permit Google accounts from the organizations RADAR intends to authorize. A consent screen
   restricted to your own Workspace admits only your own Workspace — see
   [the README setup step](../../README.md#3-create-oauth-20-credentials).
3. **Grant the intended users or groups access to the RADAR Shared Drive** in Google Workspace.
   Nothing in step 1 did this. Until this step, approved-domain users are correctly refused
   with "Shared Drive access required".
4. **Add restricted-area Google Group memberships separately**, where required
   (`radar-finance`, `radar-legal`, `radar-people`, `radar-leadership`, `radar-board`). These
   govern folders, not application entry, and RADAR neither reads nor manages them.
5. **Redeploy RADAR**, because the domain configuration is build-time.

Grant the narrowest Drive role that fits. Reading RADAR needs only Viewer; Content Manager is
required solely for Create structure, per
[create-structure.md](create-structure.md).

## Offboarding

Match the scope of the removal to the scope of the problem.

| Scope | Action | Takes effect |
|---|---|---|
| An entire organization | Remove its domain from `VITE_RADAR_ALLOWED_DOMAINS`, then rebuild and redeploy | On deploy |
| One person | Remove the individual or their group from the RADAR Shared Drive | Immediately, on their next request |
| Restricted areas only, person keeps general access | Remove them from the relevant `radar-*` Google Group | Immediately |

Removing a domain does **not** remove Drive access, and removing Drive access does **not**
remove the domain. For a departing person, the Drive removal is the one that matters and is the
one that is immediate — a domain change cannot revoke an individual and should never be relied
on to.

## What a user sees

| Situation | Screen | What it offers |
|---|---|---|
| Check in progress | "Checking RADAR access…" | Nothing; the application is not rendered |
| Organization not approved | "Access not authorized" | Sign in with another account |
| Approved organization, no Drive access | "RADAR Shared Drive access required" | Retry, Sign out |
| RADAR could not reach Google | "We couldn't verify your RADAR access" | Try again, Sign out |
| RADAR misconfigured | "RADAR is not configured correctly" | Sign out |

The denial screens never list the approved domains — telling an unauthorized visitor which
organizations are accepted helps only them. No Google response, status code or stack trace is
shown; diagnostics go to the browser console as generic categories (`DOMAIN_DENIED`,
`DRIVE_ACCESS_DENIED`, `DRIVE_ACCESS_CHECK_FAILED`) carrying no token, email or Drive content.

A failed check is deliberately **not** worded as a denial. If Google is unreachable the user is
offered a retry, because telling them they lack permission would send them to an administrator
who has nothing to fix.

## Troubleshooting

| Message | Cause | Fix |
|---|---|---|
| "Access not authorized" for someone who should have access | their email domain is not in `VITE_RADAR_ALLOWED_DOMAINS`, or the deploy predates the change | add the domain, rebuild, redeploy; confirm the account's actual domain, not the display name |
| "Access not authorized" for a subdomain address | matching is exact — `mail.your-org.com` is not `your-org.com` | add the exact domain the addresses use |
| "RADAR Shared Drive access required" | the domain is approved but this account is not a member of the Shared Drive | grant Drive access in Google Workspace; this is expected and correct until you do |
| Everyone sees "RADAR is not configured correctly" | `VITE_RADAR_ALLOWED_DOMAINS` or `VITE_SHARED_DRIVE_ID` is unset in the deployed build | set it and redeploy; the console names which one |
| Everyone sees a configuration error after a Cloud project change | the Drive API is not enabled for the project — it arrives as a 403 and is reported as configuration, not as a sharing problem | enable it in **APIs & Services → Library**, wait ~1 minute, retry |
| "We couldn't verify your RADAR access" | Google was unreachable, rate-limited, or returned a server error | retry; this is not a permissions problem |
| "We couldn't verify your RADAR access" for **everyone**, immediately after signing in | RADAR could not resolve who the signed-in account is, so it never reached the domain or Drive checks | check the console for `[RADAR] identity lookup failed` and its status; a 401/403 there means the token cannot read the identity, not that the user lacks Drive access |
| Works locally, denies everyone in production | build-time variables were not set in the hosting platform, or the app was not rebuilt after they were | set them and rebuild |
| A user was removed from the Drive but is still inside RADAR | their page is still open on a live token | Drive refuses their next request; a reload lands them on the denial screen |

## Security notes

- The domain allowlist is compiled into a public bundle. It is an **application gate**, not a
  security boundary: a determined user can edit the running JavaScript and pass it. They gain
  nothing, because the Shared Drive check runs on their own token and Google refuses them. This
  is why the Drive check is mandatory and can never be replaced by the domain check. Stated in
  full in ADR 0002.
- The verification request is a single `drives.get` pinned to the configured
  `VITE_SHARED_DRIVE_ID`. No Drive id is ever accepted from a URL, storage, a route, user input
  or an API response.
- It runs on the existing `drive.readonly` scope. No new consent, and no write scope. The
  signed-in identity is read from the same scope via the Drive API's `about.get`, rather than
  from the OpenID Connect userinfo endpoint, which would require `openid`/`email`/`profile` and
  a fresh consent prompt for every existing user.
- A blank name or missing avatar in the navbar is a symptom of the identity lookup failing, not
  a cosmetic issue: the same lookup feeds the domain rule and the audit trail's Actor column.
- OAuth tokens are held in memory for the session only — never `localStorage`, `sessionStorage`,
  a cookie or IndexedDB — and are never logged.
