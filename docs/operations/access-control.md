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

Everything except step 1 is Google administration and cannot be done from RADAR.

**Once per organization:**

1. **Approve the domain in RADAR configuration.** Add it to `VITE_RADAR_ALLOWED_DOMAINS` in the
   hosting platform, then **rebuild and redeploy** — the value is build-time.
2. **Make sure the OAuth audience admits that organization.** Under **Google Auth Platform →
   Audience**, an *Internal* audience admits only your own Workspace and refuses everyone else
   with `Error 403: org_internal`. See
   [Who can authenticate](../../README.md#who-can-authenticate) for the audience options and what
   an External audience costs.

**Then once per person** — these two are independent, and neither implies the other:

3. **Add them as a test user** under **Google Auth Platform → Audience**. Required while the app
   is in *Testing* status, which is where RADAR currently sits. An account that is missing from
   this list cannot sign in at all: Google refuses it with a 403 `access_denied` before RADAR
   loads. Capped at 100 users in total — see [Google-side capacity](#google-side-capacity).
4. **Grant them access to the RADAR Shared Drive** in Google Workspace, individually or through a
   group. Steps 1 and 3 did not do this. Until it is done the person signs in successfully and is
   then correctly refused with "Shared Drive access required" — which is the system working, not a
   fault.
5. **Add restricted-area Google Group memberships** where required (`radar-finance`, `radar-legal`,
   `radar-people`, `radar-leadership`, `radar-board`). These govern folders, not application entry,
   and RADAR neither reads nor manages them.

### Restricting a folder to one group

Two facts have to be held together here, because the obvious approach does not work.

**Shared Drive membership is a floor, not a ceiling.** The access level someone holds on a
Shared Drive is the *minimum* they have on everything inside it. A folder cannot normally be
made more restrictive than the Drive, so adding a group to a folder can only *widen* access.

**The one exception is "Limited access".** Google's limited-access folder setting is the single
supported way to restrict a folder below Drive membership, and it is now the sanctioned
mechanism: the older per-item restriction inside shared folders was withdrawn on 2025-09-22.

To restrict a folder, as a Shared Drive **Manager**:

1. Right-click the folder → **Manage access**.
2. Turn on **Limited access**.
3. Add the group that should keep access — a `radar-*` Google Group, not individuals, so the
   membership stays maintainable.

Everyone else keeps seeing that the folder exists, greyed out, and can request access. That
visibility is deliberate: RADAR's own routing rules tell people the folder is the official
home, so it must not vanish for them.

The Drive API equivalent is `files.update` with `inheritedPermissionsDisabled: true` followed
by `permissions.create`, and it needs the **organizer** role. RADAR does not call it. Note that
`STRUCTURE_WRITE_SCOPES` already requests the full `auth/drive` scope for Create structure, so
a permissions write would need no new consent — the only thing preventing one is the deliberate
absence of the code, and that is the point. See [ADR 0003](../decisions/0003-v06-per-location-themes-and-restricted-weekly-email.md).

#### Currently restricted folders

| Folder | Who keeps access | Applied by |
|---|---|---|
| `02_INVESTMENTS_AND_PROGRAMS/04_IN_HOUSE_PROGRAMS/{theme}/{program}/05_Participants_and_Beneficiary_Data` | the roles that need participant data | by hand, after Create structure flags it |
| `03_INSTITUTIONAL/01_GOVERNANCE_AND_DECISIONS/05_Weekly email` | Leadership Team (`radar-leadership`) | by hand; created outside RADAR at the CEO's request |

**Expected side effect, not a bug.** For someone outside the group, the Drive Finder lists
`05_Weekly email` but returns none of its contents, because Google enforces limited access per
user on every request. Search returning an empty restricted folder is the system working.

Grant the narrowest Drive role that fits. Reading RADAR needs only Viewer; Content Manager is
required solely for Create structure, per
[create-structure.md](create-structure.md).

### Google-side capacity

While the OAuth app is in **Testing** status it is limited to **100 test users**, added by hand.
That is a live constraint at RADAR's expected scale, not a theoretical one, and it is a Google
limit that no RADAR setting can raise.

Two ways out when it starts to bind:

- **Workspace admin-trusted** — an admin in each participating organization allowlists RADAR's
  OAuth client ID under **Security → API controls → App access control**. Google lists
  admin-trusted apps as a verification exemption; confirm the current behaviour in your own
  console before depending on it.
- **Verification** — publish *In production* and complete OAuth verification. Because
  `drive.readonly` is a restricted scope this includes an annual **CASA** third-party assessment
  (roughly $500–$4,500). It is the only route that removes both the cap and the unverified-app
  warning.

## Offboarding

Match the scope of the removal to the scope of the problem.

| Scope | Action | Takes effect |
|---|---|---|
| An entire organization | Remove its domain from `VITE_RADAR_ALLOWED_DOMAINS`, then rebuild and redeploy | On deploy |
| One person — **data access** | Remove the individual or their group from the RADAR Shared Drive | Immediately, on their next request |
| One person — **sign-in**, and to free a test-user slot | Remove them from the test users under **Google Auth Platform → Audience** | Immediately |
| Restricted areas only, person keeps general access | Remove them from the relevant `radar-*` Google Group | Immediately |

The two per-person removals do different things and are not substitutes. Removing someone from
the **Shared Drive** removes their access to RADAR *data* — this is the one that matters, and the
one to do first. Removing them from the **test-user list** only stops them signing in, and is
worth doing to reclaim a slot against the 100-user cap.

Removing a domain does **not** remove Drive access, and removing Drive access does **not** remove
the domain. A domain change cannot revoke an individual and should never be relied on to.

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

The first two rows are Google's own screens, shown on `accounts.google.com` **before RADAR
loads**. If you see either one, nothing in RADAR is involved and no RADAR setting will change it.

| Message | Cause | Fix |
|---|---|---|
| `Error 403: org_internal` — "can only be used within its organization" | the OAuth audience is **Internal**, which admits only your own Workspace | set **Google Auth Platform → Audience → User type: External**; see [Who can authenticate](../../README.md#who-can-authenticate) for what that costs |
| `Error 403: access_denied`, or a screen saying the app "has not completed the Google verification process" | the app is in **Testing** status and this account is not on the test-user list — this now includes your own staff | add the account under **Google Auth Platform → Audience → Test users**; if the list is full, see [Google-side capacity](#google-side-capacity) |
| "Google hasn't verified this app" | expected while the app is in **Testing** status | choose **Advanced → Continue**; removing this screen requires verification |
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
