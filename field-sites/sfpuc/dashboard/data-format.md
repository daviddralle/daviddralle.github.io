# SFPUC monitoring data

The dashboard displays received Sheep Camp logger observations and a separate historical regional-weather snapshot. Sensor outputs are provisional. Station coordinates, sensor installations, tree assignments and logger clock convention remain pending in `data/stations.json`.

## Pi processing and publication

All scheduled work runs on `pi5`. The receiver is `/home/daviddralle/sfpuc/server/data/cr350`. `scripts/sfpuc/run_telemetry.sh` runs every ten minutes, takes the same lock as the other website publishers, pulls the website repository, runs ingestion, and commits/pushes changed telemetry products. The dashboard does not require the Mac to be awake.

`ingest_telemetry.py` snapshots completed recognized TOA5 files into `/home/daviddralle/sfpuc/dashboard-archive/raw/`, keyed by SHA-256 and original filename. Receiver filename reuse does not discard earlier versions. The private archive is retained; generated monthly JSON products retain all parsed records, while `telemetry.json` serves the latest 31 days of logger time. Repeated identical records are removed. Changed schemas, empty files and malformed rows are excluded with reasons. This local archive is not an off-device backup.

The public products contain sensor values and provenance, never logger source programs or receiver credentials. Upload arrival is UTC; logger timestamps remain exactly as received. Chart coordinates do not assert a time zone. Bottom relay timestamps and soil values require verification, so all Bottom series are withheld from plots. Reported battery values remain visible for diagnosis. Missing/nonfinite values and the -8190 sentinel become null; original strings and flags remain in downloads. Zeros and negative sap values are retained. Broad physical review bounds are not instrument calibration or a complete quality-control procedure.

On the Pi, run the job manually with:

```sh
bash /home/daviddralle/daviddralle.github.io/scripts/sfpuc/run_telemetry.sh
```

Logs: `/home/daviddralle/logs/sfpuc/telemetry.log`. Cron is in the `daviddralle` user's crontab. The shared lock is `/home/daviddralle/.local/state/hydroeco-automation.lock`.

## Field notebook

`field-notes.html` holds browser-local draft transcriptions and exports version-1 JSON. Drafts are not uploaded automatically; export them before clearing browser storage. Preserve original photographs/scans under the Drive project's existing `Field data/Field measurements and notes/` folder, with filenames matching each note's source reference. Date-only notes remain date-only. Do not infer coordinates, depths, species, calibration or illegible text.

Copy exported JSON to the Pi for validation:

```sh
python3 scripts/sfpuc/import_field_notes.py /path/to/field-notes.json
```

Review the transcription and suitability for public display against the originals. Only then run the same command with `--approve`; it merges records into `data/field-notes.json`. Publish reviewed notes from the Pi repository using the shared publisher lock and an explicit commit/push. Conflicting IDs are rejected; retain the original and assign a new ID for corrections. No handwritten records have been transcribed yet.

## Common fields

Use `sheep-camp` or `maguire-ridge` for `site`. For new records with a known time convention, use ISO 8601 timestamps with an explicit UTC offset or `Z`. Existing logger timestamps retain their unconfirmed clock convention; do not attach an offset by assumption. Do not silently assign a timestamp to date-only field notes. Dates without times can be retained separately in the original field record until resolved. Preserve raw logger and field files separately. Empty cells mean missing, never zero. Quality codes and installation metadata must be documented before ingestion.

Tree IDs must match the atlas inventory `id` field; field tags alone are not unique across plots. Sensor IDs and access-tube IDs are to be assigned when installation metadata are available. Record the measurement value and its method, not a substituted or interpolated value.

## Templates

- `templates/tdt.csv`: one row per timestamp, sensor, and depth. Depth is cm below the soil surface. `vwc_m3_m3` is volumetric water content (a fraction, not percent); `temperature_c` is optional. The upper 100 cm is planned, but exact depths and sampling intervals are unconfirmed.
- `templates/sapflow.csv`: one row per sensor, timestamp, and output variable. Preserve `variable`, `value`, `unit`, and `calibration_id`. Do not merge sap velocity, sap flux density, and whole-tree flow. Tree assignments, calibrated output quantities, and units are not yet established.
- `templates/water-potential.csv`: `period` is `predawn` or `midday`. Record signed MPa values with tree ID and replicate; retain replicates rather than averaging on entry. Do not mix predawn and midday series. Record measurement method and tissue in supporting metadata.
- `templates/neutron.csv`: retain counts and counting durations for both field and standard measurements. If a count ratio is supplied, document its definition (typically field count rate / standard count rate), including standard measurement date in supporting metadata. `vwc_m3_m3` is optional and must have a documented `calibration_id`; counts or ratios must never be displayed as water content without calibration. Depth is cm below the documented tube reference; store reference height and tube location in installation metadata.

## Display units

Metric/imperial is a display preference shared with the atlas. Weather switches °C/°F, mm/inches, m/s/mph. Lengths and depths switch m/ft and cm/inches. Soil water content remains m³/m³ and water potential remains MPa in both modes. Sap-flow units will depend on the documented instrument output. Original source files are not rewritten by the toggle. Telemetry CSV downloads include both native values/units and selected display values/units.

## Weather snapshot

`data/weather-source.csv` preserves the IEM response; `data/weather-daily.csv` is normalized to SI, and `data/weather.json` carries the same daily records plus provenance, coverage, source hash, and approximate distances from the site bounding-box centers. Station LVK is regional context for both sites, not on-site weather or a bias-corrected estimate.

Missing values remain null/blank. IEM trace precipitation is flagged separately and contributes zero to displayed amounts and sums; trace is not a measured zero. No gap filling. Period summaries use reported days only and state precipitation coverage. Summaries are not climate normals.

Rebuild explicitly from the repository root with:

```
python3 scripts/sfpuc/prepare_weather.py --end YYYY-MM-DD
```

This historical airport snapshot has no scheduled refresh; telemetry refresh is separate. Review date coverage, missing values, and source provenance before publishing a new snapshot.

## Cumulative water-year comparison

The default chart selects the latest water year in the snapshot (named by its ending year), starting October 1. It compares cumulative precipitation through the same calendar month/day in earlier available years. “Full water year” shows the complete earlier curves while retaining the selected year's actual ending date. Changing chart extent does not change the through-date used for summary statistics.

A missing daily precipitation value makes that year's cumulative total unknown from that day onward. The curve stops there; sums are not resumed or treated as lower complete totals. Medians and ranges use only earlier years with no missing days from October 1 through the comparison date. This short record is not a climate normal. Percentages are omitted when the earlier-year median is zero. Trace amounts retain the source convention described above.

Curves align by month/day on a 366-position calendar. In non-leap years, February 29 carries the February 28 cumulative value solely for alignment; the comparison CSV flags that position and leaves its date blank. Leap-year precipitation is included on its actual day. No values are plotted beyond a year's available end date. The comparison CSV includes missing and trace counts and uses the selected display units.
