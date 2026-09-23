# Russian River Flood Atlas — step 1

Prepared 2026-09-23. Published at https://daviddralle.github.io/russian-river/.

This is an exploratory map of published flood scenarios and explicit floor-height assumptions. Annual probabilities, seasonal probabilities, insurance payouts, and a new hydraulic simulation are not included in this release.

## Location and building

Working location: 21008 River Boulevard, Monte Rio, APN 095-170-007. The user tentatively confirmed this match to an initially supplied River Road address. County building OBJECTID 194640 falls inside the parcel. The building outline is from the County of Sonoma Buildings service and is displayed without geometry modification. Aerial imagery helps identify the road side, but trees obscure the actual door. The three road-side sample points are analyst-selected proxies, not surveyed entrance locations.

## Terrain and floor assumption

The 2022 bare-earth lidar samples near the road-side edge are 37.011, 37.026 and 36.335 ft NAVD88. The corresponding 2013 samples are 36.640, 35.300 and 35.610 ft. A river-side sample is 28.900 ft in 2022 and 27.960 ft in 2013. The map starts with a rounded **37 ft NAVD88** living-floor scenario and lets the user add 0–12 ft for steps or an elevated floor.

The ±2 ft floor sensitivity band is an analyst-selected exploratory range. It is not a confidence interval, survey accuracy statement, or bound on actual floor elevation. Actual floor height may fall outside it. Ground beneath an elevated building is not its floor. Under-house space is assumed to contain outdoor gear/storage, based on the user's description; this has not been independently inspected.

Terrain datasets share NAVD88 but use different geoid realizations (2013 Geoid12A; 2022 Geoid18). Geoid, sampling, terrain-age and entrance-location differences have not been independently surveyed or corrected.

## Flood scenarios and reconstructed water elevations

The County of Sonoma publishes flood-depth rasters at every integer Guerneville gauge stage from 32 through 52 ft. Their service metadata describe HEC-RAS 5.0.1 modeling and 3-ft source cells with depths in US survey feet. These are existing county scenarios, not simulations produced for this atlas.

For display, source rasters were requested on a common 900 × 900 EPSG:3857 grid, spanning 1,100 × 1,100 projected meters (roughly 860 × 860 ground meters here). Nearest-neighbor resampling retains source values; display sampling is approximately 0.96 ground meters. This is not a claim of submeter vertical accuracy.

Approximate water elevation is reconstructed as county flood depth plus the county's 2013 bare-earth terrain, then summarized as the median across wet pixels within the building footprint. The resulting elevations range from 37.789 ft NAVD88 at 32-ft gauge stage to 50.039 ft at 52-ft stage. At 36-ft stage the reconstruction gives 40.550 ft. Spatial variation within the building footprint is checked; it is less than 1 ft in every scenario. The original hydraulic model terrain has not been obtained, so this consistency check does not prove the reconstruction matches the original modeled water-surface elevations.

Water above the assumed floor is `reconstructed water elevation − assumed floor elevation`. Positive values are hypothetical interior-depth estimates under the stated floor assumption, not observed damage. Negative values indicate vertical clearance in that scenario. The ±2 ft band tests floor height only; it does not quantify hydraulic-model uncertainty.

A first crossing is reported only among the available integer scenarios. For the default floor it occurs at or below the first available 32-ft scenario. Lower stages are unavailable; no lower-stage interpolation or extrapolation is performed. Historical presets select the nearest available scenario (2019: 45 ft for a 45.38-ft crest; 1986: 50 ft for a 49.50-ft crest). They do not reconstruct the full historic flood or assign it a return period.

Zero/transparent flood cells are reported as **no mapped inundation / no data**, not certain dry conditions. The permanent river channel remains colored because the data represent water depth above terrain.

## Lidar and basemap layers

- Continuous satellite: Esri World Imagery.
- Continuous streets: OpenStreetMap.
- Continuous topo: Esri World Topographic Map.
- Detailed aerial square: County 2025 EagleView imagery, exported at 3,500 × 3,500 pixels, about 0.25 ground meters per displayed pixel.
- Hillshade: County 2022 bare-earth hillshade.
- Ground elevation: County 2022 DEM with hillshade, styled over 0–650 ft NAVD88.
- Canopy / object height: County `Lidar_Vegetation_Height_2022` raster, displayed over 0–200+ ft; heights below 2 ft are transparent. It may include buildings or other above-ground objects. The service description repeats a generic DSM description, so it should not be interpreted as a verified tree-only classification.
- Contours: 10-ft contours derived from the resampled 2022 DEM, simplified for display. Not survey contours.

An independent units check found that the county's separate highest-hit DSM exports numerical values in meters, despite its horizontal coordinates being in US survey feet. Converting that DSM to feet and subtracting the DEM produces a height field closely correlated with the direct vegetation-height raster (r ≈ 0.996; median signed difference ≈ 0.007 ft on this crop). The atlas uses the direct county vegetation-height raster, avoiding subtraction of layers with different numerical units or grids. The separate DSM is not published as a map layer.

Packed sample PNGs encode `round(value_in_feet × 100)` as `R × 256 + G`; blue is 255 and alpha indicates valid values. This is storage precision, not measurement accuracy. All display colors are separate from these numerical rasters.

## FEMA mapping

Current NFHL polygon queries identify AE / FLOODWAY at the parcel. Effective panel: 06097C0659F, July 31, 2024. The polygon's STATIC_BFE value is -9999 (missing), not a usable elevation. No site BFE is assigned. Individual LOMA/LOMR checks remain incomplete. The map shows nearby NFHL polygons as an independent regulatory overlay; this is not the same model as the county gauge-stage scenarios.

## Data attribution and reproducibility

Source agencies: County of Sonoma, QSI / NV5, FEMA, USGS / NOAA CNRFC. Agency data do not imply endorsement of this atlas. County building outlines are CC BY-ND 3.0, distributed with source geometry intact. Derived terrain/raster visualization processing is described above.

- Exact image-service endpoints and export area: [data/sources.json](data/sources.json).
- Per-stage estimates, source endpoints, sample locations, dates and assumptions: [data/config.json](data/config.json).
- County parcel and building geometry: [data/parcel.json](data/parcel.json), [data/buildings.json](data/buildings.json).
- FEMA feature subset: [data/fema.json](data/fema.json).
- Reproducible fetch and asset-building scripts plus source GeoTIFFs are retained in the local Russian Flooding research workspace. The public bundle contains only static map assets, not owner names, insurance quotes, or private records.

Validation: aligned raster grids, packed-value round trips, monotonic water elevations, within-footprint water-surface consistency, and browser checks of scenarios, floor assumptions, layers, inspection, desktop and phone layout. These verify the implementation, not the physical accuracy of the county model or the assumed floor elevation.
