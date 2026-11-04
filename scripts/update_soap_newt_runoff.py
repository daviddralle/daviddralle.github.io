#!/usr/bin/env python3
"""Cache NEON BIGC discharge and publish daily catchment-normalized runoff.

Run daily on the Raspberry Pi. Credentials/raw CSVs remain outside the website;
reuse the meteorology client's HTTPS host checks and checksum verification.
Released monthly summaries are reused until their release changes. Provisional
months are checked for revised filenames/checksums on every run.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError

from update_soap_newt_observations import Client, atomic_json, finite, parse_time, utc_now

PRODUCT = 'DP4.00130.001'
SITE = 'BIGC'
AREA_KM2 = 10.9
MIN_COVERAGE = 0.90
TABLES = {'csd_15_min': ('dischargeContinuous', 900),
          'csd_continuousDischarge': ('maxpostDischarge', 60)}
AREA_URL = 'https://www.neonscience.org/field-sites/bigc'
PRODUCT_URL = 'https://data.neonscience.org/data-products/' + PRODUCT
TUTORIAL_URL = 'https://www.neonscience.org/resources/learning-hub/tutorials/continuous-discharge-intro'


def runoff_mm_day(discharge_l_s, area_km2=AREA_KM2):
    if area_km2 <= 0:
        raise ValueError('Drainage area must be positive')
    return discharge_l_s * 0.0864 / area_km2


def daily_rows(rows, table, month):
    """Duration-weighted daily mean; instantaneous legacy samples get 60 s weights.

    Legacy endDate is an instantaneous timestamp, assigned to its UTC calendar
    day. Modern intervals use startDateTime. Duplicate times never add coverage.
    """
    variable, seconds = TABLES[table]
    records = {}
    for row in rows:
        if row.get('siteID', SITE) != SITE:
            raise ValueError('Unexpected discharge site')
        if variable not in row or 'dischargeFinalQF' not in row or 'dischargeFinalQFSciRvw' not in row:
            raise ValueError('Discharge variable or quality flag missing')
        if table == 'csd_15_min':
            stamp = parse_time(row['startDateTime'])
            end = parse_time(row['endDateTime'])
            if (end - stamp).total_seconds() != seconds or stamp.minute % 15 or stamp.second:
                raise ValueError('Unexpected 15-minute interval')
        else:
            stamp = parse_time(row['endDate'])
            if stamp.second:
                raise ValueError('Unexpected 1-minute timestamp')
        # Do not double-count package boundary records from adjoining months.
        if stamp.strftime('%Y-%m') != month:
            continue
        q = finite(row[variable])
        flag = finite(row['dischargeFinalQF'])
        review = finite(row['dischargeFinalQFSciRvw'])
        correction = finite(row.get('dischargeCorrectionApplied'))
        record = (q, flag, review, correction, row.get('stationHorizontalID'))
        if stamp in records and records[stamp] != record:
            raise ValueError('Conflicting duplicate discharge timestamp')
        records[stamp] = record
    grouped = defaultdict(list)
    for stamp, record in sorted(records.items()):
        grouped[stamp.date().isoformat()].append((stamp, record))
    out = {}
    for date, bucket in grouped.items():
        counts = Counter()
        valid = []
        for stamp, (q, flag, review, correction, station) in bucket:
            if q is None or q < 0:
                counts['missing_or_negative'] += 1
            if flag != 0:
                counts['automated_flag_failed_or_missing'] += 1
            if review not in (None, 0):
                counts['science_review_failed'] += 1
            accepted = q is not None and q >= 0 and flag == 0 and review in (None, 0)
            if accepted:
                valid.append((stamp, q))
                counts['accepted'] += 1
                counts['accepted_science_unreviewed' if review is None else 'accepted_science_pass'] += 1
                if table == 'csd_15_min':
                    counts['accepted_correction_unreviewed' if correction is None else 'accepted_corrected' if correction == 1 else 'accepted_no_correction_needed'] += 1
        valid_seconds = len(valid) * seconds
        if valid_seconds > 86400 or len(bucket) * seconds > 86400:
            raise ValueError('Overlapping discharge coverage')
        qmean = sum(q for _, q in valid) / len(valid) if valid_seconds >= MIN_COVERAGE * 86400 else None
        out[date] = {
            'runoff': round(runoff_mm_day(qmean), 6) if qmean is not None else None,
            'discharge_l_s': round(qmean, 6) if qmean is not None else None,
            'valid_seconds': valid_seconds, 'published_seconds': len(bucket) * seconds,
            'source_interval_seconds': seconds, 'quality_counts': dict(counts),
            'last_valid_sample': valid[-1][0].isoformat().replace('+00:00', 'Z') if valid else None,
        }
    return out


def preferred_release(product, month):
    releases = [r['release'] for r in product.get('availableReleases', [])
                if month in r.get('availableMonths', []) and r['release'].startswith('RELEASE-')]
    return max(releases) if releases else 'PROVISIONAL'


def read_month(client, month, release):
    cache_file = client.cache / ('summary-' + month + '.json')
    cached = json.loads(cache_file.read_text()) if cache_file.exists() else None
    compatible = cached and cached.get('schema_version') == 1 and cached.get('release') == release
    if compatible and release != 'PROVISIONAL':
        return cached
    # The data endpoint accepts named annual releases; provisional uses its default.
    query = '?package=basic' + (('&release=' + release) if release != 'PROVISIONAL' else '')
    info = client.api(f'data/{PRODUCT}/{SITE}/{month}' + query)
    if info.get('siteCode') != SITE or info.get('productCode') != PRODUCT:
        raise ValueError('Unexpected discharge package identity')
    actual_release = info.get('release')
    if actual_release != release:
        raise ValueError('Unexpected discharge release')
    files = info['files']
    selected = [f for f in files if '.csd_15_min.' in f['name'] and f['name'].endswith('.csv')]
    table = 'csd_15_min'
    if not selected:
        selected = [f for f in files if '.csd_continuousDischarge.' in f['name'] and f['name'].endswith('.csv')]
        table = 'csd_continuousDischarge'
    if len(selected) != 1:
        raise ValueError('Ambiguous or missing continuous discharge table')
    varfiles = [f for f in files if '.variables.' in f['name'] and f['name'].endswith('.csv')]
    if len(varfiles) != 1:
        raise ValueError('Ambiguous discharge variables metadata')
    fingerprints = [{k: f.get(k) for k in ('name', 'size', 'md5')} for f in selected + varfiles]
    if compatible and cached.get('fingerprints') == fingerprints:
        return cached
    variables, varsource = client.file(varfiles[0])
    variable = TABLES[table][0]
    units = [v['units'] for v in variables if v['table'] == table and v['fieldName'] == variable]
    if units != ['litersPerSecond']:
        raise ValueError('Discharge source units changed')
    rows, source = client.file(selected[0])
    result = {'schema_version': 1, 'month': month, 'release': actual_release, 'table': table,
              'fingerprints': fingerprints, 'daily': daily_rows(rows, table, month),
              'sources': [dict(s, month=month, release=actual_release, product=PRODUCT) for s in (source, varsource)]}
    atomic_json(cache_file, result)
    return result


def make_payload(months, product, now, old=None, errors=None):
    errors = errors or []
    days = {}
    sources = []
    month_meta = []
    for m in months:
        days.update(m['daily'])
        sources.extend(m['sources'])
        month_meta.append({k: m[k] for k in ('month', 'release', 'table')})
    if not month_meta:
        raise ValueError('No discharge months available')
    first = min(m['month'] for m in month_meta) + '-01'
    final_month = max(m['month'] for m in month_meta)
    date = datetime.fromisoformat(first).replace(tzinfo=timezone.utc)
    stop = datetime.fromisoformat(final_month + '-01').replace(tzinfo=timezone.utc)
    stop = (stop.replace(day=28) + timedelta(days=4)).replace(day=1)
    values, coverage, quality, discharge, published = [], [], [], [], []
    while date < stop:
        key = date.date().isoformat()
        d = days.get(key, {})
        values.append([key, d.get('runoff')])
        discharge.append([key, d.get('discharge_l_s')])
        coverage.append([key, d.get('valid_seconds', 0), 86400])
        published.append([key, d.get('published_seconds', 0)])
        quality.append([key, d.get('quality_counts', {})])
        date += timedelta(days=1)
    valid = [(date, value) for date, value in values if value is not None]
    latest = valid[-1] if valid else (None, None)
    status = 'partial_failure' if errors else 'ok'
    series = {
        'id': 'neon_bigc_runoff', 'label': 'NEON BIGC · area-normalized runoff',
        'site': 'NEON BIGC', 'category': 'Runoff', 'unit': 'mm/day',
        'start': values[0][0], 'end': values[-1][0], 'count': len(valid),
        'values': values, 'coverage': coverage, 'quality_counts': quality,
        'mean_discharge_l_s': discharge, 'published_seconds': published,
        'latest_valid_time': latest[0], 'latest_value': latest[1], 'latest_unit': 'mm/day',
        'product': PRODUCT, 'drainage_area_km2': AREA_KM2,
        'drainage_area_source': AREA_URL, 'drainage_area_approximate': True,
        'conversion': 'runoff_mm_day = mean_discharge_L_s * 0.0864 / 10.9',
        'aggregation': 'daily mean discharge converted to mm/day; at least 90% valid temporal coverage',
        'time_basis': 'UTC days; 15-minute intervals assigned by start; legacy instantaneous 1-minute values assigned by timestamp',
        'source_months': month_meta, 'source_intervals_minutes': [1, 15],
        'notes': 'Discharge is a rating-curve estimate. Use finite nonnegative values with automated quality flag 0 and science-review flag 0 or blank. Blank science-review flags mean unreviewed; these counts are retained. Daily values with 90–100% coverage estimate a full-day rate from the valid observations; gaps are not zero-filled. Legacy 1-minute instantaneous data are averaged with equal 60-second weights. Source correction indicators are summarized; unreviewed provisional estimates may change. Area normalization uses NEON’s approximate 10.9 km² catchment area. BIGC is a regional comparison, not discharge from Soaproot or Newt Creek.',
        'last_success_at': (old or {}).get('last_success_at') if errors else now, 'status': status,
    }
    result = {
        'schema_version': 1, 'checked_at': now,
        'last_success_at': (old or {}).get('last_success_at') if errors else now,
        'status': status, 'site': SITE, 'drainage_area_km2': AREA_KM2,
        'drainage_area_source': AREA_URL, 'drainage_area_approximate': True,
        'minimum_daily_coverage': MIN_COVERAGE, 'series': [series], 'sources': sources,
        'products': [{'id': PRODUCT, 'name': product['dataProductTitle'], 'url': PRODUCT_URL,
                      'latest_available_month': max(product['availableMonths']), 'months': month_meta, 'status': status}],
        'source_notes': [
            'Upper Big Creek (BIGC) is a separate NEON catchment near Soaproot Saddle, not the measured runoff of Soaproot or Newt Creek.',
            'Catchment area ≈10.9 km² from the NEON BIGC site description: ' + AREA_URL,
            'Continuous discharge source: ' + PRODUCT_URL,
            'Table and correction history: ' + TUTORIAL_URL,
            'Daily runoff rate = mean discharge in L/s × 0.0864 / drainage area in km². Values require at least 90% valid daily coverage.',
            'Automated quality failures and science-review failures are excluded. Blank science-review flags are unreviewed and retained explicitly in daily quality counts.',
            'Older 1-minute instantaneous estimates and newer 15-minute averages have distinct processing histories. Exact table and release are recorded per month.',
            'Provisional discharge can lag meteorology and may use rating curves carried forward from an earlier water year. Daily availability checks do not imply live data.',
            'Raw CSVs and cached summaries stay on the Raspberry Pi. Released months refresh when the release changes; provisional months are rechecked daily.',
        ],
    }
    if errors:
        result['errors'] = errors
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--token-file', type=Path, default=Path.home() / '.config/soap-newt/neon-token')
    parser.add_argument('--cache', type=Path, default=Path.home() / '.cache/soap-newt-bigc')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'field-sites/soap-newt/dashboard/data/bigc_runoff.json')
    parser.add_argument('--start-month', help='Optional YYYY-MM lower bound; default is full available record')
    args = parser.parse_args()
    if args.start_month and not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', args.start_month):
        parser.error('--start-month must be YYYY-MM')
    now = utc_now()
    old = json.loads(args.output.read_text()) if args.output.exists() else {}
    try:
        if args.token_file.stat().st_mode & 0o077:
            raise ValueError('Token permissions')
        token = args.token_file.read_text().strip()
        if len(token) < 10 or '\n' in token:
            raise ValueError('Token format')
        client = Client(token, args.cache)
        site = client.api('sites/' + SITE)
        product = next(p for p in site['dataProducts'] if p['dataProductCode'] == PRODUCT)
        months = sorted(m for m in product['availableMonths'] if not args.start_month or m >= args.start_month)
        if not months:
            raise ValueError('No available discharge months')
    except (OSError, ValueError, KeyError, StopIteration, HTTPError, URLError, TimeoutError) as exc:
        if old:
            old.update(checked_at=now, status='check_failed', error=type(exc).__name__)
            atomic_json(args.output, old)
        raise SystemExit('BIGC credentials or availability failed: ' + type(exc).__name__)
    results, errors = [], []
    for index, month in enumerate(months, 1):
        try:
            results.append(read_month(client, month, preferred_release(product, month)))
        except (OSError, ValueError, KeyError, HTTPError, URLError, TimeoutError) as exc:
            errors.append({'month': month, 'error': type(exc).__name__})
            cached = args.cache / ('summary-' + month + '.json')
            if cached.exists():
                results.append(json.loads(cached.read_text()))
            print('BIGC month failed:', month, type(exc).__name__, flush=True)
        if index % 12 == 0:
            print('BIGC months checked:', index, '/', len(months), flush=True)
    if not results:
        if old:
            old.update(checked_at=now, status='check_failed', errors=errors)
            atomic_json(args.output, old)
        raise SystemExit('No usable BIGC discharge months')
    payload = make_payload(results, product, now, old, errors)
    payload['cache_statistics'] = {'downloads': client.downloads, 'cache_hits': client.hits}
    atomic_json(args.output, payload)
    print('BIGC runoff:', payload['series'][0]['count'], 'valid daily estimates;', len(results), 'months;', len(errors), 'errors', flush=True)
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
