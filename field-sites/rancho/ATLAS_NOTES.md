# Rancho Venada field atlas

The first atlas is static and GitHub Pages compatible. Weather remains at
`/field-sites/rancho/`; the atlas is at `/field-sites/rancho/atlas/`.
Both use the Rivendell atlas palette, serif titles and compact field controls.
The shared `rancho-logo.svg` supplies both header marks and favicons; shared
colors, navigation, focus states and chart typography connect the two views.

## Scope and data

- 47 borehole records from the current **Borehole and well and piezometer metadata**
  Google Sheet, `Summary meta`, rows 2–50 (blank and barometer rows excluded).
- 46 located holes, including the 2023 campaign; 40 records have a documented
  completed or original drilled depth. MH3P6 was abandoned and is unlocated.
- DEM-delineated Mountain House study boundary and archived MH1–MH9 subcatchments. MH1–MH8 form the
  primary study sequence; MH9 is retained and drawn with a dashed boundary.
- Provisional **MH10**, immediately north of MH9, is independently delineated
  from the 1 m LiDAR DEM using pysheds D8 flow routing. Its contributing area is
  **9.3003 ha** (93,003 cells), ending at the last tributary cell before the
  mainstem confluence. Pit/depression filling changes at most 0.024 m inside
  MH10 and is used only for routing; displayed elevations remain unchanged.
  The map polygon is simplified within 1 m and omits three diagonal-only 1 m²
  cells. It is not snapped to archived divides: 0.16% lies beyond the archived
  watershed and 609 m² overlaps archived MH9. These small boundary differences
  remain explicit in feature provenance. The dashed MH10 boundary and working
  name are provisional, not field verified.
- The study watershed outlet is **39.143030, -122.344525**, at the main valley
  exit indicated by the user. The approximate screenshot seed was snapped
  **5.5 m** to the nearest DEM-derived main-channel cell with at least 100 ha
  contributing area. The upstream watershed was redelineated with 1 m D8 routing:
  **152.3867 ha**, with no nodata cells or DEM-edge truncation. All MH1–MH10
  representative points and over 99% of each subcatchment are included.
  This replaces the previous outer boundary, retained for reference in
  `data/archived-watershed.geojson`. The position is map-derived, not surveyed.
  Drainage paths were regenerated at a 2 ha contributing-area threshold from
  the full DEM, removing the old clipped-DEM edge artifact at the former outlet.
- Terrain-derived drainage lines and February 2024 weather, sap-flow and
  soil-moisture GPS waypoints. These are historical installations, not a claim
  about current operating status or channel wetness.
- Elevations use the **2019 NCALM CA19_Dietrich bare-earth DEM**, with
  **2017 CA17_Dietrich** filling the northwestern missing portion. Source
  rasters (0.25 m / 0.5 m) are resampled to 1 m. No metadata elevations or
  vertical offsets are used. Both surveys use NAVD88; 2019 specifies GEOID 12B.
  Terrain now covers every study-watershed cell at 1 m resolution.
  The browser terrain mesh is resampled to 10 m; invalid triangles are omitted.

The `data/manifest.json` and each feature preserve provenance. The two supplied
papers were used to check the network layout and deep-well screen descriptions.
The Whiting manuscript and full private source records are not redistributed.
Hahm et al. (2022): https://doi.org/10.1029/2021WR031781.

## Measured canopy and coverage

The 2D canopy raster and 3D point cloud come from the **16–17 April 2019 NCALM
survey**, distributed by OpenTopography: https://doi.org/10.5069/G9FX77MW (CC BY 4.0).
The local mortality-project files were smaller excerpts, so the public source
was cropped to encompass Mountain House and its monitoring network.
The northwestern gap uses the **16–17 March 2017 NCALM survey**,
https://doi.org/10.5069/G9QC01MQ (CC BY 4.0), and its matching bare-earth DEM.
2017 returns are used only where the 2019 DEM is missing in the northern tiles.
The 2017 provider raster had small nodata holes; 377 cells were reconstructed
from a local TIN of measured class-2 ground returns, bounded by their convex hull
and a 20 m maximum nearest-return distance. No canopy is interpolated.
The median 2017-minus-2019 DEM difference near the seam is 0.011 m; neither is shifted.

