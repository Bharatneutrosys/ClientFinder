# Client Finder Pilot Issue Log

Use this file during the 20-prospect pilot to track what fails, what feels confusing, and what should be fixed before broader use.

## Issue Tracker

| ID | Date | Area | Issue | Severity | Status | Notes | Fix Commit |
|---|---|---|---|---|---|---|---|
| PILOT-001 |  | Search |  | Critical / High / Medium / Low | Open / In Progress / Fixed / Won't Fix / Later |  |  |
| PILOT-002 |  | UI |  | Critical / High / Medium / Low | Open / In Progress / Fixed / Won't Fix / Later |  |  |
| PILOT-003 |  | Result Quality |  | Critical / High / Medium / Low | Open / In Progress / Fixed / Won't Fix / Later |  |  |

## Areas

- Search
- UI
- Result Quality
- Website Detection
- Contact Info
- Saved Prospects
- Outreach
- Client Workflow
- Export
- Performance
- Mobile
- Data Safety

## Severity

- Critical: blocks normal workflow, causes data loss, crashes the app, or prevents search/save/export.
- High: seriously hurts pilot usefulness or trust and should be fixed before broader use.
- Medium: important improvement for the next sprint but does not block a controlled pilot.
- Low: polish, wording, or minor usability issue.

## Status

- Open
- In Progress
- Fixed
- Won't Fix
- Later

## Initial Known Issues

- Detection is approximate for websites, mobile apps, booking systems, social presence, and online payment.
- Some businesses may not expose email, contact person, or direct social links.
- localStorage is single-browser and not team-safe.
- Supabase migration is prepared but not fully active by default.
- No login or organization workspace enforcement yet.
- No automated email sending.
- No real document upload.
- No raw password storage; access records should only reference secure storage.
- Google Places result quality may vary by location, category, and available business data.

## Fix Decision Rules

- Fix Critical issues immediately.
- Fix High issues before broader use.
- Move Medium issues into the next sprint unless several combine into a trust problem.
- Let Low issues wait unless they affect clarity, trust, or daily usability.
- Do not add major new features during pilot fixes unless a Critical or High issue requires it.

## Pilot Fix Log

| Date | Issue ID | Fix Summary | Verified By | Notes |
|---|---|---|---|---|
|  |  |  |  |  |
