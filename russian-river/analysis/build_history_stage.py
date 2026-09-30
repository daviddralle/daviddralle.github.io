"""Reproducible display transfer; not an official rating or reconstructed stage record."""
import csv, hashlib, json, statistics
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'data/research/2019_stage_flow.csv'
rows = list(csv.DictReader(source.open()))
# Average interpolated stage at all crossings, rather than averaging time samples.
nodes = []
for q in range(5000, 70000, 5000):
    crossings = []
    for a, b in zip(rows, rows[1:]):
        qa, qb = float(a['hacienda_cfs']), float(b['hacienda_cfs'])
        if min(qa, qb) <= q < max(qa, qb):
            sa, sb = float(a['johnsons_stage_ft']), float(b['johnsons_stage_ft'])
            crossings.append(sa + (sb-sa)*(q-qa)/(qb-qa))
    if crossings:
        nodes.append([q, statistics.mean(crossings)])
# Event-crest anchor preserves the existing 2019 damage-reference scenario.
nodes.append([72000, 45.38])
# CNRFC's documented 1986 crest paired with that event's USGS peak flow.
nodes.append([102000, 49.50])
assert all(a[0]<b[0] and a[1]<b[1] for a,b in zip(nodes,nodes[1:]))
def extend(q,a,b): return [q,a[1]+(q-a[0])*(b[1]-a[1])/(b[0]-a[0])]
nodes = [extend(500,*nodes[:2])] + nodes + [extend(120000,*nodes[-2:])]
result = {
 'schema':1, 'prepared':'2026-09-30', 'gage':'Guerneville / Johnsons Beach',
 'units':'ft gage height; not NAVD88 elevation or water depth at the house',
 'kind':'estimated_stage_display_transfer', 'nodes':[{'flow_cfs':q,'stage_ft':round(s,6)} for q,s in nodes],
 'method':'Piecewise linear monotone transfer. At each 5,000-cfs knot from 5,000 to 65,000 cfs, average interpolated simultaneous Johnsons stage at all flow crossings in the paired February 2019 record. Anchor 72,000 cfs to the 2019 stage crest 45.38 ft and 102,000 cfs to the published 1986 crest 49.50 ft. Extend the first and last segments to the input bounds 500 and 120,000 cfs.',
 'limitations':'Not an official rating curve or observed annual stage series. Different gauges and peak timing, hysteresis, channel change and cross-event variability are unresolved. Both views use the same discharge exceedance counts. Tooltip dates are measured discharge-peak dates, not inferred stage-crest times. The small house depicts threshold status only, not surveyed architecture or flood depth.',
 'sources':[{'url':'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=11467000,11467002&startDT=2019-02-24&endDT=2019-03-02&parameterCd=00060,00065&siteStatus=all','local':'2019_stage_flow.csv','sha256':hashlib.sha256(source.read_bytes()).hexdigest()},{'url':'https://www.cnrfc.noaa.gov/obsRiver_hc.php?id=GUEC1','accessed':'2026-09-30','used':'1986 stage 49.50 ft; 2019 stage 45.38 ft. CNRFC estimated discharges for 2019 and recent years differ from this app USGS record and are not substituted.'}]
}
(ROOT/'data/research/history_stage_transfer.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['nodes'])
