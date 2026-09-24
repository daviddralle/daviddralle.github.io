# Russian River Flood Atlas — step 1

Prepared 2026-09-23. Published at https://daviddralle.github.io/russian-river/.

This is an exploratory map of published flood scenarios referenced to the supplied elevation certificate. The separate insurance assessment combines fitted annual flow probabilities, a provisional hydraulic transfer and an editable binary-loss decision model. No new hydraulic simulation has been run.

## Location and building

Working location: 21008 River Boulevard, Monte Rio, APN 095-170-007. The September 25, 2018 elevation certificate confirms this address and parcel match to the initially supplied River Road address. County building OBJECTID 194640 falls inside the parcel. The building outline is from the County of Sonoma Buildings service and is displayed without geometry modification. Aerial imagery helps identify the road side, but trees obscure the actual door. The three road-side sample points are analyst-selected proxies, not surveyed entrance locations.

## Terrain and floor assumption

The 2022 bare-earth lidar samples near the road-side edge are 37.011, 37.026 and 36.335 ft NAVD88. The corresponding 2013 samples are 36.640, 35.300 and 35.610 ft. A river-side sample is 28.900 ft in 2022 and 27.960 ft in 2013. Building elevations come exclusively from the owner-supplied, signed finished-construction elevation certificate dated September 25, 2018. Lidar ground samples describe terrain and access; they are not floor estimates.

Section C explicitly selects NAVD88 and feet: C2.a lower enclosure floor 37.2; C2.b next higher floor 45.6; C2.d garage slab 37.2; C2.e equipment 37.1 (hot water heater in lower enclosure); C2.f lowest adjacent grade 26.4; C2.g highest adjacent grade 38.0; C2.h lowest grade at deck/stairs 28.3. Diagram 6, certificate photographs and reported lower-enclosure storage use support using **C2.b = 45.6 ft NAVD88** as the living-floor reference. Current alterations/use have not been independently inspected. This use does not determine an insurance rating floor.

The viewer defaults to 45.6 ft and offers hypothetical offsets from −4 to +4 ft, with a reset to the survey. These are scenario tests, not survey uncertainty. Original PDF and personal details remain outside the public repository; only relevant survey fields are published.

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

Validation: aligned raster grids, packed-value round trips, monotonic water elevations, within-footprint water-surface consistency, and browser checks of scenarios, certificate-based floor comparisons, layers, inspection, desktop and phone layout. These verify the implementation, not the physical accuracy of the county model or the current condition of the building.

## Display refinement · September 23, 2026

The map-layer palette remains available alongside flood-scenario controls. Sources and assumptions are accessible through the Sources popup. Canopy/object height uses a linear 0–200 ft straw-to-green color scale (`#e8d6a3`, `#c7b977`, `#a7ba62`, `#62974c`, `#2c713f`, `#124b2e`); heights above 200 ft saturate and heights at or below 2 ft remain transparent. Numerical samples and flood scenarios are unchanged.

## Stage explorer and preload behavior

The 21 published integer-stage flood images (32–52 ft) are loaded and decoded at startup with three background workers, prioritizing stages near the opening selection. The most recent successfully displayed stage stays on the map until the selected image is decoded; the caption identifies the displayed stage while loading. A request counter prevents delayed images from replacing a newer selection. Failed images retry on selection. No stages are hydraulically interpolated.

The vertical staff gauge controls the Guerneville gauge stage. The adjacent house graphic illustrates the reconstructed water elevation relative to the certificate-based living-floor reference; it is a schematic, not surveyed architecture or a measured building cross-section. The house geometry is schematic; its floor reference is the certificate’s 45.6 ft NAVD88.

## Historical validation and discharge frequency · September 23, 2026

[Research note 02](research.html) documents the unresolved 2019 check, direct road-depth samples from two county service families, and an empirical annual-peak analysis. The archive contains 86 annual discharge maxima at USGS 11467000 (water years 1940–2025). The 2019 peak is 72,000 cfs in both the current annual-peak archive and approved instantaneous record; NOAA CNRFC's historical table lists an estimated 85,300 cfs. No explanation for this difference has yet been established.

