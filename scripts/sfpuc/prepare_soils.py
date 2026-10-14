"""Cache NRCS SSURGO polygons around both sites, retaining source map-unit names."""
import os,json,hashlib
from pathlib import Path
import requests
from shapely import wkt,make_valid
from shapely.geometry import box,mapping,shape
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data'
WORK=Path(os.environ['SFPUC_WORK'])/'soils';WORK.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'soils';OUT.mkdir(exist_ok=True)
URL='https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest'
bounds=[-121.881,37.537,-121.835,37.612];extent=box(*bounds)
query=f"""SELECT p.mupolygonkey,p.mukey,m.musym,m.muname,l.areasymbol,l.areaname,
 p.mupolygongeo.STAsText() AS wkt
 FROM mupolygon p INNER JOIN mapunit m ON p.mukey=m.mukey
 INNER JOIN legend l ON m.lkey=l.lkey
 WHERE p.mupolygonkey IN (SELECT mupolygonkey FROM SDA_Get_Mupolygonkey_from_intersection_with_WktWgs84('{extent.wkt}'))"""
cache=WORK/'polygons.json'
if not cache.exists():
 r=requests.post(URL,json={'query':query,'format':'JSON+COLUMNNAME'},timeout=120);r.raise_for_status();cache.write_text(r.text)
raw=json.loads(cache.read_text())['Table'];rows=[dict(zip(raw[0],r)) for r in raw[1:]]
colors=['#cba77c','#9ebfc4','#d2cb91','#b1c19a','#c0a4bf','#ddb293','#92b9aa','#bcb4d2','#d8c0a4','#a3b7d2','#c1cba9','#d4a5aa']
units={}
for key in sorted(set(r['mukey'] for r in rows),key=int):
 r=next(r for r in rows if r['mukey']==key);units[key]={k:r[k] for k in ['musym','muname','areasymbol','areaname']};units[key]['color']=colors[len(units)%len(colors)]
features=[]
for r in rows:
 g=make_valid(wkt.loads(r['wkt'])).intersection(extent)
 if g.is_empty or g.area==0:continue
 assert g.is_valid
 features.append({'type':'Feature','properties':{k:r[k]for k in ['mupolygonkey','mukey','musym','muname','areasymbol']},'geometry':mapping(g)})
coverage=unary_union([shape(f['geometry'])for f in features]);assert extent.difference(coverage).area<1e-9
plot_units={}
for site in ['sheep-camp','maguire-ridge']:
 for f in json.loads((ROOT/site/'plots.geojson').read_text())['features']:
  hits={g['properties']['mukey'] for g in features if shape(g['geometry']).covers(shape(f['geometry']))};assert len(hits)==1
  plot_units[f['properties']['plot']]=list(hits)[0]
meta={'title':'NRCS Soil Survey Geographic Database (SSURGO)','source_url':'https://sdmdataaccess.sc.egov.usda.gov/','service_url':URL,'retrieved':'2026-10-14','bounds':bounds,'crs':'EPSG:4326','query':query,'source_sha256':hashlib.sha256(cache.read_bytes()).hexdigest(),'units':units,'plot_center_intersections':plot_units,'notes':['Map-unit polygons and names from USDA NRCS Soil Data Access, retrieved 14 October 2026.','Clipped to the same extent as geology, without simplifying or shifting boundaries.','Map units may contain multiple soil components and local inclusions; these are mapped interpretations, not soil observations at each plot.','Slope ranges in unit names describe the mapped unit, not measured plot slopes. Colors are for this atlas.']}
(OUT/'units.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'))+'\n');(OUT/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
print(len(features),'polygons;',len(units),'map units;',plot_units)
