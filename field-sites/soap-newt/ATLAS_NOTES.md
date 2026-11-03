# Soap and Newt Creek

The public entry is `/field-sites/soap-newt/`; the atlas is `/field-sites/soap-newt/atlas/`.

The atlas uses source watershed delineations from the Soaproot_Providence shared archive, explicitly transformed from EPSG:32611 to WGS84. April 6, 2026 provisional NEON SOAP DTM and CHM (`2026_SOAP_9`) provide 1 m terrain and canopy. Both watershed polygons have complete source coverage; missing outer-margin terrain remains masked. The 3D surface and canopy samples use a 10 m grid. Canopy samples are not identified tree stems. Ground elevations retain the source datum without offsets.

The infrastructure layer contains 27 archived boreholes, five spear sensors, one mapped gage and the officially located NEON flux tower. Known completed depths are separate from original drilled depths. Newt hole coordinates lack completion depths; no shafts are invented. The tower's simple outline uses source height and width, not a detailed structural survey. Source positions do not establish current operation.

Drainage paths use D8 routing of a 5 m resampling of the NEON DTM, with a 2 ha contributing-area threshold. They are terrain-derived paths, not observed flowing streams. Flow calculations use depression filling; the displayed terrain retains original elevations. The original burn outline lacks source CRS and identifying metadata and is omitted.

The dashboard contains 20 archived series with dates, source checksums, units and missing values. Groundwater source centimetres are converted to metres, positive downward. Gage pressure head is not discharge. Salt-dilution measurements are discrete points and nonzero source flags are excluded from the plotted series while retained in the source CSV. No rating curve is applied. Upstream rainfall processing may have zero-filled subhourly gaps; archive rainfall is not certified for water-balance totals. Flux/ET and soil moisture with unresolved units or sensor metadata are inventoried but not plotted.

## Reproduction

- `scripts/download_soap_newt_aop.py`: pinned NEON Earth Engine terrain/canopy download; requires existing authorized Earth Engine access.
- `scripts/build_soap_newt_atlas.py --source-root <Soaproot_Providence> --dem <DTM.tif> --canopy <CHM.tif> --aop-metadata <metadata.json> --derive-channels`: spatial products. Requires numpy, scipy, rasterio, pyproj, shapely, contourpy, Pillow and pysheds.
- `scripts/build_soap_newt_dashboard.py --help`: archived monitoring series.
- `scripts/update_soap_newt_neon.py`: current NEON product availability, without downloading observations. See `NEON_OPERATIONS.md` for the Pi runner.

Raw Drive archives and full source rasters stay outside the website repository. Generated JSON includes source paths relative to the research archive and checksums. Daily work belongs on the Pi; the Mac preparation steps above are not scheduled.

## Validation

Validated source coordinate systems, geometry, native raster coverage of both watersheds, terrain/canopy grid alignment and masks, all feature elevations, discharge flags, observation ordering, counts and groundwater conversions. Source-to-output checks retained all 62 dilution records and plotted 55 unflagged values. Drainage linework was sampled at 17,701 points with no source nodata intersections. JavaScript/Python and shell syntax checks passed. Browser checks cover chart categories/date filtering, discrete discharge points, mobile layers/search/inspection, 2D/3D switching and canopy rendering. Local asset links resolve. Basemaps depend on their external providers; the compiled research layers and charts are served from this repository.
