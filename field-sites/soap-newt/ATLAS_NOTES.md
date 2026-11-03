# Soap and Newt Creek

The public entry is `/field-sites/soap-newt/`; the atlas is `/field-sites/soap-newt/atlas/`.

The atlas uses source watershed delineations from the Soaproot_Providence shared archive, explicitly transformed from EPSG:32611 to WGS84. April 6, 2026 provisional NEON SOAP DTM and CHM (`2026_SOAP_9`) provide 1 m terrain and canopy. Both watershed polygons have complete source coverage; missing outer-margin terrain remains masked. The 3D terrain uses a 10 m grid. The canopy is a uniform sample of 250,000 measured vegetation returns from the matching NEON classified point cloud, normalized against the 1 m DTM. These are not identified tree stems. Ground elevations retain the source datum without offsets.

The infrastructure layer contains 27 archived boreholes, five spear sensors, one mapped gage and the officially located NEON flux tower. Known completed depths are separate from original drilled depths. Newt hole coordinates lack completion depths; no shafts are invented. The tower's simple outline uses source height and width, not a detailed structural survey. Source positions do not establish current operation.

Drainage paths use D8 routing of a 5 m resampling of the NEON DTM, with a 2 ha contributing-area threshold. They are terrain-derived paths, not observed flowing streams. Flow calculations use depression filling; the displayed terrain retains original elevations. The unverified archive burn outline is omitted; the displayed Blue Fire boundary is the complete official USFS 2021 final incident perimeter (2021-CASNF-000717). It is not a burn-severity map.

The dashboard contains 20 archived series with dates, source checksums, units and missing values. Groundwater source centimetres are converted to metres, positive downward. Gage pressure head is not discharge. Salt-dilution measurements are discrete points and nonzero source flags are excluded from the plotted series while retained in the source CSV. No rating curve is applied. Upstream rainfall processing may have zero-filled subhourly gaps; archive rainfall is not certified for water-balance totals. Flux/ET and soil moisture with unresolved units or sensor metadata are inventoried but not plotted.

## Reproduction

- `scripts/download_soap_newt_aop.py`: pinned NEON Earth Engine terrain/canopy download; requires existing authorized Earth Engine access.
- `scripts/build_soap_newt_atlas.py --source-root <Soaproot_Providence> --dem <DTM.tif> --canopy <CHM.tif> --aop-metadata <metadata.json> --derive-channels`: spatial products. Requires numpy, scipy, rasterio, pyproj, shapely, contourpy, Pillow and pysheds.
- `scripts/build_soap_newt_dashboard.py --help`: archived monitoring series.
- `scripts/update_soap_newt_neon.py`: current NEON product availability, without downloading observations. See `NEON_OPERATIONS.md` for the Pi runner.

Raw Drive archives and full source rasters stay outside the website repository. Generated JSON includes source paths relative to the research archive and checksums. Daily work belongs on the Pi; the Mac preparation steps above are not scheduled.

## Validation

Validated source coordinate systems, geometry, native raster coverage of both watersheds, terrain/canopy grid alignment and masks, all feature elevations, discharge flags, observation ordering, counts and groundwater conversions. Source-to-output checks retained all 62 dilution records and plotted 55 unflagged values. Drainage linework was sampled at 17,701 points with no source nodata intersections. JavaScript/Python and shell syntax checks passed. Browser checks cover chart categories/date filtering, discrete discharge points, mobile layers/search/inspection, 2D/3D switching and canopy rendering. Local asset links resolve. Basemaps depend on their external providers; the compiled research layers and charts are served from this repository.

## Authenticated tower observations

The Pi now downloads the three latest published months of temperature, humidity, wind speed (five sensor levels retained separately) and tipping-bucket precipitation. The observation JSON has eight separate series with UTC daily summaries, accepted/expected interval counts and source quality-flag summaries. Only finite observations with the applicable final quality flag equal to zero are accepted. Means require at least 36 of 48 half-hour intervals; precipitation totals require all 48. Latest cards show a single valid half-hour and its interval-ending timestamp, separately from the daily values and download-check timestamp. Initial coverage is July–September 2026, provisional. Failed product refreshes preserve prior series with explicit failure status. Source filenames/checksums and sensor reference offsets are retained; signed download URLs and credentials are not published.

The existing daily Pi job runs both availability and observation updates at 06:23 America/Los_Angeles. Raw files are cached outside the repository, and unchanged source checksums avoid repeat downloads. The website reads only the resulting static JSON.

## Geological and fire overlays; cartography

Geology uses the official CGS Mariposa sheet (1967), 1:250,000, transformed from EPSG:3310. Both watersheds fall entirely within the generalized Mesozoic granitic-rock unit. A basic-intrusive body and contact are retained in the 2 km context margin. The finer USGS Shaver Lake quadrangle (1976, 1:62,500) is linked as a reference, not the source of invented vector contacts. Source metadata and reproducible builder are in `data/geology/` and `scripts/build_soap_newt_geology.py`.

The Blue Fire perimeter retains its complete original geometry, 291.13 GIS acres versus 277 reported incident acres. The mapped polygon overlaps 13.622 ha of the archived Soap watershed and none of Newt; this is geometric overlap, not measured burned vegetation. The 3D outline stops at terrain coverage, while the Blue Fire preset shows the complete perimeter in 2D. Source and date qualifications are in `blue-fire-metadata.json`.

Contours are dark charcoal with heavier 50 m index lines. 2D displays 10 m contours; 3D displays 50 m index contours. Drainage uses thicker cyan lines with dark outlines, including screen-space ribbons in 3D. These widths are cartographic, not channel widths. Well collars use constant screen size and completed-depth shafts have enlarged widths; depths and coordinates remain unchanged. The secondary map title and introductory dashboard copy were removed. NEON weather observations and the temperature chart now precede archived groundwater and stream coverage.

## Measured canopy point cloud

Nine April 2026 classified NEON tiles supplied 70,816,096 eligible vegetation returns. A deterministic uniform random-priority sample retains 250,000 (0.3530%) in a 2 MB uint16 binary, with coordinates quantized to 0.1 m. All eligible returns in this crop were source class 5; ground, noise, unclassified and withheld returns are excluded. Both watersheds have observed source coverage. Missing western scene-margin coverage remains blank. Ground-return minus matched-DTM residuals have median −0.007 m and 5th–95th percentiles −0.128 to +0.139 m; no vertical adjustment was applied. Source checksums, coverage, sampling details and limitations are in `data/canopy-points.json`. Reproduce with `scripts/download_soap_newt_pointcloud.py` and `scripts/build_soap_newt_canopy_points.py`; raw tiles stay outside Git.
