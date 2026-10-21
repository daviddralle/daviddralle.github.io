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
simplification. No inferred tree crowns are generated. Measured 3D returns are prepared separately below.

The inventory builder verifies plot coordinates, tree IDs, plot/tag assignments,
species, recorded status, DBH, distance, azimuth, sampling-plan joins and DEM
coverage. A separate WGS84 geodesic forward calculation checks the archived KML
positions. Its agreement is a numerical check, not independent positional accuracy.
Device-reported GPS accuracy is preserved separately. No alignment correction is
applied. See the generated `data/qa.json` and `data/manifest.json` for results.

To preview, serve the repository root with a local HTTP server and open
`/field-sites/sfpuc/`. Check both site zoom buttons, plot navigation, species/status/plan filters,
CSV export, layer switches, basemaps, opacity, contours, search, feature details,
measurement, and phone layout. In 3D, check both-site navigation, canopy and contour toggles, opacity, point size, top-down view, spin, and field-record inspection. The data and notes describe a 2022 inventory and
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

### Regional geology

Run `python scripts/sfpuc/prepare_geology.py` with `SFPUC_WORK` set as above
(add geopandas to the Python dependencies). It caches the NGMDB shapefile
conversion of USGS OFR 96-252, transforms it to WGS84, and clips rock units,
contacts, and faults around both sites. Output is `data/geology/`.

The converted shapefiles omit a CRS. The original report specifies UTM zone 10
meters; three original `al_quad.e00` grid controls identify NAD27, with less
than 1 m residual versus approximately 205 m under NAD83. The script asserts
those checks, records the coordinate transformation and archive checksum, and
checks that all 20 plot centers intersect exactly one source unit. Geometries
are not simplified or adjusted to imagery. Keep the source cache private;
only the clipped GeoJSON and scientific provenance are published.

Source: Graymer, Jones and Brabb (1996),
<https://pubs.usgs.gov/of/1996/of96-252/>;
NGMDB conversion <https://ngmdb.usgs.gov/Prodesc/proddesc_22969.htm>.
The database has approximately 1:50,000 effective detail, regardless of the
atlas zoom. Most young surface deposits are lumped into Qu and most landslides
are omitted. Colors are atlas display colors. Rock units do not directly
measure soil depth or subsurface water storage. Fault line certainty is
retained without interpreting current activity.

The optional overlay loads only when enabled. Check unit/line popups, opacity,
fault visibility, changing sites, extent navigation, measurement, field-record
selection, and phone layout. The same controls also apply to the 3D terrain drape.

### Soil units and plot measurements

`python scripts/sfpuc/prepare_soils.py` retrieves NRCS SSURGO polygons via
Soil Data Access using the query stored in `data/soils/metadata.json`. Set
`SFPUC_WORK` as above. The private response cache is `soils/polygons.json`;
remove that file only when intentionally refreshing the snapshot. Polygons
are clipped in WGS84 without simplification. The builder checks valid geometry,
continuous cutout coverage, and exactly one map-unit key at each plot center.
Map-unit names are retained verbatim; their slope ranges are not plot measurements.

The inventory builder now retains the selected plot workbook's litter depth,
rock/forb cover, four shrub-cover slots, shrub species list, land-use codes,
slope-position code, and parent-material field. Missing values remain missing.
Slope units and slope-position code definitions are not supplied. Land-use
codes follow the 2022 report. No association between shrub slots and individual
species is inferred. Rebuilding the inventory regenerates these fields.

Sidebar QA: primary geology/soils/tree/plot/terrain/contour toggles must remain
visible without expanding a disclosure. Check nested legends, all-off,
secondary layer counts, filter indicators, synchronized terrain controls,
soil-over-geology click precedence, and sticky Close buttons on long plot
records and the sources dialog. Escape dismisses panels/popups and measurement.

### Soil properties and 3D context

After preparing soil polygons and the 3D terrain, run:

```sh
python scripts/sfpuc/prepare_soil_properties.py
python scripts/sfpuc/prepare_context_3d.py
```

