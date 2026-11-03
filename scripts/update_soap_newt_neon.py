#!/usr/bin/env python3
"""Refresh public SOAP product availability; no sensor values are downloaded.

Standard-library-only, intended for the Raspberry Pi's daily runner. Data-file
API endpoints require a NEON API token; this public metadata endpoint does not.
The portal's latest month is availability metadata, not an observation timestamp.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API = 'https://data.neonscience.org/api/v0/sites/SOAP'
PRODUCTS = (
    'DP1.00002.001', 'DP1.00003.001', 'DP1.00004.001',
    'DP1.00001.001', 'DP1.00045.001', 'DP1.00098.001',
    'DP1.00023.001', 'DP1.00041.001', 'DP1.00094.001',
    'DP4.00200.001', 'DP3.30015.001', 'DP3.30024.001',
)


def fetch_site():
    for attempt in range(3):
        try:
            req = Request(API, headers={'User-Agent': 'SoapNewtAtlas/1.0 (research site availability cache)'})
            with urlopen(req, timeout=45) as response:
                result = json.load(response)['data']
            if result.get('siteCode') != 'SOAP' or not isinstance(result.get('dataProducts'), list):
                raise ValueError('Unexpected NEON site response')
            return result
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** (attempt + 1))


def summarize(site, checked_at, observations_enabled=False):
    source_products = {p['dataProductCode']: p for p in site['dataProducts']}
    products = []
    for code in PRODUCTS:
        p = source_products.get(code)
        if p is None:
            continue
        months = sorted(set(p.get('availableMonths', [])))
        latest = months[-1] if months else None
        releases = [r['release'] for r in p.get('availableReleases', [])
                    if latest in r.get('availableMonths', [])]
        products.append({
            'id': code, 'name': p['dataProductTitle'],
            'first_month': months[0] if months else None,
            'latest_month': latest, 'month_count': len(months),
            'latest_status': 'provisional' if 'PROVISIONAL' in releases else ('released' if releases else 'unknown'),
            'latest_releases': releases,
            'url': 'https://data.neonscience.org/data-products/' + code,
        })
    return {
        'schema_version': 1,
        'checked_at': checked_at,
        'last_success_at': checked_at,
        'status': 'metadata_only',
        'download_status': 'observations_enabled' if observations_enabled else 'authentication_required',
        'site': {'code': 'SOAP', 'name': site['siteName'],
                 'latitude': site['siteLatitude'], 'longitude': site['siteLongitude'],
                 'coordinate_note': 'NEON site representative coordinate; not a surveyed tower base'},
        'products': products,
        'sources': [
            {'title': 'NEON SOAP site availability API', 'url': API},
            {'title': 'NEON data publication schedule', 'url': 'https://www.neonscience.org/data-samples/data-management/data-availability'},
            {'title': 'NEON data API authentication', 'url': 'https://data.neonscience.org/data-api/endpoints/data/'},
        ],
        'notes': [
            'Availability checked daily on the Raspberry Pi. This file contains product metadata, not newly downloaded measurements.',
            'Instrument products are generally published monthly, typically in the second week of the following month; this is not a real-time feed.',
            'Latest month means files are listed for that month. It does not establish complete coverage or the time of the latest valid observation.',
            'Provisional data may change. Archived observations in the dashboard retain their own source coverage dates.',
            ('Selected meteorological observations are downloaded separately to neon_observations.json on the Pi; check that file for sample dates and refresh status. Atlas lidar was acquired separately from official NEON Earth Engine collections.' if observations_enabled else 'NEON portal data-file downloads require an API token; automatic observation downloads are not configured. Atlas lidar was acquired separately from the official NEON Earth Engine collections.'),
        ],
    }


def atomic_write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=path.name + '.', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(payload, stream, separators=(',', ':'), allow_nan=False)
            stream.write('\n')
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'field-sites/soap-newt/dashboard/data/neon.json')
    parser.add_argument('--observations-enabled', action='store_true', help='Selected meteorology download is configured separately')
    args = parser.parse_args()
    now = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    try:
        payload = summarize(fetch_site(), now, args.observations_enabled)
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError) as exc:
        # Retain good availability information but clearly mark the failed check.
        if args.output.exists():
            payload = json.loads(args.output.read_text())
            payload.update(checked_at=now, status='check_failed', error=type(exc).__name__)
            atomic_write(args.output, payload)
        raise SystemExit('NEON availability check failed: ' + type(exc).__name__)
    atomic_write(args.output, payload)
    print('SOAP availability refreshed:', len(payload['products']), 'products; metadata only')


if __name__ == '__main__':
    main()
