# Russian River Flood Atlas — step 1

Prepared 2026-09-23. Published at https://daviddralle.github.io/russian-river/.

This is an exploratory map of published flood scenarios and explicit floor-height assumptions. Property flood probabilities, seasonal probabilities, insurance payouts, and a new hydraulic simulation are not included. A separate research note gives descriptive annual discharge-exceedance counts.

## Location and building

Working location: 21008 River Boulevard, Monte Rio, APN 095-170-007. The September 25, 2018 elevation certificate confirms this address and parcel match to the initially supplied River Road address. County building OBJECTID 194640 falls inside the parcel. The building outline is from the County of Sonoma Buildings service and is displayed without geometry modification. Aerial imagery helps identify the road side, but trees obscure the actual door. The three road-side sample points are analyst-selected proxies, not surveyed entrance locations.

## Terrain and floor assumption

The 2022 bare-earth lidar samples near the road-side edge are 37.011, 37.026 and 36.335 ft NAVD88. The corresponding 2013 samples are 36.640, 35.300 and 35.610 ft. A river-side sample is 28.900 ft in 2022 and 27.960 ft in 2013. The initial map used a 37-ft road-level floor proxy. That assumption was superseded by the owner-supplied, signed finished-construction elevation certificate dated September 25, 2018.

Section C explicitly selects NAVD88 and feet: C2.a lower enclosure floor 37.2; C2.b next higher floor 45.6; C2.d garage slab 37.2; C2.e equipment 37.1 (hot water heater in lower enclosure); C2.f lowest adjacent grade 26.4; C2.g highest adjacent grade 38.0; C2.h lowest grade at deck/stairs 28.3. Diagram 6, certificate photographs and reported lower-enclosure storage use support using **C2.b = 45.6 ft NAVD88** as the living-floor reference. Current alterations/use have not been independently inspected. This use does not determine an insurance rating floor.

The viewer defaults to 45.6 ft and offers hypothetical offsets from −4 to +4 ft, with a reset to the survey. These are scenario tests, not survey uncertainty. The previous ±2-ft floor band is removed. Original PDF and personal details remain outside the public repository; only relevant survey fields are published.

Terrain datasets share NAVD88 but use different geoid realizations (2013 Geoid12A; 2022 Geoid18). Geoid, sampling, terrain-age and entrance-location differences have not been independently surveyed or corrected.

## Flood scenarios and reconstructed water elevations

The County of Sonoma publishes flood-depth rasters at every integer Guerneville gauge stage from 32 through 52 ft. Their service metadata describe HEC-RAS 5.0.1 modeling and 3-ft source cells with depths in US survey feet. These are existing county scenarios, not simulations produced for this atlas.

For display, source rasters were requested on a common 900 × 900 EPSG:3857 grid, spanning 1,100 × 1,100 projected meters (roughly 860 × 860 ground meters here). Nearest-neighbor resampling retains source values; display sampling is approximately 0.96 ground meters. This is not a claim of submeter vertical accuracy.

Approximate water elevation is reconstructed as county flood depth plus the county's 2013 bare-earth terrain, then summarized as the median across wet pixels within the building footprint. The resulting elevations range from 37.789 ft NAVD88 at 32-ft gauge stage to 50.039 ft at 52-ft stage. At 36-ft stage the reconstruction gives 40.550 ft. Spatial variation within the building footprint is checked; it is less than 1 ft in every scenario. The original hydraulic model terrain has not been obtained, so this consistency check does not prove the reconstruction matches the original modeled water-surface elevations.

The displayed difference is `reconstructed water elevation − selected floor reference`. Positive values indicate modeled water above that elevation, not observed interior flooding or damage. Negative values indicate modeled clearance. Water reconstruction and hydraulic errors remain unquantified.

A first crossing is reported only among the available integer scenarios. For the certificate-based default floor it first occurs in the 44-ft scenario (45.697 ft water versus 45.6 ft floor), with the preceding 43-ft scenario below the floor (45.085 ft). This brackets a modeled crossing only; no hydraulically validated threshold or interpolated scenario is claimed. Historical presets select the nearest available scenario (2019: 45 ft for a 45.38-ft crest; 1986: 50 ft for a 49.50-ft crest). They do not reconstruct the full historic flood or assign it a return period.

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

Current NFHL polygon queries identify AE / FLOODWAY at the parcel. Effective panel: 06097C0659F, July 31, 2024. The polygon's STATIC_BFE value is -9999 (missing), not a usable elevation. The 2018 certificate records a historical BFE of 48.0 ft NAVD88 from the December 2, 2008 panel E. It is not used as the verified BFE for current panel F. Individual LOMA/LOMR checks remain incomplete. The map shows nearby NFHL polygons as an independent regulatory overlay; this is not the same model as the county gauge-stage scenarios.

