# NEON data and Pi updates

The SOAP dashboard separates archived observations from current portal availability. The public site API reports September 2026 as the latest instrument/eddy-covariance month and July 2026 as the latest airborne month on 3 November 2026. These are **listed data months**, not the time of the most recent valid measurement. Instrument products normally appear in the second week after each month; this is not a real-time telemetry feed.

`dashboard/data/neon.json` contains current product availability only. `scripts/update_soap_newt_neon.py` requests the public site endpoint, retains each product's release/provisional status, and writes atomically. On failure it retains the last successful product inventory and `last_success_at`, changes `status` to `check_failed`, and exits nonzero. A fresh `checked_at` alone never indicates fresh observations.

New instrument-file downloads require a NEON API token. No token was found in the inspected task/Pi environment, and the authenticated data endpoint returned HTTP 403. Observation downloads are not configured. Never put an API token in this repository, generated JSON, command arguments, or browser code.

The daily runner is `scripts/run_soap_newt_neon.sh`, intended only for `/home/daviddralle/daviddralle.github.io` on `pi5`. It shares the existing automation lock at `/home/daviddralle/.local/state/hydroeco-automation.lock`, pulls master with `--ff-only`, updates the single availability JSON, and commits/pushes only that file. Existing Rancho and Sheep Camp jobs must be retained. The runner publishes explicit failure status while preserving last-good metadata.

Installed daily cron entry (06:23 America/Los_Angeles; follows PST/PDT):

```cron
23 6 * * * /bin/bash /home/daviddralle/daviddralle.github.io/scripts/run_soap_newt_neon.sh >> /home/daviddralle/logs/soap-newt/neon.log 2>&1
```

Installed and verified on 3 November 2026, preserving all existing Pi cron entries. The runner completed successfully at 18:47:31 UTC (10:47 PST), refreshed all 12 products, and pushed commit `34efc5c58ba7c233316ba3aa5d372dce3637856c`. Logs: `/home/daviddralle/logs/soap-newt/neon.log`. Scheduled execution remains on the Pi; no Mac schedule was created.

## Airborne terrain and canopy

Existing authorized Earth Engine access provided the official NEON publisher collections `projects/neon-prod-earthengine/assets/DEM/001` and `projects/neon-prod-earthengine/assets/CHM/001`. Both rasters use the pinned visit `2026_SOAP_9`, acquired 6 April 2026, provisional, Riegl VQ-780 II-S. Earth Engine's latest available SOAP visit lags the July 2026 visit listed in the main portal. Do not label the April raster as the newest portal acquisition.

`scripts/download_soap_newt_aop.py --project <existing-earth-engine-project> --output <local-working-directory>` reproduces a 1 m EPSG:32611 subset with bounds E296000–300000, N4100000–4104000. It requires an existing authorized Earth Engine login and `earthengine-api`/`rasterio`; it is a one-time preparation step, never a scheduled Mac job. Temporary download URLs stay in memory. Source raster masks remain missing data. Raw raster files are outside the public repository; published derivatives include source metadata.

Sources:

- [NEON SOAP site API](https://data.neonscience.org/api/v0/sites/SOAP)
- [NEON publication schedule](https://www.neonscience.org/data-samples/data-management/data-availability)
- [Data API authentication requirements](https://data.neonscience.org/data-api/endpoints/data/)
- [NEON CHM Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/projects_neon-prod-earthengine_assets_CHM_001)
- [NEON Earth Engine collections](https://www.neonscience.org/resources/learning-hub/tutorials/intro-aop-gee-image-collections)