- The 1 m raster stores the maximum eligible return height above the matching
  bare-earth DEM per cell. Cells without returns are transparent. No crowns
  or heights are invented by interpolation.
- The 3D layer retains actual class 1/3/4/5 returns 0.5–85 m above the DEM.
  Class 1 is unclassified and may include non-vegetation objects. Ground,
  noise and withheld returns are excluded.
- Display processing uses 0.6 m voxel thinning within chunks, seeded reservoir
  sampling to at most 1.2 million 2019 returns, and a final duplicate-voxel removal.
  The 2017 supplement adds up to 100,000 voxel-thinned measured returns.
  Coordinates are quantized to 0.1 m for compact delivery. Horizontal positions
  are transformed to NAD83 UTM 10N; absolute vertical values are not shifted.
- Raster and cloud use the Rivendell/SFPUC height color ramp. The point footprint
  originally covered 97.4% of the archived watershed. The 2017 supplement fills
  the northwestern gap in the raster, cloud, hillshade and contours. The coverage
  layer shows both survey boundaries. All study-watershed terrain cells are valid;
  canopy cells without returns remain transparent (98.3% of gap cells within the
  archived watershed have returns).
- This is a historical **two-date mosaic**, not a tree identification or mortality
  classification. The 2023 excerpts are not mixed into it.

`data/canopy.json` records source tile URLs and hashes, counts, ground-return
checks, sampling and coordinate encoding. Raw LAZs and source DEMs stay external.

## LiDAR contours and thumbnail

Contours are generated directly from the native DEM at 2 m intervals, with 10 m
index lines. Nodata cells are masked. Lines shorter than 8 m are omitted and
retained lines are simplified within 0.6 m in UTM coordinates. At overview zooms
only index lines are shown; zoom 17 and above adds the 2 m detail. The shared
layer toggle also controls the 3D index contours, clipped to the terrain extent
and draped just above the 10 m display mesh. No elevation offsets are applied.

`atlas/preview.webp` is a cartographic thumbnail rendered from the DEM and public
vector layers using `scripts/build_rancho_thumbnail.py --dem /private/path/to/rancho-composite-dem.tif`.
It illustrates MH5–MH7 and their monitoring network; it is not a photograph.

## Interpretation decisions

- MH7W4's metadata coordinate falls near MH8W1 on the north slope. Its south-slope
  coordinate from the retired February 2019 KML agrees with the papers and is
  used provisionally, with a visible placement note.
- MH8W1 lacks metadata coordinates and also uses the archived KML provisionally.
- Values carrying a foot mark in the nominal metre-depth column are converted
  using exactly 0.3048 m/ft. Completed depth takes priority over original drilling
  depth. Missing depths are not filled from transducer depths or pipe lengths.
- In 3D, solid shafts represent completed depths; dashed shafts represent original
  drilled depths only. Unknown depths show a collar only. Screen segments appear
  only where recorded or described in Hahm et al. section 2.6. Shafts are vertical
  representations; inclinations have not been surveyed. Widths are enlarged.
- The default vertical scale is 1:1. The optional 3× control scales both terrain
  elevations and shaft lengths and is explicitly labelled as exaggerated.
- A borehole's MH prefix is a monitoring-group name and does not always equal its
  containing watershed polygon. Original drill-log aliases remain in the inspector.
- MH7W5 is retained with a cave-in note; the logs identify MH7W6 as its replacement.
- No groundwater surface, geological contacts, or present-day tree status is
  inferred. Detailed drilling logs, mortality observations and time series are
  future additions.

## Rebuild

Keep source files and intermediate exports outside this repository. Read the
current Google Sheet with the connected Drive tools, saving the `values` row array
from `Summary meta!A1:AK85` to a private temporary JSON file. Then run:

