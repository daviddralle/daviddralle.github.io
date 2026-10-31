#!/usr/bin/env python3
"""Build public, credential-free telemetry products from the Pi's TOA5 receiver.

Original bytes are archived on the Pi. Logger times remain naive because their
time-zone convention is unconfirmed. Bottom relay records remain quarantined
from plots until their source tables and timestamps have been checked.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TABLES = {
    'top_soil': ('top', 'SoilHalfHourly', 30),
    'top_sap': ('top', 'Sap_Flow_Data', 120),
    'top_weather': ('top', 'Hourly', 60),
    'top_daily': ('top', 'Daily', 1440),
    'bottom_sap': ('bottom', 'BtmSap', 120),
    'bottom_temp': ('bottom', 'BtmTemp', 120),
    'bottom_water': ('bottom', 'BtmWater', 120),
    'bottom_diag': ('bottom', 'BtmDiag', 120),
    'bottom_soil': ('bottom', 'BtmSoil', 30),
}


def write_changed(path, data):
    path = Path(path)
    encoded = data if isinstance(data, bytes) else (json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()
    if path.exists() and path.read_bytes() == encoded:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_bytes(encoded)
    os.replace(temporary, path)
    return True


def utc_time(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat(timespec='seconds')


def parse_file(raw, filename, received):
    prefix = next((key for key in TABLES if filename.startswith(key + '_')), None)
    if prefix is None:
        raise ValueError('unrecognized filename')
    station, expected_table, interval = TABLES[prefix]
    if not raw or not raw.endswith((b'\n', b'\r')):
        raise ValueError('empty or incomplete file')
    rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
    if len(rows) < 5 or len(rows[0]) < 8 or rows[0][0] != 'TOA5':
        raise ValueError('missing TOA5 header or records')
    if rows[0][7] != expected_table:
        raise ValueError('unexpected table name')
    names, units = rows[1], rows[2]
    if names[:2] != ['TIMESTAMP', 'RECORD'] or len(set(names)) != len(names) or len(units) != len(names):
        raise ValueError('invalid field header')
    fields = [{'name': n, 'unit': u} for n, u in zip(names[2:], units[2:])]
    records = []
    for source_row, row in enumerate(rows[4:], 5):
        if len(row) != len(names):
            raise ValueError(f'field count mismatch at line {source_row}')
        stamp = datetime.fromisoformat(row[0])
        if stamp.tzinfo is not None:
            raise ValueError('unexpected offset in logger timestamp')
        record = int(row[1])
        values, flags, original = {}, {}, {}
        for name, unit, text in zip(names[2:], units[2:], row[2:]):
            original[name] = text
            try:
                number = float(text)
                values[name] = number if math.isfinite(number) else None
                if not math.isfinite(number):
                    flags[name] = 'missing'
                elif number == -8190:
                    values[name] = None
                    flags[name] = 'invalid_sentinel'
                elif 'Deg C' == unit or unit == 'deg_C':
                    if not -60 <= number <= 100:
                        values[name] = None
                        flags[name] = 'outside_review_bounds'
                elif unit == '%' and not 0 <= number <= 100:
                    values[name] = None
                    flags[name] = 'outside_review_bounds'
                if number < 0 and ('SapFlow' in name or 'SFD_' in name):
                    flags[name] = 'negative_reported'
            except ValueError:
                values[name] = None
                if text and not ('_TMx' in name or '_TMn' in name or name == 'CVMeta'):
                    flags[name] = 'non_numeric'
        records.append({'timestamp': row[0], 'record': record,
                        'values': values, 'raw': original, 'flags': flags,
                        'quality': 'relay_review' if station == 'bottom' else 'provisional',
                        'source_file': filename, 'source_row': source_row,
                        'received_utc': received, 'program_signature': rows[0][6]})
    return prefix, {'station': station, 'table': expected_table, 'interval_minutes': interval,
                    'fields': fields, 'records': records, 'program': rows[0][5],
                    'program_signature': rows[0][6]}


def build(source, output, archive, minimum_age=60):
    tables = {key: {'station': station, 'table': table, 'interval_minutes': minutes,
                    'fields': [], 'records': []} for key, (station, table, minutes) in TABLES.items()}
    issues, files, seen = [], [], set()
    # Snapshot completed receiver files before parsing; archive versions survive
    # remote filename reuse and removal from the receiver directory.
    for path in sorted(source.glob('*.dat')):
        if not any(path.name.startswith(key + '_') for key in TABLES):
            continue
        before = path.stat()
        if time.time() - before.st_mtime < minimum_age:
            continue
        raw = path.read_bytes()
        after = path.stat()
        if (before.st_mtime_ns, before.st_size) != (after.st_mtime_ns, after.st_size):
            continue
        digest = hashlib.sha256(raw).hexdigest()
        received = utc_time(before.st_mtime)
        archived = archive / 'raw' / (digest + '__' + path.name)
        if not archived.exists():
            archived.parent.mkdir(parents=True, exist_ok=True)
            with archived.open('xb') as handle:
                handle.write(raw)
            archived.chmod(0o600)
            os.utime(archived, (before.st_mtime, before.st_mtime))
    for archived in sorted((archive / 'raw').glob('*__*.dat'), key=lambda p: (p.stat().st_mtime, p.name)):
        filename = archived.name.split('__', 1)[1]
        raw = archived.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        received = utc_time(archived.stat().st_mtime)
        item = {'file': filename, 'sha256': digest, 'bytes': len(raw), 'received_utc': received}
        try:
            key, parsed = parse_file(raw, filename, received)
            fields = tables[key]['fields']
            if fields and fields != parsed['fields']:
                raise ValueError('schema changed: review before combining records')
            tables[key].update({k: v for k, v in parsed.items() if k != 'records'})
            for record in parsed['records']:
                identity = (key, record['program_signature'], record['timestamp'], record['record'],
                            json.dumps(record['raw'], sort_keys=True))
                if identity not in seen:
                    tables[key]['records'].append(record)
                    seen.add(identity)
            item['status'] = 'parsed'
        except (ValueError, UnicodeError, csv.Error) as error:
            item['status'] = 'excluded'
            issues.append({'file': filename, 'reason': str(error)})
        files.append(item)
    if not any(t['records'] for t in tables.values()):
        raise RuntimeError('No usable TOA5 records; refusing to replace published data')
    for table in tables.values():
        table['records'].sort(key=lambda r: (r['timestamp'], r['record'], r['source_file']))
    snapshot = {'schema_version': 1, 'site': 'sheep-camp',
                'received_through_utc': max(f['received_utc'] for f in files if f['status'] == 'parsed'),
                'time_basis': 'Logger clock; time zone and clock alignment are not yet confirmed.',
                'quality_notes': [
                    'Preliminary sensor outputs; installation and calibration metadata are pending.',
                    'Bottom relay timestamps and soil records need verification. All Bottom series are excluded from plots; latest reported battery values remain visible for diagnosis.',
                    'Zero is retained as a reported value. Missing or invalid values are null. Negative sap values are retained and marked.',
                    'The logger rainfall record begins after October 1; it is not a complete water-year precipitation total.',
                ], 'files': files, 'issues': issues, 'tables': tables}
    # All received rows remain available in reproducible monthly products.
    months = sorted({r['timestamp'][:7] for t in tables.values() for r in t['records']})
    for month in months:
        monthly = {k: {**v, 'records': [r for r in v['records'] if r['timestamp'].startswith(month)]}
                   for k, v in tables.items()}
        write_changed(output / ('telemetry-' + month + '.json'),
                      {k: v for k, v in snapshot.items() if k != 'tables'} | {'tables': monthly})
    snapshot['months'] = months
    newest = max(datetime.fromisoformat(r['timestamp']) for t in tables.values() for r in t['records'])
    cutoff = (newest - timedelta(days=31)).isoformat(sep=' ')
    snapshot['tables'] = {k: {**v, 'records': [r for r in v['records'] if r['timestamp'] >= cutoff]}
                          for k, v in tables.items()}
    snapshot['window_days'] = 31
    changed = write_changed(output / 'telemetry.json', snapshot)
    write_changed(archive / 'source-manifest.json', files)
    print(json.dumps({'changed': changed, 'files': len(files), 'excluded_files': len(issues),
                      'records': {k: len(v['records']) for k, v in tables.items()}}))
    return snapshot


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('/home/daviddralle/sfpuc/server/data/cr350'))
    parser.add_argument('--output', type=Path, default=ROOT / 'field-sites/sfpuc/dashboard/data')
    parser.add_argument('--archive', type=Path, default=Path('/home/daviddralle/sfpuc/dashboard-archive'))
    parser.add_argument('--minimum-age', type=int, default=60)
    args = parser.parse_args()
    build(args.source, args.output, args.archive, args.minimum_age)
