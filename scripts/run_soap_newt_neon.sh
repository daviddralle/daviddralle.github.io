#!/bin/bash
# Daily SOAP availability check. Run only on the Raspberry Pi.
set -euo pipefail
site_repo=/home/daviddralle/daviddralle.github.io
exec 9>/home/daviddralle/.local/state/hydroeco-automation.lock
/usr/bin/flock -w 600 9
cd "$site_repo"
git pull --ff-only origin master
# Preserve/publish last-good data with an explicit check_failed state on outage.
update_status=0
/usr/bin/python3 scripts/update_soap_newt_neon.py || update_status=$?
paths=(field-sites/soap-newt/dashboard/data/neon.json)
git add -- "${paths[@]}"
if ! git diff --cached --quiet -- "${paths[@]}"; then
  git commit --only -m "Update Soaproot NEON availability $(date --iso-8601=minutes)" -- "${paths[@]}"
fi
git push origin master
exit "$update_status"
