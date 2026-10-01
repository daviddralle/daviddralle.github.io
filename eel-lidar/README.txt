Eel lidar map and profiles

Open eel_lidar_viewer.html in Chrome. The standalone HTML contains the bed and
bank GeoTIFFs, support flags, river geometry, roughness summaries and libraries.
No server or installation is required. Only basemaps require internet.

Controls
- Map zoom/pan updates the roughness plot. Hover either view to locate the same
  interval. Click a roughness point to center the map; drag a plot box to zoom.
- Radius selects 1, 2 or 5 m point-cloud neighborhoods. All radii overlays them.
  Median or 90th percentile summarizes estimates within each 100 m interval.
- Perpendicular mode snaps clicks within 150 m to the mapped mainstem.
  More distant clicks preserve the current section. Draw A–B allows free
  placement, including longitudinal profiles. Drag endpoints to adjust.
- Include ground / banks adds the brown 2 m class-2 ground surface to sections.
  Blue and orange points remain the original 1 m candidate bathymetry.
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
Source classification errors can remain. The bed raster and roughness values
have not been changed.

Scientific scope
This is provisional 2014 elevation, not water depth. Sparse returns, vegetation,
classification and channel position can affect interpretation. A cross-sectional
trough alone does not establish a longitudinal pool. Roughness is detrended
point-cloud variability, not calibrated grain size. Coverage refers to supported
bed data, not the complete wetted channel. See Methods & data in the viewer.

Local QGIS products
../full_mainstem/qgis_full_mainstem/eel_mainstem_banks_2m.tif
../full_mainstem/qgis_full_mainstem/eel_mainstem_banks_2m_support.tif
../full_mainstem/qgis_full_mainstem/eel_mainstem_bathymetry_banks.qgz
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
