# NEON data and Pi updates

The SOAP dashboard separates archived observations from current portal availability. The public site API reports September 2026 as the latest instrument/eddy-covariance month and July 2026 as the latest airborne month on 3 November 2026. These are **listed data months**, not the time of the most recent valid measurement. Instrument products normally appear in the second week after each month; this is not a real-time telemetry feed.

`dashboard/data/neon.json` contains current product availability only. `scripts/update_soap_newt_neon.py` requests the public site endpoint, retains each product's release/provisional status, and writes atomically. On failure it retains the last successful product inventory and `last_success_at`, changes `status` to `check_failed`, and exits nonzero. A fresh `checked_at` alone never indicates fresh observations.

Authenticated meteorological downloads are configured on the Pi. The token is read from `/home/daviddralle/.config/soap-newt/neon-token` (mode 0600) and sent only in the `X-API-Token` header to the official NEON API. It is never included in the repository, generated JSON, command arguments, browser code, or logs. Temporary Google Cloud download URLs stay in memory; token headers are stripped across cross-origin redirects.

The daily runner is `scripts/run_soap_newt_neon.sh`, intended only for `/home/daviddralle/daviddralle.github.io` on `pi5`. It shares the existing automation lock at `/home/daviddralle/.local/state/hydroeco-automation.lock`, pulls master with `--ff-only`, updates availability and observations sequentially, and commits/pushes only `neon.json` and `neon_observations.json`. Existing Rancho and Sheep Camp jobs must be retained. The runner publishes explicit failure status while preserving last-good metadata.

Installed daily cron entry (06:23 America/Los_Angeles; follows PST/PDT):

```cron
23 6 * * * /bin/bash /home/daviddralle/daviddralle.github.io/scripts/run_soap_newt_neon.sh >> /home/daviddralle/logs/soap-newt/neon.log 2>&1
```

Installed and verified on 3 November 2026, preserving all existing Pi cron entries. The runner completed successfully at 18:47:31 UTC (10:47 PST), refreshed all 12 products, and pushed commit `34efc5c58ba7c233316ba3aa5d372dce3637856c`. Logs: `/home/daviddralle/logs/soap-newt/neon.log`. Scheduled execution remains on the Pi; no Mac schedule was created.

## Authenticated meteorological observations

`scripts/update_soap_newt_observations.py` downloads the latest three available months from four SOAP products. Its first verified run covered 1 July–30 September 2026. The latest valid half-hour ends at `2026-10-01T00:00:00Z` (the interval begins on 30 September); this timestamp is not a current weather observation.

| Product | Source variable / final flag | Selection | Daily summary |
| --- | --- | --- | --- |
| DP1.00003.001 | tempTripleMean / finalQF | Triple aspirated air temperature, 000.060 | Mean, °C |
| DP1.00098.001 | RHMean / RHFinalQF | Tower humidity, 000.060; soil array excluded | Mean, % |
| DP1.00001.001 | windSpeedMean / windSpeedFinalQF | Five separate tower levels 000.010–000.050 | Mean, m/s |
| DP1.00045.001 | precipBulk / finalQF | Tower tipping bucket, 000.060 | Total, mm/day |

Source filenames, table names, units, sensor positions, half-hour duration, and duplicate timestamps are checked before publication. Only finite values with the corresponding final flag exactly zero are accepted. Flags 1, -1, missing values, and missing intervals are excluded. Daily UTC means require at least 36 of 48 intervals; precipitation totals require all 48. Missing days remain null. Samples are assigned by interval start, so midnight-ending intervals belong to the preceding UTC day. Wind direction is not arithmetically averaged.

The output includes `coverage` as `[date, valid_intervals, expected_intervals]`, daily `quality_counts`, exact product/variable metadata, source filenames and hashes, and sensor-position records. Latest interval values and units are separate from daily values (precipitation: mm per half-hour versus mm/day). Sensor height is the source `zOffset` relative to `TOWER111206`, not an independently surveyed local height above ground. Heights are never averaged; a changed or missing z-offset blocks that product's replacement until explicitly reconciled.

Raw CSVs are cached outside Git at `/home/daviddralle/.cache/soap-newt-neon`. File sizes and provided MD5 checksums are verified. An immediate second run reused all 48 selected source/metadata files with **zero downloads**. Each day still checks the monthly file inventories so revised provisional files can be detected. Output provenance includes SHA-256 hashes and never includes temporary signed download URLs.

A failed product preserves its prior series, marked `check_failed`; the top-level status becomes `partial_failure`. An availability or credential failure retains all last-good observations and records `check_failed`. `last_success_at` is advanced only after a fully successful observation refresh. The runner publishes explicit failure status and exits nonzero. Both jobs use the existing daily 06:23 Pi schedule and shared automation lock; no additional cron entry or Mac schedule is required.

## Airborne terrain and canopy

Existing authorized Earth Engine access provided the official NEON publisher collections `projects/neon-prod-earthengine/assets/DEM/001` and `projects/neon-prod-earthengine/assets/CHM/001`. Both rasters use the pinned visit `2026_SOAP_9`, acquired 6 April 2026, provisional, Riegl VQ-780 II-S. Earth Engine's latest available SOAP visit lags the July 2026 visit listed in the main portal. Do not label the April raster as the newest portal acquisition.

`scripts/download_soap_newt_aop.py --project <existing-earth-engine-project> --output <local-working-directory>` reproduces a 1 m EPSG:32611 subset with bounds E296000–300000, N4100000–4104000. It requires an existing authorized Earth Engine login and `earthengine-api`/`rasterio`; it is a one-time preparation step, never a scheduled Mac job. Temporary download URLs stay in memory. Source raster masks remain missing data. Raw raster files are outside the public repository; published derivatives include source metadata.

Sources:

- [NEON SOAP site API](https://data.neonscience.org/api/v0/sites/SOAP)
- [NEON publication schedule](https://www.neonscience.org/data-samples/data-management/data-availability)
- [Data API authentication requirements](https://data.neonscience.org/data-api/endpoints/data/)
- [NEON CHM Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/projects_neon-prod-earthengine_assets_CHM_001)
- [NEON Earth Engine collections](https://www.neonscience.org/resources/learning-hub/tutorials/intro-aop-gee-image-collections)
