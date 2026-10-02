EEL RIVER LIDAR VIEWER — RETURN SCREEN V3, CHANNEL ROUTE V2

Open eel_lidar_viewer.html (or the published index.html). All numerical data,
rasters and libraries needed by the viewer are embedded. Online basemaps are
optional. Public version: https://daviddralle.github.io/eel-lidar/

Current data
Bed elevations and raw-point PCA roughness have been rebuilt from screened
candidate-bed returns. The class-14/class-15 interpretations and screening remain
provisional, not independent depth validation. Original source and v2 products
are preserved separately. See screening_methods.txt / quality_v3/README.txt and
method.json for explicit thresholds, selection bias and reproducibility.

Return checks: amber hatch = shallow bed versus surface unresolved; purple =
retained bed with no usable surface check; red = above-surface or other unresolved
support. Unpatterned retained bed has passed the provisional separation check.
NoData is unknown. Do not treat missing pools as shallow or fill their interiors
with a smooth surface. No optical depths enter the observed-bed or roughness layers.

Original bed comparison: gray map elevations and gray cross-section crosses at
excluded/changed cells. This reference is rounded to 1 cm for compact storage.
It does not alter the new statistics, contours, exports, or analyzed bed.
The original float32 TIFF is preserved locally for full-precision comparison.

Map and profile
Pan/zoom maps to subset the 100 m roughness profile; plot-box zoom moves the map.
Radius 1, 2, or 5 m selects the point-cloud PCA neighborhood, not the raster size.
The v2 axis follows the 2014 lidar footprint and preserves river kilometres.
Amber dashed route sections are uncertain and omitted from automatic sections
and default profile. Return-check categories are distinct from route quality.

Cross sections
Click near the route to place a normal section; draw A-B or drag endpoints.
Full-resolution 1 m containing cells are sampled at 1 m spacing. Blue/orange
marks are direct/interpolated candidate bed; purple means no water-surface check.
Brown terrain uses existing class-2 ground at 2 m. Short dashed bank-bed joins
are display aids only and cannot bridge flagged or internal bed gaps.
CSV exports retain source/quality fields; they do not add line-join elevations.
Sections show source GEOID12A elevations, not measured water depth.

Drag the dividers to resize main/side panels, map/profile and section height.
Keyboard arrows also adjust dividers; double-click or Reset layout restores defaults.
Layer checkboxes control elevation, hillshade, contours, quality and comparison.
Colors stretch to local elevations and therefore are not direct water-depth colors.
Contours and hillshade require neighboring valid pixels; neither fills NoData.

Files
roughness_predictors_100m_v3.csv and river_centerline_v3.gpkg contain screened
statistics, original v2 statistics for sensitivity comparisons, and areas in all
five quality categories. Quality fractions use original supported candidate bed,
not complete wetted-channel area. Category 4 can still contain contamination.
The bed and quality GeoTIFFs are available in Methods & data for use in QGIS.
Local QGIS project: full_mainstem/qgis_full_mainstem/eel_mainstem_lidar_v3.qgz.
The separately retrained NAIP pilot is in imagery/depth_pilot_v3; it remains
experimental and does not replace observed bathymetry in this viewer.

Validation
362 source-point caches checked; the audited false plateau is NoData in v3;
36 independent SVD/PCA checks; 17 cross sections and 21 map extents checked;
embedded TIFF hashes checked against source files. See numerical_verification.json,
quality_display_verification.json, quality_verification.json and deployment manifest.
These verify implementation consistency, not true riverbed depth or grain size.

Source: NCALM / OpenTopography CA14_Dietrich_B, July 2014,
https://doi.org/10.5069/G9MP517V. EPSG:26910. No new refraction correction,
registration, stage adjustment, or vertical-datum conversion. Original source
LAZ and all older scientific products remain available in the local project.
