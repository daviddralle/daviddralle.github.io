Eel lidar map and profiles

Open eel_lidar_viewer.html in Chrome. The single 65 MB HTML file contains the
original bathymetry and support TIFFs, river geometry, roughness summaries,
and JavaScript dependencies. No server or installation is required.
Only basemap tiles require internet. Choose None for offline work.

Controls
- Pan/zoom the map: the roughness profile follows visible river intervals.
- Hover either profile/map to locate the corresponding interval. Click a
  roughness point to center the map. Drag a box in the roughness plot to zoom
  the map to that chainage range. Orange shading marks the selected interval.
- Radius selects the 1, 2, or 5 m point-cloud roughness neighborhood. All radii
  overlays the three profiles. Statistic selects median or 90th percentile
  among roughness estimates within each 100 m interval.
- Click within 150 m of the mainstem for a perpendicular bed section centered
  on the mapped river line. More distant clicks leave the section unchanged. Use Draw A–B for a custom
  section, including along-channel bed profiles. Drag endpoints to adjust.
  Width and rotation apply to perpendicular sections; after manually moving
  endpoints, click the channel again in Perpendicular mode to re-enable them.
- Section samples use the original 1 m TIFF, even when the map uses an overview.
  Fit plot to supported bed crops the plotted distance range; CSV retains the
  full transect and missing values. Blue = cell with a source point;
  orange = interpolated cell. Missing cells remain gaps.
- CSV buttons export the selected section or all intervals in the map view.
- Angelo and River km provide direct navigation. Chainage increases downstream
  from the upstream survey edge, not upstream from the river mouth.

Scientific scope
The route spans South Fork Eel and the lower Eel to the mouth (214.1 km).
Bed elevation is a provisional class-14-derived surface, not water depth.
Classification, channel alignment, vegetation, interpolation, depth-dependent
sampling and missing returns can affect interpretation. A cross-sectional
trough alone does not establish that a site is a longitudinal pool.
Roughness is detrended point-cloud elevation variability, not calibrated grain
size. Summaries and coverage apply to supported bed data, not the full wetted
channel. Methods & data in the viewer provides details and provenance.

Verification
- Standalone file opened directly in Chrome and read embedded TIFFs.
- 2,764 numerical section samples across nine sections matched Rasterio
  elevations and support flags exactly, including missing and boundary cells.
- 21 visible-interval selections matched independent Shapely intersections.
- Embedded TIFF bytes matched source SHA-256 hashes.
- Map zoom/profile linking, plot drag/map zoom, custom A–B sections,
  imagery/topography switching, and all-radii display checked in the UI.
- Chrome-exported CSV (201 rows) matched the source TIFF exactly.

Rebuild with the lab Python environment:
  python viewer/build_viewer.py
Source: template.html, app.js, build_viewer.py, vendor/.
Numerical verification: test_numerics.cjs, verify_numerics.py.
