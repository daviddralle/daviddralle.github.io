# SFPUC field atlas build

Only Sheep Camp North (SCN) and Maguire Ridge North (MN) are published.
The app is static HTML/JS and reuses the repository's vendored Leaflet library.

Python dependencies: xlrd, openpyxl, requests, numpy, rasterio, scipy,
scikit-image, shapely, pyproj, pillow. Set the source and intermediate paths
outside this public repository, then run from the repository root:

```sh
export SFPUC_SOURCE='/absolute/path/to/SFPUC_Ecohydrology'
export SFPUC_WORK='/absolute/path/to/private/build-cache'
python scripts/sfpuc/extract_sources.py
python scripts/sfpuc/prepare_terrain.py
python scripts/sfpuc/prepare_inventory.py
```

The intermediate JSON contains the original workbook contents, including
unpublished study sites and collector metadata. Do not publish that cache.
The final published features select the two site codes and scientific attributes.
The original source files are never modified.

Terrain crops are cached in the site data folders; remove those specific generated
GeoTIFFs before rerunning if intentionally replacing the terrain source. Source
queries select the Alameda County project, avoiding mosaics between unrelated
acquisitions. The original 1 m grid and no-data mask are retained; hillshade is
reprojected for Leaflet, and contours use 1 m Gaussian smoothing and 0.4 m line
simplification. No canopy-height or inferred tree-crown layer is generated.

The inventory builder verifies plot coordinates, tree IDs, plot/tag assignments,
species, recorded status, DBH, distance, azimuth, sampling-plan joins and DEM
coverage. A separate WGS84 geodesic forward calculation checks the archived KML
positions. Its agreement is a numerical check, not independent positional accuracy.
Device-reported GPS accuracy is preserved separately. No alignment correction is
applied. See the generated `data/qa.json` and `data/manifest.json` for results.

To preview, serve the repository root with a local HTTP server and open
`/field-sites/sfpuc/`. Check both site tabs, plot/species/status/plan filters,
CSV export, layer switches, basemaps, opacity, contours, search, feature details,
measurement, and phone layout. The data and notes describe a 2022 inventory and
the sampling-plan workbook available on 14 October 2026; update that provenance
explicitly if rebuilding from later records.
