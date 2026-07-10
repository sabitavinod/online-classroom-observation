# Online Classroom Observation

Mobile-first observation app for Meghe Group of Schools.

## What this package contains

- `Code.gs` — Apps Script backend and Google Sheet setup
- `appsscript.json` — Apps Script manifest
- `index.html`, `styles.css`, `app.js`, `config.js` — GitHub Pages frontend
- `meghe-logo.png` — supplied Meghe Group logo

## Step 1 — Prepare the Google Sheet

Open this Google Sheet:

`https://docs.google.com/spreadsheets/d/1cikrYjR486pPGm68EkrD4-PLaSzxcWQsQP2uJ7mVWhQ/edit`

1. Select **Extensions → Apps Script**.
2. Replace the default code with the contents of `Code.gs`.
3. Open **Project Settings**, enable **Show appsscript.json manifest file**, and replace it with `appsscript.json`.
4. Save the project.
5. Run `setupWorkbook()` once from the Apps Script editor.
6. Approve the requested permissions.

The script creates/updates these tabs:

- `Schools`
- `Schedule`
- `Observation_Log`
- `Settings`

The schedule runs from 13 July to 31 October 2026. Sundays and second Saturdays are excluded. Section rotation continues across months.

## Step 2 — Deploy Apps Script

1. In Apps Script, select **Deploy → New deployment**.
2. Choose **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy and copy the `/exec` URL.

Although the endpoint is reachable, every data request verifies a Google ID token and restricts users to `mgsnagpur.org`.

Paste the `/exec` URL into `config.js` as `API_URL`.

## Step 3 — Create Google OAuth Client ID

1. Open Google Cloud Console and create/select a project.
2. Configure the OAuth consent screen for your organisation.
3. Create an OAuth Client ID of type **Web application**.
4. Add the final GitHub Pages origin under **Authorised JavaScript origins**, for example:
   `https://YOUR-GITHUB-USERNAME.github.io`
5. Copy the Client ID and paste it into `config.js` as `GOOGLE_CLIENT_ID`.

## Step 4 — Publish on GitHub Pages

1. Create a GitHub repository, for example `online-classroom-observation`.
2. Upload these frontend files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `meghe-logo.png`
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**, branch `main`, folder `/root`.
5. Save and open the generated GitHub Pages URL.

## Observation flow

1. Sign in using an `mgsnagpur.org` account.
2. Select a school.
3. See the day’s three class/section allocations.
4. Tap **Start Observation & Join Meet**.
5. The backend records start time before opening Google Meet.
6. Return to the app and tap **Complete Observation**.
7. Enter only **Remarks** and submit.
8. The backend records submit time and calculates duration.
9. Durations over 35 minutes are flagged in the Google Sheet.

## Important note

The calculated duration is the period between clicking **Start Observation** and submitting remarks. It does not technically verify the exact time spent inside Google Meet.