Threshold counts use annual maxima >=72,000 cfs, with 11/86 years in the full record and 5/42 in 1984–2025. The latter begins after Lake Sonoma regulation started in October 1983. Exact 95% Clopper–Pearson binomial intervals assume independent years and a constant probability; climate, regulation, rating and model uncertainties are not covered. Empirical plots use rank/(n+1), whereas observed fractions use k/n. These are discharge comparisons, not living-floor flood probabilities. No fitted distribution or tail extrapolation has been applied.

Johnsons Beach (11467002) is the Guerneville stage reference; Hacienda Bridge (11467000) supplies the longer discharge record. Their gauge heights and datums are not interchangeable. Daily-maximum stage coverage was audited for water years 2008–2025; gaps preclude treating these as fully observed annual stage maxima without additional review. Missing periods are not assumed dry.

Original county depth metadata identify 2015 lidar and HEC-RAS 5.0.1. The newer Russian River–Mark West service identifies HEC-RAS 5.0.7. Direct 45-ft scenario depths at the selected road point are 8.79 and 8.47 ft, respectively. The atlas depth rasters and reconstructed water elevations remain unchanged. The floor reference is 45.6 ft NAVD88 from the certificate. At the 45-ft gauge scenario, modeled water is 0.695 ft above this reference. The user now reports the owner confirms high street water; no measured depth has been supplied, and the earlier dry-living-floor recollection still requires corroboration. The model remains unvalidated locally.

The Corps PR-100 historic marks require datum and location reconciliation before numerical comparison to the atlas. A separate published 2019 model comparison uses county inundation as its reference and therefore does not independently establish county model accuracy.

## Fitted frequency and binary insurance assessment · September 24, 2026

[Insurance assessment](insurance.html) replaces the five illustrative scenario weights with fitted annual-maximum probabilities. Its objective is minimum expected annual dollar cost, conditional on the selected record, distribution, hydraulic transfer and user-entered loss. It is not a verified actuarial property assessment.

### Statistical model

