#!/bin/bash
# Run on pi5. Share the website lock with Rancho, Sheep Camp and Soap/Newt.
set -euo pipefail

site_repo=/home/daviddralle/daviddralle.github.io
state_dir=/home/daviddralle/.local/state/riverpark
mkdir -p "$state_dir"
exec 9>/home/daviddralle/.local/state/hydroeco-automation.lock
/usr/bin/flock -w 600 9
printf 'River Park update started %s\n' "$(date --iso-8601=seconds)"
cd "$site_repo"

# Preserve unexpected working changes; untracked files are left alone.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo 'Tracked website changes are pending; leaving them untouched.' >&2
  exit 1
fi
git fetch origin master
if ! git rebase origin/master; then
  git rebase --abort
  exit 1
fi

# Fetch and validate outside the checkout so a failed fetch cannot leave a
# partially updated public archive or block the other Pi publishers.
run_dir=$(mktemp -d "$state_dir/run.XXXXXX")
trap 'rm -rf -- "$run_dir"' EXIT
cp field-sites/riverpark/data/*.json "$run_dir/"
/usr/bin/timeout 900 /usr/bin/python3 scripts/riverpark/update.py --output "$run_dir"
/usr/bin/python3 - "$run_dir" <<'PY'
import json
import sys
from pathlib import Path

staged = Path(sys.argv[1])
published = Path('field-sites/riverpark/data')
new = json.loads((staged / 'manifest.json').read_text())
old = json.loads((published / 'manifest.json').read_text())
if new['current'][0] < old['current'][0] or new['count'] < old['count']:
    raise SystemExit('Station response would move the archive backward; not publishing')
if not json.loads((staged / 'recent.json').read_text())['rows']:
    raise SystemExit('Recent observations are empty; not publishing')
for path in staged.glob('*.json'):
    json.loads(path.read_text())
    target = published / path.name
    content = path.read_bytes()
    if not target.exists() or target.read_bytes() != content:
        temporary = target.with_suffix('.tmp')
        temporary.write_bytes(content)
        temporary.replace(target)
PY

git add -- field-sites/riverpark/data
if ! git diff --cached --quiet -- field-sites/riverpark/data; then
  git commit --only -m "Update River Park weather $(date --iso-8601=minutes)" -- field-sites/riverpark/data
fi
# Include a previous unpushed update. Retry if a remote publisher won the race.
for attempt in 1 2 3; do
  if git push origin master; then
    printf 'River Park update published %s\n' "$(date --iso-8601=seconds)"
    exit 0
  fi
  git fetch origin master
  if ! git rebase origin/master; then
    git rebase --abort
    exit 1
  fi
done
echo 'River Park publication failed after three attempts.' >&2
exit 1
