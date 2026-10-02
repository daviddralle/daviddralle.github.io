Local pool edit v2p1 — October 1, 2026

The broad v3 water-surface screening has been withdrawn. It removed legitimate
shallow bed. The original v2 bed and roughness are restored everywhere except
a manually reviewed upper-band patch in the scoured pool near river km 152.4.

The exact 1 m exclusion footprint is pool_exclusion.geojson (WGS84). Within a
hand-delineated interior boundary, only original bed elevations >=32.30 m are
excluded: 5,712 cells, 0.0632% of the original 9,033,332 supported bed cells.
This absolute cutoff belongs ONLY to this audited pool. It is not a depth
threshold and is never applied to shallow water elsewhere. Lower elevations
within the boundary are preserved. Other false returns may remain, including
mixed cells at the edge; this is a conservative, localized correction.

Roughness is omitted where neighborhoods could include removed returns: each
radius plus 1.5 m from excluded cell centers. Original numerical roughness
values elsewhere remain unchanged. Only affected 100 m summaries are updated.
No bottom elevation is filled or inferred. Banks are unchanged and are not used
to fill the reviewed exclusion in sections. Dashed bank joins cannot cross it.
The map can toggle the orange exclusion outline; that does not restore the
excluded elevations. Original v2 rasters remain available locally for comparison.

Current bed: eel_mainstem_bathy_v2p1_1m.tif and matching _support.tif.
Current summaries: roughness_predictors_100m_v2p1.csv, river_centerline_v2p1.gpkg.
Current QGIS project: eel_mainstem_lidar_v2p1.qgz.
The route, banks, UI controls, colors, hillshades and contours remain at v2.
The earlier screened v3 imagery pilot is also withdrawn as the active pilot;
the original imagery/depth_pilot is preserved and remains experimental.

The sections below document the underlying v2 processing before this one-pool
exclusion. See edit_report.json and preservation_verification.json for changes.

Route correction v2 — October 1, 2026

The former NHD/NLDI guide was a regional routing line, not a lidar-derived
channel center. It crossed bars and cut across some 2014 bends. It has been
replaced by a 216.255 km provisional axis following observed 2014 classes
9/14/15 water/bed footprints. Old and new river kilometres differ.

Route construction: 4 m cells, 5 km reference-route branch anchors, geometric
least-cost routing favoring broad water interiors, 10 m Gaussian smoothing
capped at 5 m displacement, and removal of self-intersection loops. This is a
channel guide, not a surveyed thalweg. Classes and incomplete footprints can
still misidentify channel position. The water-alignment score uses the same
footprints used to build the route; it is not independent validation.

Of 2,163 intervals, 1,812 allow automatic sections; 351 are amber/dashed and
require manual Draw A–B. Flags identify sparse water support, multiple channels,
ambiguous station order, unresolved width, and complex estuary routing. The
last estuarine reaches do not have a uniquely supported main-channel axis.
Flagged values remain in CSV/GPKG with quality fields but are omitted from the
default profile. Automatic sections use a normal to a 40 m route secant.
The Original NHD guide checkbox allows direct comparison.

Roughness values are reassigned to new 100 m intervals using nearest-segment
projection, limited laterally to half the footprint width + 12 m (20–300 m).
This is an approximate mainstem association, not a mapped habitat boundary.
Use route quality and density/coverage covariates in downstream analysis.

Full source tiles recovered 74,909 additional 1 m bed cells. TIN and raw-point
roughness rules are identical to the original processing; all previously
valid bed elevations and roughness values are unchanged. Banks are also extended at the five recovered bed tiles, within 100 m of the
corrected route, using full-source class-2 returns and the same bank algorithm.
All original supported ground values are preserved. No elevations were inferred merely to make a continuous
channel. Expanded source masks were processed for targeted clip-edge areas,
not as a new complete survey download.

Primary QGIS project: eel_mainstem_lidar_v2.qgz in qgis_full_mainstem.
Primary bed raster: eel_mainstem_bathy_v2_1m.tif; support file ends _support.tif.
Corrected geometry/sections: river_centerline_v2.gpkg.
Corrected predictors: roughness_predictors_100m_v2.csv.
Spatial assignment: eel_mainstem_interval_ids_v2_1m.tif (1-based interval ID).
The original files are retained for comparison.

Reproduction: full_mainstem/centerline_v2 contains route construction, audit,
targeted source recovery, reassignment, and independent verification scripts.
The QA atlas covers the entire route in 2 km panels. New interval counts,
roughness summaries, raster preservation, and normal-section geometries are
checked independently. Viewer raster sampling is compared against Rasterio.

Eel lidar map and profiles

Open eel_lidar_viewer.html in Chrome. The standalone HTML contains the bed and
bank GeoTIFFs, support flags, river geometry, roughness summaries and libraries.
No server or installation is required. Only basemaps require internet.

Controls
- Map zoom/pan updates the roughness plot. Hover either view to locate the same
  interval. Click a roughness point to center the map; drag a plot box to zoom.