The first script retrieves `muaggatt`, `component`, `chorizon` and
`corestrictions` through NRCS Soil Data Access, caching responses under
`$SFPUC_WORK/soils/`. The published `properties.json` retains queries, response
hashes, component proportions, averaging methods and represented percentages.
To refresh deliberately, replace the four cached table responses and update
the retrieval date. AWC uses soil horizons in the upper 100 cm, stopping at the
first restriction or described soil bottom; clay and organic matter use the
upper 30 cm. Components with unrated gaps are excluded. Means are weighted by
representative component percentage, renormalized only over eligible components.
NRCS water storage (cm water) is converted to mm. Restriction depth is a
conditional mean, described profile depth is database coverage, and the NRCS
bedrock minimum is neither of these. No missing depth is treated as zero.

The second script needs geopandas, rasterio, numpy, shapely and Pillow. It
reprojects the existing vectors to EPSG:26910 and rasterizes colors and unit
IDs at the existing terrain vertices. The PNGs are display textures; the
little-endian uint16 arrays support nearest-cell picking. These do not change
the source data's spatial precision or infer subsurface geometry. Both patches
must have full unit coverage. Context manifests record source hashes, grid
geometry and code lookup tables. Rebuild these after changing vectors or terrain.

QA: compare all 20 plot unit IDs against the source polygon intersections;
verify Perkins AWC 0.1443 cm/cm (85% represented), Los Gatos–Los Osos AWC
0.17251 cm/cm and restriction depth 84.33333 cm (90% represented). Verify
Perkins has no reported restriction. In the browser check both site drapes,
layer/opacity/fault controls, ground picking, plot summaries, Close/Escape,
all-off, returning to 2D, and mobile layout. Hide above-ground returns when
inspecting the terrain colors.

Inventory symbols: plot centers use white crosses with dark outlines in both
views. Tree diameters in both views use twice the shared `treeRadius` helper
(square-root DBH scale, radius clamped to 3.5–10 CSS pixels). The 3D point shader
applies each record's diameter with device-pixel scaling; outline diameters
follow the same sizes. This changes inventory markers, not LiDAR return sizes.
Screen-space picking matches those marker sizes, with plot crosses above trees.
Check tree/plot selection, filtering, layer switches and zoom after symbol edits.

The shared map legend is open on desktop and starts collapsed on phones.
It uses the inventory species palette and DBH sizing helper, and distinguishes
field markers, plot circles, planned trees, contour intervals, and additional
line styles. Check Hide/Show, Escape, 2D/3D contour labels, and mobile scrolling.

### Eagle buffers

Run `python scripts/sfpuc/prepare_eagle_buffers.py /path/to/source.kmz` after
preparing the Maguire Ridge terrain. It extracts only the Maguire Peaks polygons
from the supplied 2026 minimum and maximum buffer folders. The original vertices
are retained, geometry validity and all ten plot-center intersections are checked,
and projected polygon areas verify the 800 m and 1,600 m distance interpretation.
The metadata records the source hash and missing XML namespace repair. Keep the
complete KMZ outside the public repository; nest points and unrelated layers are
not published.

GeoJSON supports the complete polygons in 2D. The 3D fill textures use the existing
2 m terrain grid; vector boundaries are drawn only where terrain elevations are
available. A terrain cutout edge is not a buffer boundary. Check separate minimum
and maximum switches, opacity, source details and Close, All off and re-enabling,
metric/imperial labels, and Full buffer extent returning from 3D to 2D.

### Drawing sessions

The Draw menu beside Measure creates points, polylines, simple polygons and
rectangles in 2D. `drawing.js` keeps an independent feature group, editing and
undo history; `draw-export.mjs` validates geometry and serializes KML. Completed
features and saved attributes persist under `sfpuc-drawing-session-v1` in browser
localStorage. This is one local session across both sites, not a shared dataset.
No drawing coordinates are uploaded. Undo history is limited to 30 changes and
does not survive reload. Unsaved geometry is discarded by Cancel or switching
tools. The 3D view does not display user drawings.

`node scripts/sfpuc/test_drawing.mjs` checks invalid polygons, coordinate limits,
unique IDs, escaping and non-mutating KML export. KMZ contains `doc.kml` with
WGS84 longitude/latitude and clamp-to-ground geometry, plus an embedded PNG point
symbol. ID and description appear as both display fields and ExtendedData;
source site, drawing type, session and timestamps are also included.

Browser QA: create all four types, edit and cancel geometry, reject duplicate
IDs, save text with XML characters/newlines/Unicode, delete/undo, clear/undo,
hide drawings and export all, reload, select on the map and in the session list,
switch sites, switch Measure/Draw/3D, and check phone/laptop layouts. Unzip the
actual browser download and independently validate XML and geometry.