```sh
python scripts/prepare_rancho_lidar.py --work '/private/path/to/rancho-lidar'

python scripts/build_rancho_atlas.py \
  --source-root '/path/to/AVR and Rancho Venada' \
  --metadata '/private/path/to/summary-meta-rows.json' \
  --dem '/private/path/to/rancho-2019-dem.tif' \
  --dem-source 'NCALM CA19_Dietrich 2019 bare-earth DEM, resampled from 0.25 m to 1 m' \
  --vertical-datum 'NAVD88 (GEOID 12B), meters'

python scripts/build_rancho_canopy.py \
  --tiles '/private/path/to/2019-laz-tiles' \
  --dem '/private/path/to/rancho-2019-dem.tif' \
  --survey-coverage '/private/path/to/CA19_Dietrich.geojson'
```

Dependencies: numpy, scipy, rasterio, pyproj, shapely, contourpy, laspy, lazrs and Pillow. The builder only
reads the specific GIS and metadata sources used here; it does not ingest raw
hydrologic observations, manuscripts, tree surveys or credentials. `data/qa.json`
lists unlocated holes, missing depths and provisional positions.

Weather HTML and processed JSON were recovered from the existing public Rancho
page because this checkout did not contain them. Styling and chart colours were
changed; units, source priority, completeness rules and water-year calculations
are retained. The JSON files are a public-feed snapshot for local preview. When
integrating into the hosting repository, retain its existing weather update job
and freshest JSON instead of replacing them with an older preview snapshot.

## Local checks and preview

```sh
python -m unittest discover -s scripts -p 'test_rancho_atlas.py'
python -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/field-sites/rancho/atlas/`. Local terrain and field data
work without a basemap service; satellite/topographic tiles need internet access.
The weather charts retain their existing Chart.js CDN dependency. Vendored
Leaflet, proj4 and Three.js were copied from the public Rivendell atlas, retaining
their licence headers. Publication adds Rancho atlas cards to the existing homepage and field-site collection. The existing weather data and refresh workflow are retained in the hosting repository.

### Northwestern supplement rebuild

Preserve the 2019 canopy products and catchments in an external baseline folder,
then run `scripts/supplement_rancho_lidar.py --work /external/rancho-canopy
--baseline /external/base2019`. It downloads two northern 2017 point tiles and
the matching provider DEM, writes the composite DEM externally, and updates
the compact canopy products. Re-run the atlas and thumbnail builders with
`--dem /external/rancho-canopy/rancho-composite-dem.tif`, the composite source
label in `canopy.json`, and its vertical datum. Terrain, contours and the outlet
then share that DEM. Refresh the HTML asset versions when publishing.

## MH10 delineation

Run with pysheds 0.5, numpy <2.4, rasterio, shapely and pyproj:

```sh
python scripts/delineate_rancho_mh10.py \
  --dem /external/rancho-composite-dem.tif \
  --streams /external/mh_2m_streams5000.geojson \
  --work /external/mh10-routing
```

The derived feature is retained separately in `data/derived-catchments.geojson`;
`build_rancho_atlas.py` includes it on subsequent rebuilds. Archived MH1–MH9
polygons are unchanged. Routing seeds use archived stream FIDs 164 (tributary)
and 169 (upstream mainstem), snap within 10 m to high-accumulation cells, and
follow D8 paths to their first shared cell. MH10 excludes that mainstem cell.

## LiDAR and well visibility

The canopy height color ramp already matches Rivendell. Display defaults now
use 70% canopy opacity, 1.2 px 3D returns, and opaque neutral gray terrain with Rivendell’s lighting.
Both canopy and ground opacity remain adjustable. Field points have dark
outlines; 3D wellheads use fixed 13 px symbols. Collars follow the actual
rendered terrain triangles, with documented depths measured below them.
Their source 1 m DEM elevations remain in the inspector/data unchanged.
Well symbols, outlined shafts and depth ticks render after terrain and canopy
without depth occlusion, so vegetation cannot hide them. This drawing order
does not represent a surveyed mounting height or a raised wellhead elevation.

## Main valley outlet and study watershed rebuild

Using the composite DEM and the same routing dependencies as MH10, run:

```sh
python scripts/delineate_rancho_watershed.py \
  --dem /external/rancho-composite-dem.tif \
  --seed 556644 4332848 \
  --work /external/study-watershed-routing
```

