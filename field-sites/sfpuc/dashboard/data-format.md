# SFPUC monitoring data

The dashboard currently contains a historical Livermore Airport weather snapshot and empty site-monitoring panels. No Campbell connection, public upload form, or sensor ingestion is configured. Adding CSVs alone does not populate the panels: the import, validation, and charting for site observations must be implemented when the instruments and data products are defined.

## Common fields

Use `sheep-camp` or `maguire-ridge` for `site`. Use ISO 8601 timestamps with an explicit UTC offset (`-08:00` / `-07:00` as appropriate) or `Z`. Do not silently assign a timestamp to date-only field notes. Dates without times can be retained separately in the original field record until resolved. Preserve raw logger and field files separately. Empty cells mean missing, never zero. Quality codes and installation metadata must be documented before ingestion.

Tree IDs must match the atlas inventory `id` field; field tags alone are not unique across plots. Sensor IDs and access-tube IDs are to be assigned when installation metadata are available. Record the measurement value and its method, not a substituted or interpolated value.

## Templates

- `templates/tdt.csv`: one row per timestamp, sensor, and depth. Depth is cm below the soil surface. `vwc_m3_m3` is volumetric water content (a fraction, not percent); `temperature_c` is optional. The upper 100 cm is planned, but exact depths and sampling intervals are unconfirmed.
- `templates/sapflow.csv`: one row per sensor, timestamp, and output variable. Preserve `variable`, `value`, `unit`, and `calibration_id`. Do not merge sap velocity, sap flux density, and whole-tree flow. Tree assignments, calibrated output quantities, and units are not yet established.
- `templates/water-potential.csv`: `period` is `predawn` or `midday`. Record signed MPa values with tree ID and replicate; retain replicates rather than averaging on entry. Do not mix predawn and midday series. Record measurement method and tissue in supporting metadata.
- `templates/neutron.csv`: retain counts and counting durations for both field and standard measurements. If a count ratio is supplied, document its definition (typically field count rate / standard count rate), including standard measurement date in supporting metadata. `vwc_m3_m3` is optional and must have a documented `calibration_id`; counts or ratios must never be displayed as water content without calibration. Depth is cm below the documented tube reference; store reference height and tube location in installation metadata.

## Display units

Metric/imperial is a display preference shared with the atlas. Weather switches °C/°F, mm/inches, m/s/mph. Lengths and depths switch m/ft and cm/inches. Soil water content remains m³/m³ and water potential remains MPa in both modes. Sap-flow units will depend on the documented instrument output. Original source files and SI downloads are not rewritten by the toggle.

## Weather snapshot

`data/weather-source.csv` preserves the IEM response; `data/weather-daily.csv` is normalized to SI, and `data/weather.json` carries the same daily records plus provenance, coverage, source hash, and approximate distances from the site bounding-box centers. Station LVK is regional context for both sites, not on-site weather or a bias-corrected estimate.

Missing values remain null/blank. IEM trace precipitation is flagged separately and contributes zero to displayed amounts and sums; trace is not a measured zero. No gap filling. Period summaries use reported days only and state precipitation coverage. Summaries are not climate normals.

Rebuild explicitly from the repository root with:

```
python3 scripts/sfpuc/prepare_weather.py --end YYYY-MM-DD
```

There is no scheduled refresh. Review date coverage, missing values, and source provenance before publishing a new snapshot.

## Cumulative water-year comparison

The default chart selects the latest water year in the snapshot (named by its ending year), starting October 1. It compares cumulative precipitation through the same calendar month/day in earlier available years. “Full water year” shows the complete earlier curves while retaining the selected year's actual ending date. Changing chart extent does not change the through-date used for summary statistics.

A missing daily precipitation value makes that year's cumulative total unknown from that day onward. The curve stops there; sums are not resumed or treated as lower complete totals. Medians and ranges use only earlier years with no missing days from October 1 through the comparison date. This short record is not a climate normal. Percentages are omitted when the earlier-year median is zero. Trace amounts retain the source convention described above.

Curves align by month/day on a 366-position calendar. In non-leap years, February 29 carries the February 28 cumulative value solely for alignment; the comparison CSV flags that position and leaves its date blank. Leap-year precipitation is included on its actual day. No values are plotted beyond a year's available end date. The comparison CSV includes missing and trace counts and uses the selected display units.
