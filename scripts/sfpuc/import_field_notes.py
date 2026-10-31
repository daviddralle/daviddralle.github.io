#!/usr/bin/env python3
"""Validate a notebook export. --approve merges reviewed notes into website data.
Run on the Pi; validation alone never changes the public records.
"""
import argparse
import json
from datetime import date, time
from pathlib import Path
from ingest_telemetry import write_changed

FIELDS = ['id', 'date', 'time', 'site', 'station', 'sensor_id', 'kind', 'observer',
          'source_reference', 'latitude', 'longitude', 'text', 'uncertainty', 'transcribed_at']


def validate(document):
    if document.get('schema_version') != 1 or not isinstance(document.get('notes'), list):
        raise ValueError('Expected a version-1 field-notes export')
    output, ids = [], set()
    for note in document['notes']:
        date.fromisoformat(note['date'])
        if note.get('time'):
            time.fromisoformat(note['time'])
        if note.get('site') not in ['sheep-camp', 'maguire-ridge']:
            raise ValueError('Unknown site')
        if note.get('station', '') not in ['', 'top', 'bottom', 'site']:
            raise ValueError('Unknown station')
        if not isinstance(note.get('id'), str) or not note['id'] or note['id'] in ids:
            raise ValueError('Missing or duplicate note ID')
        if not isinstance(note.get('text'), str) or not note['text'].strip():
            raise ValueError('Empty transcription')
        for field, limit in [('latitude', 90), ('longitude', 180)]:
            value = note.get(field)
            if value is not None and (not isinstance(value, (int, float)) or not -limit <= value <= limit):
                raise ValueError('Invalid ' + field)
        cleaned = {field: note.get(field) for field in FIELDS}
        cleaned['review_status'] = 'reviewed'
        output.append(cleaned)
        ids.add(note['id'])
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--approve', action='store_true', help='Approve these transcriptions for public display')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[2] / 'field-sites/sfpuc/dashboard/data/field-notes.json')
    args = parser.parse_args()
    notes = validate(json.loads(args.input.read_text()))
    if args.approve:
        existing = json.loads(args.output.read_text()) if args.output.exists() else {'schema_version': 1, 'notes': []}
        merged = {n['id']: n for n in existing['notes']}
        for note in notes:
            if note['id'] in merged and note != merged[note['id']]:
                raise ValueError('Conflicting existing note; assign a new ID and retain the original')
            merged[note['id']] = note
        write_changed(args.output, {'schema_version': 1, 'notes': sorted(merged.values(), key=lambda n: (n['date'], n.get('time') or '', n['id']))})
    print(f'{len(notes)} records validated' + (' and merged for publication.' if args.approve else '; no files changed.'))