The default is a generalized extreme-value (GEV) distribution fitted by L-moments to Hacienda Bridge USGS11467000 annual peak discharge, water years1984–2025 (42 years). Lake Sonoma regulation began in October1983. Full-record1940–2025 (86 years), El Niño and other-winter subsets are available. The full record mixes reservoir regimes; none of the flows are naturalized. A Gumbel distribution fitted by L-moments supplies a simpler comparison. Both are supported in USACE distribution-fitting practice: [HEC-SSP parameter estimation](https://www.hec.usace.army.mil/confluence/sspdocs/sspum/2.3/distribution-fitting-analysis/distribution-fitting-and-parameter-estimation).

This is not a Bulletin17C analysis. A preliminary LP3 fit with raw at-site log moments produced finite upper bounds below observed peaks in five of six groups. It is excluded from the decision controls and retained only as diagnostics. EMA, regional skew weighting, low-outlier treatment and historical censoring are not implemented. No uniquely best family is claimed.

NOAA ERSSTv6 RONI qualified warm-episode DJF labels identify El Niño winters by ending water year; a single-season index threshold is not substituted for the episode label. Pre-1950 years lack classifications and are excluded from seasonal subsets. Modern El Niño/other groups contain14/28 winters; full classified groups contain27/49. Conditioning on El Niño is a historical comparison, not a forecast or evidence of causation.

The shaded band and threshold-probability interval are pointwise95% nonparametric bootstrap intervals using2,000 independent-year resamples, seed24092026. They omit hydraulic-transfer, climate, operations and distribution-family uncertainty. Empirical plot positions use rank/(n+1); observed exceedance fractions use k/n. Exact binomial intervals are in Methods. The data are positive annual peaks with reviewed qualifiers, not independent high-flow events in a partial-duration series.

### Working house-flood threshold

The living floor remains45.6ft NAVD88 from certificate C2.b. Interpolating atlas reconstructed WSE between43ft (45.085ft NAVD88) and44ft (45.697ft NAVD88) gives a Guerneville/Johnsons Beach gage threshold of43.8415ft. This is a model threshold, not an observed interior-flood stage. County original terrain is2015; atlas reconstruction uses2013 terrain.

Paired simultaneous USGS observations in February2019 give Hacienda discharge69,197cfs on the rising crossing and66,054cfs on the falling crossing of that stage. Linear interpolation in time gives the crossings; their mean67,625cfs is the working discharge threshold. This single-event transfer assumes other annual peak hydrographs reach the same local stage at comparable Hacienda flow. It is not an official rating curve, county flow profile, or independently validated mapping. Hydrograph travel time, hysteresis, backwater and channel change are unresolved. The endpoints are sensitivity scenarios, not confidence bounds.

The earlier owner recollection of a dry living floor in2019 remains unresolved; confirmation of high street water does not establish interior inundation. The certificate fixes the building reference but does not validate modeled water elevation. CNRFC's estimated2019 discharge differs from USGS's72,000cfs; this analysis consistently uses USGS values.

Default modern GEV threshold probability is11.40%; modern El Niño11.29%; full-record18.46%. Modern observed threshold exceedances are5/42; full-record18/86. These counts use the new67,625-cfs threshold, not the older research note's72,000-cfs event threshold. Hydraulics remain provisional, so these are conditional modeled house-flood probabilities.

### Binary decision model

Editable inputs: building coverage limit(default$250,000), deductible(default$10,000), annual premium(blank until entered), and fixed covered damage per house flood(default$100,000). All four are unverified assumptions. Damage is zero at or below the living floor, including under-house water. The above-floor damage input is a fixed binary scenario, not a calibrated depth–damage curve. If interpreted as the mean of variable losses, payout at the mean need not equal expected payout through nonlinear deductible/limit terms.

For probability p and damage D:

- Payout B = min(limit, max(0, D − deductible)).
- Expected annual cost without insurance = pD.
- Expected annual cost with insurance = premium + p(D − B).
- Break-even annual premium = pB.

A premium below pB minimizes expected dollars by buying; a higher premium minimizes expected dollars by retaining risk. Risk aversion, liquidity, policy exclusions, contents, taxes, financing, inflation and repeated floods in one year are excluded. This is a decision objective, not a claim that risk-neutral preferences fit every homeowner. The default payout is$90,000 and break-even premium is approximately$10,261/year.

The10-year probability assumes independent stationary years. Normally it is1−(1−p)^10. With El Niño selected it is1−(1−p_EN)(1−p_all)^9: only the first year is conditioned, rather than assuming ten consecutive El Niño years.

### Reproduction and presentation

Run `python analysis/fit_frequency.py` with NumPy and SciPy. Public inputs are `data/research/flood_enso_history.json`, `2019_stage_flow.csv`, and `data/config.json`. Output `flood_frequency.json` records fits, bands, bootstrap seed, crossings, parameters, LP3 rejection diagnostics and SHA256 input hashes. Tests recover known GEV/Gumbel parameters, check support against observed peaks, verify subset membership, monotonic probabilities and threshold sensitivity. `decision-model.js` tests cover payout caps, deductible boundaries, missing versus zero premium, loss conservation and expected-cost decisions.

The page is a single-screen desktop dashboard, with distribution/history plot selection, editable policy inputs, annual-cost comparison and a short conclusion. Scientific details reside in a tabbed Model & methods dialog. Inputs save only in localStorage under binary schema2 and can be exported as JSON. Earlier schema1 placeholder probabilities and depth–damage curves are not imported or used. `insurance-model.js` is retained only as legacy code; the assessment loads `decision-model.js`.

The atlas is unchanged: gage height controls flooding, certificate floor elevations stay fixed, and no damage below the living floor is added. Desktop layout checks include1024×640; phone layouts stack vertically.

Matching Flood atlas / Insurance assessment navigation tabs highlight the current page on desktop and phone. The atlas passes the selected integer stage to the assessment; its return tab restores that stage. Insurance inputs are independent of the exploratory atlas stage.
