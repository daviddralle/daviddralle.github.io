# Rivendell Field Atlas

Compiled 16 September 2026. This is a historical research-site atlas with a provisional survey adjustment, not a newly validated field survey.

## Scope of reconnaissance

Only the CZO root and selected map-related folders were examined. Photos, presentations, administrative records, instrument archives, groundwater time series, and the wider research collection were not exhaustively scanned or downloaded.

The CZO root separates Maps, Infrastructure, Photos, Presentations & Posters, publication collections, administrative material, groundwater_2016-2020_edits, isotope-reading material, and a well-video collection. The most useful map sources are:

| Folder | Content and role |
| --- | --- |
| Maps/VMS Vicinity Tree and Injection Port Survey | Tree attributes and positions, injection ports, VMS platform, trail and mapped-area boundary. Multiple competing May 2019 versions. |
| Maps/Total station surve | Three local survey occupations, CSV offsets, point descriptions, an Excel source workbook, archived shapefiles in pts.zip, and a canopy raster. |
| Maps/Rivendell Wells Trees Siting/surveypoints | A combined 284-record georeferenced survey with group names. This is the comparison baseline. |
| Maps/Rivendell GIS | Surveyed well XYZ, trails, ladders, Elder Creek bed, Conger Road, site boundary, rigged trees, dataloggers and power boxes. |
| Maps/GIS | Broader reserve boundaries, basins and river networks; identified, not comprehensively ingested. |
| Maps/Rivendell, Elder Creek Watershed, Geology | Additional context and older products; identified, not comprehensively ingested. |
| rivendell_groundwater/Data | Two well-coordinate representations and an existing terrain raster, checked against the original well GIS and a fresh LiDAR cutout. |
| Separate Drive folder rivendell_total_station_mapping | 2018 reproject_pts.ipynb, README, partial raw CSV, and early projected exports. |

The archive's apparent 2020 modification dates often reflect copying rather than acquisition. Instrument status and tree status have not been updated to 2026.

## Included observations

- 13 reference wells.
- 95 trees from the explicitly dated 21 May 2019 shapefile; a separate 96-record alternate version is available for comparison.
- 100 injection ports.
- 284 total-station observations across three groups: 95 north of Well 15, 83 south of Well 15, and 106 north of Well 7. Point 81 occurs in both northern groups as a tie; it is not two different objects.
- Trails and ladders, creek, road, VMS platform and footprint, 10 rigged trees, 16 dataloggers and eight power boxes. The invented historical Rivendell boundary was removed in the 3D revision.
- Fresh 1 m 2014 NCALM bare-earth and surface raster cutouts, hillshade, canopy-height visualization and 2 m contours.

Comparison layers contain alternate representations of the same observations. Do not add their feature counts to estimate the number of unique objects.

## Coordinate choice

Reference wells use the original projected X/Y values and geometry in `Rivendell_Wells.shp`, NAD83 / UTM zone 10N (EPSG:26910). They agree with the eight-well research `rivendell_wells.gpkg` to approximately five micrometres, effectively numerical rounding.

The 13-well research `wells.gpkg` has geometry approximately 1.29 m away from the X/Y stored in its embedded HTML descriptions. The atlas consistently uses the original survey coordinates. This resolves an internal inconsistency; it does not establish their absolute geodetic accuracy. Web layers are transformed to WGS84 longitude/latitude using pyproj with explicit axis order. Geometries are exported in 2D so unresolved survey heights are not misrepresented as ellipsoidal GeoJSON Z.

## Survey registration

The notebook added a Well 15 origin `(444818.733, 4397808.873)` to local easting and northing. Its README describes an origin approximately two inches southwest of the Well 15 landmark token and anticipates future anchoring to Wells 10 and 15. The later archived combined GIS had already been translated or rotated. The reported original errors use that later combined GIS, not a reconstruction of the notebook alone.

For the two northern groups, the atlas fits a distance-preserving rigid transform by least squares using explicitly identified wells. The source distances are not stretched. A similarity transform was evaluated but not selected.

| Group | Independent well controls | Archived GIS RMSE | Rigid-fit RMSE | Leave-one-well-out RMSE |
| --- | ---: | ---: | ---: | ---: |
| Well 15 north | 3 | 7.90 m | 1.43 m | 2.56 m |
| Well 7 north | 10 | 1.58 m | 1.48 m | 1.70 m |
| Well 15 south | 1 explicit surveyed target | Not used to select a new transform | Original retained | Unavailable |