The seed is an approximate interpretation of the user's 2026-10-16 screenshot
red X in EPSG:26910, not a surveyed coordinate. The snap is limited to 30 m.
`data/study-watershed.geojson` retains the derived boundary, outlet and routing
QA; `data/derived-channels.geojson` retains the new drainage network. These files
are inputs to subsequent atlas builds. After rebuilding the composite terrain
or MH10, rerun this delineation before the atlas builder so coverage and
subcatchment inclusion checks use the current watershed. Routing modifications
are confined to flow calculations; all displayed elevations use the original DEM.

## Jerry Mode

The 3D viewer has an optional, fictional ranch companion layer: a procedurally
modeled burgundy Kawasaki Mule, Jerry, and the two dogs Cali and Colusa. The
supplied photo informs the illustration but is not redistributed. The model is
2.4× enlarged for legibility, and the crew renders above vegetation. Its motion,
dust, home ring, wine bottle, and poems never enter scientific GeoJSON exports.

Every activation and **Start at home** resets to the approximate circle-drive
location interpreted from the user's marked satellite screenshot: UTM 10N
E556769, N4332702. This is not a surveyed waypoint. The roaming route is fictional. It now leaves the drive promptly and visits
MH3, MH7, MH8 well clusters and the weather station in a repeating circuit.
Pass-through targets use offsets within 12 m of the published collars / RVWS;
the Mule keeps moving through each destination. Only wine stops park him. Destination buttons also send him directly to these sites.
Cruising is roughly twice the original speed, with turn, grade and arrival
braking; this is arcade motion, not a real driving route. All route points and motion steps use valid DEM terrain;
terrain slope changes produce bounded arcade jumps, now around 4 m high with
more airtime, a nose-up launch and a slight airborne bank. Cruise speed is unchanged
from the faster monitoring-site circuit. There are no boosts. The
follow camera keeps tracking through wheel/trackpad zoom, touch pinch and middle-button
zoom, retaining the chosen distance. Click-drag rotation keeps follow and retains the chosen viewing angle;
Ctrl/Command-drag (or right-drag) pans and releases follow. One-finger touch
rotation keeps follow; two-finger pan releases it. Simple clicks keep follow. Choosing a map view also releases follow.
Pause is available; reduced-motion preferences start the mode paused. Leaving
3D ends Jerry Mode and restores the atlas controls. Hidden tabs do not fast-forward.

Drag **Drop a fine red** to terrain, or click it and then choose a point. Keyboard
and touch users can use **Serve beside Jerry**. Escape cancels placement. Jerry
drives to the bottle, stops, takes a sip, then thinks for three seconds before
revealing a poem. A warm-paper thought bubble follows his head in screen space
and resolves from “Jerry is thinking…” into the haiku, matching Bill’s treatment.
The bubble stays within the viewport and supports reduced-motion preferences. He remains parked
until **Back to roaming**. **100 ranch haikus** opens the full searchable library,
with ten theme filters and primary-source reading links. The shuffled deck shows
each poem once before recycling; it avoids an immediate repeat across decks.

`jerry-haikus.js` contains 100 original fictional 5–7–5 poems, not quotations by
or endorsements from Jerry Brown. Ten historical essays, published or coauthored
by Brown and reproduced on his own website, informed the themes: nuclear memory,
the arms race, restraint, dialogue, a shared atmosphere, heat and water, local
climate action, truth and humility, time and choice, and ranch community. Each
poem links to its theme's essay; the library retains titles, authors, and dates.
The verse is newly composed; it does not present historical policy descriptions
or clock settings as present-day facts. Meter was reviewed against CMUdict and
manually checked for the missing compounds “unmake,” “unhooks,” and “lungful.”

Validation: `node --test scripts/test_rancho_jerry.mjs` checks the complete deck,
reference links, start/reset coordinates, route coverage on valid terrain,
visits to all four destinations within three simulated minutes, direct destination
commands, bounded jumps, wine pickup/stop/thinking/poem progression, and resumption. The existing
`test_rancho_atlas.py` checks scientific products independently.

`test_rancho_jerry_camera.mjs` checks retained zoom distance, rotation versus modified pan drags,
and pinch versus pan gestures. Route tests require nonzero speed through each
destination and verify the larger jumps remain below 5 m.
