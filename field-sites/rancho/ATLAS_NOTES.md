# Rancho Venada field atlas

The first atlas is static and GitHub Pages compatible. Weather remains at
`/field-sites/rancho/`; the atlas is at `/field-sites/rancho/atlas/`.
Both use the Rivendell atlas palette, serif titles and compact field controls.

## Scope and data

- 47 borehole records from the current **Borehole and well and piezometer metadata**
  Google Sheet, `Summary meta`, rows 2–50 (blank and barometer rows excluded).
- 46 located holes, including the 2023 campaign; 40 records have a documented
  completed or original drilled depth. MH3P6 was abandoned and is unlocated.
- Archived Mountain House boundary and MH1–MH9 subcatchments. MH1–MH8 form the
  primary study sequence; MH9 is retained and drawn with a dashed boundary.
- Main outlet supplied by David: 39.143007, -122.3471339. The archived watershed
  has not been re-delineated at this point. It remains a separate source geometry.
- Terrain-derived drainage lines and February 2024 weather, sap-flow and
  soil-moisture GPS waypoints. These are historical installations, not a claim
  about current operating status or channel wetness.
- All elevations now use the **2019 NCALM CA19_Dietrich bare-earth DEM**,
  resampled from its 0.25 m source raster to 1 m. No metadata elevations or
  offsets are used. This matching DEM keeps terrain, borehole collars and
  measured point elevations on the same NAVD88 (GEOID 12B) reference.
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

- The 1 m raster stores the maximum eligible return height above the matching
  bare-earth DEM per cell. Cells without returns are transparent. No crowns
  or heights are invented by interpolation.
- The 3D layer retains actual class 1/3/4/5 returns 0.5–85 m above the DEM.
  Class 1 is unclassified and may include non-vegetation objects. Ground,
  noise and withheld returns are excluded.
- Display processing uses 0.6 m voxel thinning within chunks, seeded reservoir
  sampling to at most 1.2 million returns, and a final duplicate-voxel removal.
  Coordinates are quantized to 0.1 m for compact delivery. Horizontal positions
  are transformed to NAD83 UTM 10N; absolute vertical values are not shifted.
- Raster and cloud use the Rivendell/SFPUC height color ramp. The point footprint
  covers 97.4% of the archived watershed; the coverage layer shows the boundary.
  Missing cells stay transparent and missing 3D terrain triangles are omitted.
- This is a historical canopy snapshot, not a tree identification or mortality
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
vector layers using `scripts/build_rancho_thumbnail.py --dem /private/path/to/rancho-2019-dem.tif`.
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
