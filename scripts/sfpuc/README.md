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

### 3D point clouds

`prepare_3d.py` reads cropped EPT LAS/LAZ from `$SFPUC_WORK/lidar/`.
The exact PDAL `readers.ept` retrieval pipeline for each site is stored in
`data/<site>/3d/scene.json` under `source.retrieval_pipeline`. Run that pipeline
with an output filename in the work directory before running the script.
Sources: public USGS EPT `CA_AlamedaCo_3_2021` for Sheep Camp and
`CA_AlamedaCo_1_2021` for Maguire Ridge. The EPT reader selects a 0.75 m level
of detail in EPSG:3857, then reprojects horizontal coordinates to EPSG:26910.
Vertical coordinates remain NAVD88 meters.

The scene uses every second cell of the existing 1 m DEM. Above-ground
returns retain source coordinates (2 cm packing precision), are filtered to
classes 1/3/4/5 and heights 0.5–85 m, exclude withheld points, and are thinned
by a 0.4 m voxel plus seeded selection capped at 650,000 returns per site.
Class 1 is unclassified, not a definitive vegetation label. The source
clouds remain in the local work directory; the website contains only the
browser subsets and terrain assets. Metadata records counts and sampled
ground-point minus DEM residuals, without shifting the points or terrain.
Both patches occupy one shared scene in meters, without filling the gap
between them. Color stops match Rivendell exactly.