- Radius selects 1, 2 or 5 m point-cloud neighborhoods. All radii overlays them.
  Median or 90th percentile summarizes estimates within each 100 m interval.
- Perpendicular mode snaps clicks within 150 m to the lidar-aligned mainstem where route support is adequate.
  More distant clicks preserve the current section. Draw A–B allows free
  placement, including longitudinal profiles. Drag endpoints to adjust.
- Include ground / banks adds the brown 2 m class-2 ground surface to sections.
  Blue and orange points show 1 m candidate bathymetry.
- Focus on bed and low banks zooms to ground within 30 m of the sampled bed
  edges and at most 5 m above the highest bed sample. Uncheck to see the full
  transect. Include ground / banks can be unchecked for bed-only inspection.
- CSV exports retain the whole section, including missing values and separate
  ground/bed elevation and support fields, regardless of plot zoom or toggles.
- River km increases downstream from the upstream survey edge, not the mouth.

Banks
The source is terrestrial class 2 in the existing CA14_Dietrich_B green-lidar
survey, not a newly downloaded infrared acquisition. This retains the same
survey and source GEOID12A vertical reference as the bathymetry.

Ground returns are represented by mean XYZ within 2 m bins. A linear TIN is
sampled on a 2 m grid, with triangle edges <=8 m and nearest centroid <=3 m.
A 40 m tile halo includes neighbors. The narrow domain extends 75 m from the
river guide or 30 m from class-14 return footprints. Cells containing class 9,
14 or 15 returns plus a 2 m margin are excluded from ground. This is not a
complete water polygon: classifications and gaps remain uncertain.

The bank raster is separate from the bed raster. Sections give bed precedence
where both are available and preserve gaps between sources. They do not fit a
vertical offset or fill an unsupported underwater bed with terrestrial ground.
Source classification errors can remain. Route v2 preserves every previously supported bed cell and adds measured bed
returns that the displaced original guide clip had excluded.

Scientific scope
This is provisional 2014 elevation, not water depth. Sparse returns, vegetation,
classification and channel position can affect interpretation. A cross-sectional
trough alone does not establish a longitudinal pool. Roughness is detrended
point-cloud variability, not calibrated grain size. Coverage refers to supported
bed data, not the complete wetted channel. See Methods & data in the viewer.

Local QGIS products
../full_mainstem/qgis_full_mainstem/eel_mainstem_banks_v2_2m.tif
../full_mainstem/qgis_full_mainstem/eel_mainstem_banks_v2_2m_support.tif
../full_mainstem/qgis_full_mainstem/eel_mainstem_lidar_v2.qgz
The new project includes ground and bed as separate elevation-enabled layers.

Reproduction and checks
../full_mainstem/banks/build_banks.py creates bank tiles and mosaics from
existing clipped LAZs. finish_banks.py creates overviews and runs the checks.
build_viewer.py embeds all four source TIFFs.
Numerical tests compare JavaScript samples with Rasterio, including 2 m ground,
1 m bed, support codes, gaps and raster boundaries. Independent geometry tests
check visible river intervals. Embedded files are checked by SHA-256.
See numerical_verification.json, placement_verification.json, and
../full_mainstem/banks/validation.json for measured results.

Resizable panels and map layers (October 1, 2026)
- Drag the main/side divider, map/profile divider, or bar beneath the cross section. Arrow keys adjust focused dividers; double-click resets one divider. Reset layout restores all defaults. Sizes persist in this browser.
- Map toggles independently control roughness, bed elevation, bank elevation, and each raster hillshade. Color plus hillshade produces shaded elevation; hillshade alone is gray. Opacity applies to the rasters.
- Hillshade uses metric east/north central gradients with NW (315 degree) illumination at 45 degrees, no vertical exaggeration or cast shadows. Center and four neighbors must be supported; NoData remains unshaded. Map overviews may be used.
- Connect banks to bed adds dashed straight display-only joins between adjacent supported samples from different sources, at most 30 m apart. Internal bed/ground gaps and longer gaps stay open. Raw TIFFs and exported elevations are unchanged.

Map styling and contours — October 1, 2026
Defaults: imagery, roughness, bed elevation, bed hillshade, bank hillshade and
contours on; bank elevation color and original NHD guide off; opacity 90%.
Dark blue indicates lower bed; pale aqua/sand indicates higher bed. The local
2nd–98th percentile elevation stretch limits extreme-value color compression;
endpoint colors include values beyond those percentiles. This is absolute bed
elevation, not water depth, and the colors change with the visible extent.
Bed hillshade is weaker than bank hillshade to retain tonal separation.
Contours appear with the enabled lidar surfaces at zoom 13+. Auto spacing is
10 m at zoom 13, 5 m at 14, 2 m at 15, and 1 m at 16+. Fixed 0.5–10 m spacing
can be selected. Every fifth contour is an index contour, sparsely labeled.
Marching squares uses each displayed raster separately; all four corners must
be valid, and NoData gaps and bed/bank boundaries are not bridged. Map contours
may use overview rasters. Source TIFFs, roughness values, and section samples
are unchanged. See contour_verification.json for analytic geometry tests.
