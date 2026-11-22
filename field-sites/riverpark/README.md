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
Scheduled updates run on pi5 every hour at :20 Pacific, matching Rancho's hourly
frequency and offsetting its :10 run. The Pi's normal Git push triggers Pages.
The GitHub Actions workflow is manual-only recovery, with no scheduled trigger.

Pi entry point: `/home/daviddralle/daviddralle.github.io/scripts/riverpark/run_update.sh`.
Crontab: `20 * * * * /bin/bash /home/daviddralle/daviddralle.github.io/scripts/riverpark/run_update.sh >> /home/daviddralle/logs/riverpark/update.log 2>&1`.
The runner shares `/home/daviddralle/.local/state/hydroeco-automation.lock` with
the other website jobs. It stages and validates new data before publishing,
retains the full archive, and retries publication after concurrent remote pushes.
Logs rotate weekly via `/etc/logrotate.d/riverpark-weather` (eight copies).

Validation:
`python3 -m unittest discover -s scripts/riverpark -p 'test_*.py'`
and `node --test scripts/riverpark/test_dashboard.cjs`.

## Rainfall correction, November 18, 2026

`data/rain-corrections.json` adds the owner-approved 1.16 inches uniformly from
04:00 to 20:27 Pacific. The station counter gained 0.838 inches by 20:25,
compared with a nearby gauge's reported 2.0 inches at 20:27. The storm starts
with the interval ending at 04:05. The exact onset of clogging is unknown.

The dashboard applies this addition once to both five-minute and daily views,
and the plotted CSV includes it. Original monthly observations, recent data,
station daily summaries, and current readings remain source values. Corrections
are stored separately so hourly API refreshes cannot overwrite or compound them.
The existing 16:05–16:15 reporting gap remains incomplete; its 0.015-inch counter
increase is still excluded from observed interval sums. No visible correction
label is shown, as requested by the owner.

## Thumbnail

Real aerial imagery, exported November 15, 2026 from Esri World Imagery:
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer

Requested extent: -121.449, 38.565, -121.408, 38.585 (WGS84); output 1200 × 750,
Web Mercator. Shows River Park and the American River bend, without a station
location marker. Acquisition date is not asserted. Service attribution at
download: Esri, Vantor, Earthstar Geographics, and the GIS User Community.
Visible attribution accompanies the image on both listing pages.
