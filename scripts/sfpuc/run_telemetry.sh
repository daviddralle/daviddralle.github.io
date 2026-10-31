#!/bin/bash
# Pi-owned scheduled processing and publication. Share the existing site's lock.
set -euo pipefail
site_repo=/home/daviddralle/daviddralle.github.io
exec 9>/home/daviddralle/.local/state/hydroeco-automation.lock
/usr/bin/flock -w 600 9
cd "$site_repo"
git pull --ff-only origin master
/usr/bin/python3 scripts/sfpuc/ingest_telemetry.py
paths=(field-sites/sfpuc/dashboard/data/telemetry*.json)
git add -- "${paths[@]}"
if ! git diff --cached --quiet -- "${paths[@]}"; then
  git commit --only -m "Update Sheep Camp telemetry $(date --iso-8601=minutes)" -- "${paths[@]}"
fi
# Retry a previously committed but unpushed update as well as this run's changes.
git push origin master
