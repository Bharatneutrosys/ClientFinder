# MVP Testing

This file documents the exact commands and checks for the current plain JavaScript MVP.

## Prerequisites

- Node.js installed
- Run commands from `company-collector/`

Install dependencies:

```bash
npm install
```

If PowerShell blocks `npm`, use:

```bash
npm.cmd install
```

## 1. Run the collector

Command:

```bash
node index.js --keyword="IT staffing" --city="Dallas" --state="TX"
```

What should happen:

- The command prints collector stats
- `companies.json` is created or updated
- `companies.csv` is created or updated
- Saved results should usually be greater than `0` when the fallback provider is reachable

Optional mock run:

```bash
node index.js --keyword="IT staffing" --city="Dallas" --state="TX" --mock
```

## 2. Start the server

Command:

```bash
npm start
```

What should happen:

- Console shows `Server running at http://localhost:3000`
- The viewer is available at `http://localhost:3000/viewer/`

## 3. Open the viewer

Open:

```text
http://localhost:3000/viewer/
```

What should happen:

- The dashboard loads
- Summary cards show totals
- The companies table appears
- Search, state, city, and quality filters are visible

## 4. Test one website scan

In the viewer:

- Click `Scan Website` for a company with a website
- Expand `View Contacts`

What should happen:

- The scan status changes from `Not scanned` to `Scanning`
- Contacts appear under the company when found
- `contacts.json` is updated

## 5. Confirm persistence after refresh

In the viewer:

- Refresh the page
- Expand the same company again

What should happen:

- Saved contacts still appear
- Scan status remains hydrated from saved data

## 6. Test bulk scanning

In the viewer:

- Click `Scan All Visible Companies`

What should happen:

- Bulk progress text updates while scanning
- Companies with websites are scanned one at a time
- More saved contacts appear in `contacts.json`

## 7. Test exports

In the viewer:

- Click `Export companies.csv`
- Click `Export contacts.csv`
- Click `Export high_quality_contacts.csv`
- Click `Export approved_contacts.csv`

What should happen:

- Each file downloads successfully
- `approved_contacts.csv` may contain only the header row until contacts are approved

## Quick API checks

These are useful when validating the backend without clicking through the UI.

Check saved contacts:

```bash
curl http://localhost:3000/api/contacts
```

Scan a website:

```bash
curl -X POST http://localhost:3000/api/scan-website ^
  -H "Content-Type: application/json" ^
  -d "{\"website\":\"https://www.cornerstonetechtalent.com\",\"company_name\":\"Cornerstone Tech Talent\"}"
```

Export contacts:

```bash
curl -I http://localhost:3000/api/exports/contacts.csv
curl -I http://localhost:3000/api/exports/high-quality-contacts.csv
curl -I http://localhost:3000/api/exports/approved-contacts.csv
```

## Common errors and fixes

`npm` is blocked in PowerShell:

- Use `npm.cmd install` or `npm.cmd start`
- Or run the same commands from Command Prompt

Collector returns `0` results:

- Confirm the command uses normal quoted values like `--state="TX"`
- The CLI now strips surrounding quotes correctly
- If live sources are temporarily weak, use `--mock` to verify the UI flow

Viewer says it cannot load `companies.json`:

- Run the collector first
- Confirm `companies.json` exists in `company-collector/`
- Start the Express server from `company-collector/`

Website scan returns no contacts:

- Some sites do not expose public contact details on scanned pages
- Some sites block scanning or have little usable text
- Try another company website

Too many weak phone-only contacts:

- The scanner now extracts phones from cleaned page text instead of raw HTML
- If a site is still noisy, treat low-score contacts as review candidates, not approved contacts

Approved export is empty:

- This is expected until one or more contacts are marked `approved`
