#!/usr/bin/env python3
"""Build an archived Soap/Newt dashboard bundle; never infer live observations.

Requires pandas. Run with --source-root pointing to Soaproot_Providence.
No source files are changed. No credentials or notebooks are copied to the site.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import pandas as pd


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'field-sites/soap-newt/dashboard/data')
    args = parser.parse_args()
    root, output = args.source_root, args.output
    output.mkdir(parents=True, exist_ok=True)
    sources = []
    series = []

    def source(id, relative_path, evidence, url=None):
        path = root / relative_path
        entry = dict(id=id, path=relative_path, bytes=path.stat().st_size,
                     sha256=hashlib.sha256(path.read_bytes()).hexdigest(), evidence=evidence,
                     url=url or 'https://drive.google.com/drive/folders/1XtmkLkwwnV5HvQPLwBgtGQGCUHyepN2b')
        sources.append(entry)
        return path

    def add(id, label, site, category, unit, source_id, data, aggregation, notes, *, time_basis='Fixed PST (UTC−08:00), year-round; confirmed by site operator', flags=None):
        data = pd.to_numeric(data, errors='coerce').sort_index()
        if data.index.has_duplicates:
            raise ValueError(f'Duplicate dates in {id}; do not silently merge')
        valid = data.dropna()
        if valid.empty:
            return
        # Retain internal missing days, omit empty margins. Nulls break plot lines.
        data = data.loc[valid.index[0]:valid.index[-1]]
        values = [[t.isoformat()[:10] if aggregation != 'discrete measurement' else t.isoformat(), None if pd.isna(v) else round(float(v), 7)] for t, v in data.items()]
        obj = dict(id=id, label=label, site=site, category=category, unit=unit,
                   source_id=source_id, aggregation=aggregation, time_basis=time_basis,
                   notes=notes, start=values[0][0], end=values[-1][0], count=int(data.count()),
                   missing_count=int(data.isna().sum()), values=values)
        if flags is not None:
            obj['flags'] = [None if pd.isna(v) else int(v) for v in flags.reindex(data.index)]
        series.append(obj)

    gw_path = source('groundwater_daily', 'Groundwater/Processed data/levels_corrected_depths_daily.csv',
                     'Groundwater/Soap Prov Step 2: Process and correct transducer data.ipynb: sensor depth and stickup in cm; pressure correction kPa × 10.1972; daily median. One NC plot labels metres, but no conversion occurs in the calculation. This export converts the computed centimetres to metres.')
    gw = pd.read_csv(gw_path, index_col=0, parse_dates=True)
    assert not gw.index.has_duplicates
    for col in gw.columns:
        if re.fullmatch(r'(SR\d+|NC\d+(?:old)?)_DEPTH_TO_WATER', col):
            well = col.split('_')[0]
            add(col.lower(), well, 'Soap' if well.startswith('SR') else 'Newt', 'Groundwater', 'm below ground', 'groundwater_daily', gw[col] / 100,
                'daily median', ['Archived processed values; cm converted to m.', 'Positive values are below ground; negative values are retained.', 'No additional calibration, sensor-dryness screening, or outlier removal applied.', 'Old sensor records remain separate.'])
    for col, site in [('SRSGAGE_BAROMETRIC_SUBTRACTED', 'Soap'), ('NEWTGAGE_BAROMETRIC_SUBTRACTED', 'Newt')]:
        add(col.lower(), f'{site} gage', site, 'Gage pressure head', 'cm water', 'groundwater_daily', gw[col],
            'daily median', ['Barometrically corrected transducer pressure head above sensor, in source cm units.', 'Sensor datum is not verified; these values are not discharge or a surveyed water-surface elevation.', 'No additional dry-sensor or outlier screening applied.'])

    qpath = source('dilution_discharge', 'Discharge/Dilution/dilution_Q_bhr.csv',
                   'Discharge/Dilution/SRS_process_dilution_calc_Q.ipynb explicitly converts L/s to m³/s; source column Q (cms). Source flag is retained; nonzero-flag observations are excluded from default values.')
    q = pd.read_csv(qpath)
    q['datetime'] = pd.to_datetime(q['datetime'])
    q['processing_flag'] = q['flag']
    bad_time = (q.station == 'NC') & (q.datetime.dt.date == pd.Timestamp('2026-05-19').date())
    q.loc[bad_time, 'processing_flag'] = 2
    q['exclusion_reason'] = ''
    q.loc[bad_time, 'exclusion_reason'] = 'EC timestamps advance one day per row; actual sampling interval unresolved.'
    for code, site in [('SRS','Soap'),('NC','Newt')]:
        part = q[q.station == code].sort_values('datetime').set_index('datetime')
        add(f'{code.lower()}_discharge', f'{site} dilution measurements', site, 'Discharge', 'm³/s', 'dilution_discharge', part['Q (cms)'].where(part.processing_flag == 0),
            'discrete measurement', ['Individual salt-dilution measurements; do not join as continuous streamflow.', 'Only processing flag=0 is plotted; original source flags and all discharge values are retained in discharge_observations.csv.', 'No rating curve applied in this discrete series. Processing flag 2 excludes Newt 2026-05-19 because the EC timestamps increment by days; source flags and raw discharge are preserved in the CSV.'], flags=part.processing_flag)
    q[['station','datetime','Q (cms)','flag','processing_flag','exclusion_reason']].to_csv(output / 'discharge_observations.csv', index=False)

    metpath = source('neon_hourly_archive', 'Meteorology/SOAP_ppt_baro_hourly.csv',
                     'Meteorology/BHR neon_soap.ipynb: NEON DP1.00045.001 tipping bucket, DP1.00046.001 throughfall, DP1.00004.001 pressure. Hourly sums; timestamps shifted from UTC by 8 h. Upstream sum() can replace missing data with zero, and pressure is interpolated.',
                     'https://data.neonscience.org/data-products/DP1.00045.001')
    met = pd.read_csv(metpath, index_col=0, parse_dates=True)
    if met.index.has_duplicates:
        # The archive starts with complementary pressure/rain rows at one hour.
        # Combine only if no column has conflicting non-null observations.
        if (met.groupby(level=0).nunique(dropna=True) > 1).any().any():
            raise ValueError('Conflicting duplicate hours in archived met source')
        met = met.groupby(level=0).first()
        sources[-1]['duplicate_handling'] = 'Complementary duplicate hour coalesced after checking for conflicting non-null values.'
    for value, flag, label in [('ppt_mm', 'ppt_mm_flag', 'SOAP tipping-bucket precipitation'), ('throughfall_mm', 'throughfall_mm_flag', 'SOAP throughfall')]:
        acceptable = met[value].notna() & (met[flag] == 0)
        daily = met[value].where(acceptable).resample('D').sum(min_count=24)
        add(value, label, 'NEON SOAP', 'Precipitation', 'mm/day', 'neon_hourly_archive', daily, 'daily sum of 24 unflagged archived hours',
            ['Archive only; not current rainfall.', 'Days with fewer than 24 unflagged archived hours are missing.', 'Upstream hourly resampling may have zero-filled missing subhourly data; daily completeness cannot be certified.', 'Do not use this archive for water-balance totals without checking the original NEON data.'], time_basis='Fixed UTC−08:00 (PST) as stored upstream; not daylight-saving local time')
    daily = met.baro_kpa.resample('D').mean().where(met.baro_kpa.resample('D').count() == 24)
    add('baro_kpa', 'SOAP atmospheric pressure', 'NEON SOAP', 'Atmospheric pressure', 'kPa', 'neon_hourly_archive', daily, 'daily mean of 24 archived hours',
        ['Upstream archive interpolates pressure gaps; interpolated observations cannot be separated here.', 'Partial days are missing.'], time_basis='Fixed UTC−08:00 (PST) as stored upstream')

    result = dict(schema_version=1, built_at=datetime.now(timezone.utc).isoformat(), status='archived snapshot',
                  source_root_label='Soaproot_Providence shared research archive',
                  notes=['These are archived research data, not live telemetry.', 'Per-series dates describe observations, not the build date.', 'Gaps are retained in this archive bundle. Separate provisional gage runoff applies documented rating curves.', 'Processed source data have not been independently recalibrated.'],
                  sources=sources, series=series,
                  excluded=[
                      dict(path='Meteorology/ET/NEON_SOAP_ET_fromNorth.csv and NEON_SOAP_ET_fromSouth.csv', reason='Wind-sector subsets contain a flux column without units or aligned quality flags in the CSV; not treated as watershed evapotranspiration.'),
                      dict(path='Meteorology/ET/OpenET_*_2026.csv and PML_*_2026.csv', reason='Export metadata and units require verification before comparison with tower fluxes.'),
                      dict(path='Meteorology/pet_airtemp_soapnewt.csv', reason='CSV does not establish units and processing provenance; not presented as NEON tower observations.'),
                      dict(path='Soil moisture/soap_sm.csv', reason='Raw sensor channels include negative water-content values and lack verified channel-to-depth metadata in this build.'),
                      dict(path='Groundwater/Processed data/*', reason='Providence records and gage DEPTH_TO_WATER pseudo-well columns excluded from Soap/Newt groundwater charts.')])
    (output/'series.json').write_text(json.dumps(result, separators=(',',':'), allow_nan=False))
    print(json.dumps({"series":len(series),"observations":sum(s['count'] for s in series),"categories":sorted(set(s['category'] for s in series)),"latest":max(s['end'] for s in series)},indent=2))


if __name__ == '__main__':
    main()
