# River Park weather

Static GitHub Pages dashboard. `scripts/riverpark/update.py` fetches the public
Ambient station linked from the page, retaining only outdoor weather fields.
Station identifiers, IP addresses and coordinates are not published.

The initial backfill starts November 15, 2024. Monthly files retain five-minute
observations in UTC; `recent.json` serves the initial view. Daily summaries use
Pacific calendar days (including 23/25-hour daylight-saving days). Missing rain
increments remain null, and incomplete daily totals are marked in the UI.

Update: `python3 scripts/riverpark/update.py`. Explicit backfill:
`python3 scripts/riverpark/update.py --start YYYY-MM-DD`.
The GitHub Actions workflow runs every 15 minutes and explicitly requests a
legacy Pages build after committing new data. GitHub schedules can be delayed.

Validation:
`python3 -m unittest discover -s scripts/riverpark -p 'test_*.py'`
and `node --test scripts/riverpark/test_dashboard.cjs`.

## Thumbnail

Real aerial imagery, exported November 15, 2026 from Esri World Imagery:
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer

Requested extent: -121.449, 38.565, -121.408, 38.585 (WGS84); output 1200 × 750,
Web Mercator. Shows River Park and the American River bend, without a station
location marker. Acquisition date is not asserted. Service attribution at
download: Esri, Vantor, Earthstar Geographics, and the GIS User Community.
Visible attribution accompanies the image on both listing pages.
