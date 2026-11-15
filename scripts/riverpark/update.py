#!/usr/bin/env python3
"""Archive public River Park observations, publishing weather fields only.

No API key is needed. The station is resolved from its public dashboard slug.
Raw station responses (which include identifiers/location) are never saved.
"""
import argparse
import json
import math
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2] / 'field-sites/riverpark/data'
SLUG = 'ba19c4bd1ae9bc2272fd1f36df654b83'
API = 'https://lightning.ambientweather.net'
TZ = ZoneInfo('America/Los_Angeles')
STEP = 300_000
FIELDS = ['dateutc', 'tempf', 'humidity', 'windspeedmph', 'windgustmph',
          'winddir', 'totalrainin', 'dailyrainin', 'hourlyrainin']


def request(path, query):
    url = API + path + '?' + urllib.parse.urlencode(query)
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'RiverParkWeather/1.0'})
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.load(response)['data']
        except Exception:
            if attempt == 4:
                raise RuntimeError('Ambient request failed; existing archive retained') from None
            time.sleep(2 ** (attempt + 1))


def number(value):
    return value if isinstance(value, (int, float)) and math.isfinite(value) else None


def clean(record):
    values = [number(record.get(key)) for key in FIELDS]
    if values[0] is None:
        return None
    for i in [3, 4, 6, 7, 8]:
        if values[i] is not None and values[i] < 0:
            values[i] = None
    if values[2] is not None and not 0 <= values[2] <= 100:
        values[2] = None
    return values


def local_date(timestamp):
    return datetime.fromtimestamp(timestamp / 1000, TZ).date().isoformat()


def rain_increment(previous, current):
    """Counter difference only over adjacent samples; never spread rain over gaps."""
    if not previous or not 0 < current[0] - previous[0] <= STEP * 1.5:
        return None
    if current[6] is not None and previous[6] is not None:
        diff = current[6] - previous[6]
        if diff >= -0.00001:
            return round(max(0, diff), 4)
    # A yearly/device counter reset can still have a valid daily counter.
    if current[7] is not None and previous[7] is not None:
        if local_date(current[0]) != local_date(previous[0]):
            return current[7]
        diff = current[7] - previous[7]
        if diff >= -0.00001:
            return round(max(0, diff), 4)
    return None


def write(path, data):
    content = json.dumps(data, separators=(',', ':'), allow_nan=False) + '\n'
    if path.exists() and path.read_text() == content:
        return
    temporary = path.with_suffix('.tmp')
    temporary.write_text(content)
    temporary.replace(path)


def summarize(rows):
    groups = {}
    previous = None
    for row in rows:
        if previous is None:
            previous = row
            continue  # The first sample is a baseline, not a measured rain interval.
        # Rain belongs to the interval ending here, including midnight's last interval.
        day = local_date(row[0] - 1)
        group = groups.setdefault(day, {'rows': [], 'rain': [], 'unknown': 0})
        group['rows'].append(row)
        rain = rain_increment(previous, row)
        if rain is None:
            group['unknown'] += 1
        else:
            group['rain'].append(rain)
        previous = row
    result = []
    for day, group in sorted(groups.items()):
        rr = group['rows']
        start = datetime.fromisoformat(day).replace(tzinfo=TZ)
        end = start + timedelta(days=1)
        expected = (end.timestamp() - start.timestamp()) / 300
        def mean(index):
            vv = [r[index] for r in rr if r[index] is not None]
            return round(sum(vv) / len(vv), 3) if vv else None
        def extreme(index, fn):
            vv = [r[index] for r in rr if r[index] is not None]
            return fn(vv) if vv else None
        result.append({'date': day, 't': int(start.timestamp() * 1000),
                       'temp': mean(1), 'low': extreme(1, min), 'high': extreme(1, max),
                       'humidity': mean(2), 'wind': mean(3), 'gust': extreme(4, max),
                       'rain': round(sum(group['rain']), 4) if group['rain'] else None,
                       'samples': len(rr), 'expected': int(expected),
                       'complete': len(rr) >= expected and group['unknown'] == 0})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', help='Backfill from a local ISO date; default: update latest 2 days')
    parser.add_argument('--output', type=Path, default=ROOT)
    args = parser.parse_args()
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    station = request('/devices', {'public.slug': SLUG})[0]
    latest = clean(station['lastData'])
    rows = {}
    for path in sorted(out.glob('observations-*.json')):
        rows.update((r[0], r) for r in json.loads(path.read_text())['rows'])
    if args.start:
        start = int(datetime.fromisoformat(args.start).replace(tzinfo=TZ).timestamp() * 1000)
    elif rows:
        start = max(rows) - 2 * 86400_000
    else:
        start = latest[0] - 30 * 86400_000
    if start >= latest[0]:
        raise RuntimeError('Start date must precede the latest observation')
    # Six days is below Ambient's 2,000-record limit at five-minute spacing.
    while start < latest[0]:
        end = min(start + 6 * 86400_000, latest[0])
        records = request('/device-data', {'macAddress': station['macAddress'],
                          'start': start, 'end': end, 'limit': 2000, 'res': 5})
        if len(records) >= 2000:
            raise RuntimeError('Unexpected result cap; refusing a truncated archive')
        for record in records:
            row = clean(record)
            if row and start <= row[0] <= end:
                rows[row[0]] = row
        # Checkpoint sanitized data, making a backfill resumable by --start.
        months = {}
        for row in sorted(rows.values()):
            month = datetime.fromtimestamp(row[0] / 1000, timezone.utc).strftime('%Y-%m')
            months.setdefault(month, []).append(row)
        for month, values in months.items():
            write(out / f'observations-{month}.json', {'fields': FIELDS, 'rows': values})
        print(f'{local_date(start)} to {local_date(end)}: {len(records)} observations', flush=True)
        start = end
        time.sleep(.3)
    ordered = sorted(rows.values())
    if not ordered:
        raise RuntimeError('No observations returned')
    daily = summarize(ordered)
    now = datetime.now(timezone.utc).isoformat()
    write(out / 'daily.json', {'updated': now, 'days': daily})
    # Compact recent file for initial page load; longer raw windows load monthly files.
    write(out / 'recent.json', {'fields': FIELDS, 'rows': [r for r in ordered if r[0] >= latest[0] - 8 * 86400_000]})
    write(out / 'manifest.json', {'updated': now, 'timezone': str(TZ), 'source': 'Ambient Weather',
          'source_url': 'https://ambientweather.net/dashboard/' + SLUG,
          'start': ordered[0][0], 'end': ordered[-1][0], 'count': len(ordered),
          'months': sorted(months), 'fields': FIELDS, 'current': latest,
          'current_extra': {k: number(station['lastData'].get(k)) for k in ['feelsLike', 'maxdailygust', 'yearlyrainin']},
          'complete_days': sum(day['complete'] for day in daily), 'days': len(daily)})
    print(f'Archived {len(ordered)} observations, {len(daily)} local days.', flush=True)


if __name__ == '__main__':
    main()