## Data attribution and reproducibility

Source agencies: County of Sonoma, QSI / NV5, FEMA, USGS / NOAA CNRFC. Agency data do not imply endorsement of this atlas. County building outlines are CC BY-ND 3.0, distributed with source geometry intact. Derived terrain/raster visualization processing is described above.

- Exact image-service endpoints and export area: [data/sources.json](data/sources.json).
- Per-stage estimates, source endpoints, sample locations, dates and assumptions: [data/config.json](data/config.json).
- County parcel and building geometry: [data/parcel.json](data/parcel.json), [data/buildings.json](data/buildings.json).
- FEMA feature subset: [data/fema.json](data/fema.json).
- Reproducible fetch and asset-building scripts plus source GeoTIFFs are retained in the local Russian Flooding research workspace. The public bundle contains only static map assets, not owner names, insurance quotes, or private records.

Validation: aligned raster grids, packed-value round trips, monotonic water elevations, within-footprint water-surface consistency, and browser checks of scenarios, floor assumptions, layers, inspection, desktop and phone layout. These verify the implementation, not the physical accuracy of the county model or the assumed floor elevation.

## Display refinement · September 23, 2026

The map-layer palette remains available alongside flood-scenario controls. Sources and assumptions are accessible through the Sources popup. Canopy/object height uses a linear 0–200 ft straw-to-green color scale (`#e8d6a3`, `#c7b977`, `#a7ba62`, `#62974c`, `#2c713f`, `#124b2e`); heights above 200 ft saturate and heights at or below 2 ft remain transparent. Numerical samples and flood scenarios are unchanged.

## Stage explorer and preload behavior

The 21 published integer-stage flood images (32–52 ft) are loaded and decoded at startup with three background workers, prioritizing stages near the opening selection. The most recent successfully displayed stage stays on the map until the selected image is decoded; the caption identifies the displayed stage while loading. A request counter prevents delayed images from replacing a newer selection. Failed images retry on selection. No stages are hydraulically interpolated.

The vertical staff gauge controls the Guerneville gauge stage. The adjacent house graphic illustrates the reconstructed water elevation relative to the assumed living floor; it is a schematic, not surveyed architecture or a measured building cross-section. The flood rasters are unchanged; the certificate update supersedes the earlier assumed floor and sensitivity band.

## Historical validation and discharge frequency · September 23, 2026

[Research note 02](research.html) documents the unresolved 2019 check, direct road-depth samples from two county service families, and an empirical annual-peak analysis. The archive contains 86 annual discharge maxima at USGS 11467000 (water years 1940–2025). The 2019 peak is 72,000 cfs in both the current annual-peak archive and approved instantaneous record; NOAA CNRFC's historical table lists an estimated 85,300 cfs. No explanation for this difference has yet been established.

Threshold counts use annual maxima >=72,000 cfs, with 11/86 years in the full record and 5/42 in 1984–2025. The latter begins after Lake Sonoma regulation started in October 1983. Exact 95% Clopper–Pearson binomial intervals assume independent years and a constant probability; climate, regulation, rating and model uncertainties are not covered. Empirical plots use rank/(n+1), whereas observed fractions use k/n. These are discharge comparisons, not living-floor flood probabilities. No fitted distribution or tail extrapolation has been applied.

Johnsons Beach (11467002) is the Guerneville stage reference; Hacienda Bridge (11467000) supplies the longer discharge record. Their gauge heights and datums are not interchangeable. Daily-maximum stage coverage was audited for water years 2008–2025; gaps preclude treating these as fully observed annual stage maxima without additional review. Missing periods are not assumed dry.

Original county depth metadata identify 2015 lidar and HEC-RAS 5.0.1. The newer Russian River–Mark West service identifies HEC-RAS 5.0.7. Direct 45-ft scenario depths at the selected road point are 8.79 and 8.47 ft, respectively. The atlas depth rasters and reconstructed water elevations remain unchanged. The floor reference has now been updated from 37.0 to 45.6 ft using the certificate. At the 45-ft gauge scenario this changes the modeled difference from 9.295 to 0.695 ft above the living-floor reference. The user now reports the owner confirms high street water; no measured depth has been supplied, and the earlier dry-living-floor recollection still requires corroboration. The model remains unvalidated locally.

The Corps PR-100 historic marks require datum and location reconciliation before numerical comparison to the atlas. A separate published 2019 model comparison uses county inundation as its reference and therefore does not independently establish county model accuracy.