The lower survey was already relatively well placed: its small fitting improvement is not evidence of materially better absolute accuracy. The Well 15 north result is more substantial but based on only three controls. Leave-one-out errors are internal cross-validation against the existing well references, not independent GPS validation or per-object confidence radii.

The point described as 0.49 m west of Well 7 is modeled as the measured point west of the well. The Well 5 description is modeled as the well being 0.30 m north of the measured point. These interpretations should be checked against field notes. The repeat of Well 14 is not counted as another independent control. Descriptive offsets for other objects remain visible as notes rather than being silently converted to corrections. Original, raw and fitted positions remain recoverable.

The southern group has only one explicit well target. Its documented Well 15 origin could be used to construct a two-anchor solution, but that solution has no independent validation and suggests a substantial scale discrepancy. It was not applied.

## LiDAR provenance and vertical reference

Source: **Eel River Critical Zone Observatory July 2014 Lidar Survey (Angelo)**, collected by NCALM for William Dietrich, 19–27 July 2014. Funder NSF; partner ERCZO; distributed by OpenTopography; license CC BY 4.0.

[Dataset and metadata](https://portal.opentopography.org/raster?opentopoID=OTSDEM.122016.26910.2)

Public raster objects:

- `https://opentopography.s3.sdsc.edu/raster/CA14_Dietrich_A/CA14_Dietrich_A_be/Ground.tif`
- `https://opentopography.s3.sdsc.edu/raster/CA14_Dietrich_A/CA14_Dietrich_A_hh/Default.tif`

The nominal cutout covers UTM easting 444150–445500 and northing 4397300–4398500; actual pixel-aligned bounds are preserved in the GeoTIFFs. Only the required raster window was read. No full point-cloud download or paid processing job was launched.

The provider lists NAD83 (2011) / UTM zone 10N and GEOID 12A heights. Fresh terrain samples match the existing research LiDAR at all 13 wells. LiDAR is 29.13–30.76 m above the surveyed well Z values, median 30.13 m. A vertical-reference mismatch is plausible, but the well datum needs documentation. The atlas applies no vertical offset and displays both heights separately.

Canopy height is surface minus ground from the same acquisition. Negative differences are clipped to zero for visualization; the displayed palette saturates at 65 m. Invalid surface/ground cells are transparent. This is historical canopy structure, not assigned heights or positions of individual trunks. Tree positions were not snapped to canopy peaks. Two-metre contours are generated from terrain smoothed with a one-pixel Gaussian and simplified by 0.35 m for cartographic display. They retain the LiDAR height reference.

## Known data issues

- The two tree versions differ in count, tags and positions. The dated file contains tag 692; the alternate contains tags 659, 664 and 678 absent from the dated file. Neither is presumed to be a definitive merged inventory.
- The dated file has 21 missing survey IDs. Tag 655 appears on two separate records. The atlas uses stable file-and-row keys, preserving source IDs and tags separately.
- Ten dated tree records say dead; nine DBH values are flagged estimated or unverified. Blank status means status unrecorded, not alive today.
- Well 15 north point 60 contains raw relative Z = −1469 m. It is preserved and flagged, not silently changed to −14.69.
- Duplicate survey ID 81 is disambiguated by occupation.
- The original source path `rivendell_for_david_v2` is missing its `.shp` geometry. It is not used as an independent spatial source.
- The early `pts.csv` is incomplete. The complete three-group CSVs are used instead.
- The VMS platform lacks a `.prj`; its supplied `.qpj` explicitly specifies EPSG:26910 and is used.
- Historical GPS and infrastructure files are not confirmed current.

## Reuse and additions

The static website and GeoJSON layers can be hosted independently of Sites. Use the layer manifest to add further prepared datasets. New data should carry a coordinate system, acquisition date, stable record key, source citation, positional uncertainty and a clear relationship to existing identifiers.

The browser can open WGS84 GeoJSON and latitude/longitude CSV files. These additions stay in memory and disappear on reload; export visible data to retain them. Exporting comparison layers will include alternative coordinates for the same objects. The base LiDAR rasters are bundled; satellite imagery requires an external connection.

The local project includes the original downloaded source copies, checksums, Drive IDs, numerical residuals and a rebuild script. Nothing in the original CZO source folders was edited.


## Interactive 3D and metadata audit — 16 September 2026 revision

The invented Rivendell boundary has been removed from the active atlas at the user's request. Original source files remain untouched. Every visible point is picked by screen distance; overlapping observations receive a selectable list. Survey marks use saturated burnt orange with a dark outline.

All 284 total-station observations match the 283 unique IDs in `points_offsets.xlsx`, sheet `Sheet1`. ID 81 has two occupations. Workbook descriptions are authoritative for labels; ID 152 is `sap flow "another"`, which was corrupted in the CSV, and ID 97 preserves a curly apostrophe lost in the shapefile. Categories come from `id_info.csv`, which repairs ID 81's category misplaced in the workbook's responsible-person column. The audit compares every ID and is available as `metadata_label_audit.csv`. Original archived descriptions are retained as attributes. Power systems now use their source `NAME`, rather than all appearing as Solar Power System.

The 3D scene uses a 495 × 495 m cutout of the 1 m terrain and original 2014 Angelo LiDAR returns from tile `ot_444000_4397000.laz`. It uses meters in all three axes and fixes vertical exaggeration at 1. The original LAZ is preserved locally; published points are actual source returns after spatial cropping, class and height filtering, 35 cm voxel thinning and deterministic sampling to 650,000 returns. Height is interpolated against the ground DEM; class 1 means unclassified, so these are predominantly vegetation, not a vegetation classification. Ground and noise classes are excluded. Colors saturate at 65 m above ground, while valid returns through 85 m remain at their original elevations.

Field markers use surveyed horizontal locations and are draped on LiDAR terrain solely for display. Their overlaid symbols remain visible through canopy. No survey elevation datum correction or instrument mounting height is implied. Context lines are clipped to the data cutout, which is not a field boundary. All field point locations fall inside the cutout. Details and the source checksum are in `3d/scene.json`.

Source: https://portal.opentopography.org/lidarDataset?opentopoID=OTLAS.122016.26910.2 — NCALM / ERCZO / William Dietrich / NSF / OpenTopography, DOI https://doi.org/10.5069/G9MP517V, CC BY 4.0.


### Display palette revision

Ground uses neutral gray hillshade with no elevation tint. Both canopy displays use nonlinear height stops: 0 m brown (#c3a675), 2 m yellow (#c5bb76), 7 m green (#91b34e), 20 m richer green (#4d973b), and 65 m dark green (#206038). Colors saturate above 65 m; elevations and point positions are unchanged.

## Full coverage and subsurface view — 16 September 2026
- 2 m contours span the full DEM footprint. The 83 missing pixels (of 1,620,000) use nearest valid terrain only for display shading and contours. The source DEM is unchanged. 3D contours are clipped to exact mesh edges, joined across closed-ring seams, and draped 0.24 m above terrain to avoid occlusion.
- USGS NHD flowlines guide least-cost low-valley traces within a 110 m corridor on the 1 m DEM. Shared endpoints preserve junctions; tributaries join the receiving channel at their first close approach, avoiding false parallel tails. Regional water fill is a narrow cartographic ribbon: Elder 4 m, South Fork Eel 8 m, other streams 2–3 m. These are inferred channel traces, not surveyed banks, modeled floods or current wetted areas. The original creek-bed polygons remain an optional comparison layer, off by default. Filled 3D ribbons follow terrain facets, with a 0.3 m display lift to avoid flicker.
- Well construction follows Daniella M. Rempe (2016), *Controls on critical zone thickness and hydrologic dynamics at the hillslope scale*, Table 3.1, printed page 37 / PDF page 53, https://escholarship.org/uc/item/6td3h4s8. The groundwater manuscript cites this dissertation. The table was checked visually against the local dissertation PDF.
- Total depths (m): 1=9.50, 2=12.20, 3=14.40, 5=25.30, 6=19.90, 7=19.80, 10=27.40, 12=7.21, 13=18.44, 14=32.92, 15=33.22, 16=34.29. Well 11 has no depth in the table and receives no invented shaft.
- Boreholes extend vertically below LiDAR ground by documented total depth. Shaft widths are enlarged for visibility; length is true scale, with 5 m ticks. This see-through layer does not imply water level, screen intervals, present usable depth, or correction of the survey/LiDAR vertical datum difference.
