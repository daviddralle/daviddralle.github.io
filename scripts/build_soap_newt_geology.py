#!/usr/bin/env python3
"""Clip CGS Mariposa-sheet geology to Soap/Newt regional context.

Usage: python scripts/build_soap_newt_geology.py --source-zip /external/GAM_09-Mariposa-1967-GIS.zip
Requires fiona, shapely and pyproj. Raw source ZIP remains outside the repository.
No contacts are inferred, moved, snapped to terrain, or converted into subsurface geometry.
"""
import argparse,hashlib,json,tempfile,zipfile
from pathlib import Path
import fiona
from pyproj import CRS,Transformer
from shapely.geometry import shape,mapping,box
from shapely.ops import transform,unary_union

SOURCE='https://www.conservation.ca.gov/cgs/Documents/Publications/Geologic-Atlas-Maps/GAM_09-Mariposa-1967-GIS.zip'
PAGE='https://www.conservation.ca.gov/cgs/publications/maps-data/rgm'
EXPLANATION='https://www.conservation.ca.gov/cgs/Documents/Publications/Geologic-Atlas-Maps/GAM_09-Mariposa-1967-Explanation.pdf'
DESCRIPTIONS={
 'gr':dict(name='Mesozoic granitic rocks',age='Mesozoic',color='#cdb6b0',description='Regional grouping of granitic plutons, including granite, quartz monzonite and granodiorite. The source combines many named and unnamed units; it does not distinguish the local pluton within these watersheds.'),
 'bi':dict(name='Mesozoic basic intrusive rocks',age='Mesozoic',color='#9eac9a',description='Quartz diorite, diorite, gabbro and related basic intrusive rocks grouped at regional scale. This small mapped body lies in the surrounding context area, outside the atlas terrain.')
}

def save(p,obj):p.write_text(json.dumps(obj,separators=(',',':'),allow_nan=False)+'\n')
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--source-zip',type=Path,required=True)
 ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/soap-newt/atlas/data/geology')
 ap.add_argument('--terrain',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/soap-newt/atlas/data/terrain.json')
 args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
 t=json.loads(args.terrain.read_text());assert t['crs']=='EPSG:32611'
 terrain=box(t['xmin'],t['ymin'],t['xmax'],t['ymax']);clip=terrain.buffer(2000,join_style=2)
 to_ll=Transformer.from_crs(32611,4326,always_xy=True).transform
 out={};geometries=[];source_descriptions={};source_crs=None
 with tempfile.TemporaryDirectory() as folder:
  with zipfile.ZipFile(args.source_zip) as archive:
   for info in archive.infolist():
    dest=(Path(folder)/info.filename).resolve()
    if not dest.is_relative_to(Path(folder).resolve()):raise ValueError('Unsafe ZIP member path')
   archive.extractall(folder)
  gdb=next(Path(folder).rglob('GAM_09_Mariposa.gdb'))
  with fiona.open(gdb,layer='DescriptionOfMapUnits') as rows:
   for f in rows:
    p=dict(f['properties'])
    if p['MapUnit'] in DESCRIPTIONS:source_descriptions[p['MapUnit']]=p
  for layer,key in [('MapUnitPolys','units'),('ContactsAndFaults','lines')]:
   features=[]
   with fiona.open(gdb,layer=layer) as rows:
    crs=CRS(rows.crs);source_crs=crs.to_string();assert crs.to_epsg()==3310
    to_xy=Transformer.from_crs(crs,32611,always_xy=True).transform
    source_clip=transform(Transformer.from_crs(32611,crs,always_xy=True).transform,clip)
    for f in rows.filter(bbox=source_clip.bounds):
     original=shape(f['geometry'])
     if not original.intersects(source_clip):continue
     geom=transform(to_xy,original).intersection(clip)
     if geom.is_empty:continue
     assert geom.is_valid
     p=dict(f['properties'])
     if key=='units':
      code=p['MapUnit'];assert code in DESCRIPTIONS,code
      desc=DESCRIPTIONS[code]
      props=dict(kind='geology',id=code+'-'+f['id'],unit=code,source_id=f['id'],**desc,source_name=source_descriptions[code]['Name'],source_age=source_descriptions[code]['Age'],source_scale=250000,identity_confidence=p.get('IdentityConfidence'),source_url=PAGE)
      geometries.append(geom)
     else:
      lc=p.get('LocationConfidenceMeters');props=dict(kind='geology-line',id=p.get('ContactsAndFaults_ID',f['id']),type=p['Type'],concealed=p.get('IsConcealed')=='Y',location_confidence_m=lc if isinstance(lc,(int,float)) and lc>=0 else None,identity_confidence=p.get('IdentityConfidence'),existence_confidence=p.get('ExistenceConfidence'),symbol=p.get('Symbol'),source_scale=250000,source_url=PAGE)
     features.append(dict(type='Feature',properties=props,geometry=mapping(transform(to_ll,geom))))
   out[key]=dict(type='FeatureCollection',features=features)
 coverage=unary_union(geometries).intersection(terrain).area/terrain.area
 assert coverage>.999999,coverage
 used=sorted({f['properties']['unit'] for f in out['units']['features']})
 terrain_units=sorted({f['properties']['unit'] for f,g in zip(out['units']['features'],geometries) if g.intersection(terrain).area>0})
 units={k:{**DESCRIPTIONS[k], 'source_name':source_descriptions[k]['Name'],'source_scale':250000} for k in used}
 metadata=dict(title='Geologic map of California, Mariposa sheet',authors='R. G. Strand',report='CGS / CDMG GAM 9',year=1967,source_url=PAGE,download_url=SOURCE,description_url=EXPLANATION,retrieved='2026-11-03',source_sha256=hashlib.sha256(args.source_zip.read_bytes()).hexdigest(),source_crs=source_crs,output_crs='EPSG:4326',source_detail_scale=250000,scale=250000,bounds=list(transform(to_ll,clip).bounds),clip_bounds_utm11=list(clip.bounds),units=units,terrain_units=terrain_units,processing='Official CGS geodatabase vectors transformed from NAD83 / California Albers (EPSG:3310) to UTM11 for clipping, then WGS84. A 2 km context margin surrounds the existing terrain. No simplification, inferred contacts, terrain snapping, or field-scale subdivision. Colors are atlas display colors.',limitations='Regional interpretation at 1:250,000. Both watersheds and the complete terrain footprint lie in the generalized gr unit. Contacts are not surveyed well-scale boundaries. This layer does not resolve local plutons, weathering depth, fractures, groundwater, rock thickness or active fault status.',notes=['The small bi body and its contact are outside the atlas terrain, retained for surrounding regional context.','The full CGS geodatabase unit table was used; truncated shapefile descriptions were not used.','The more detailed USGS Shaver Lake quadrangle map (1976, 1:62,500) covers this area, but its scanned-map reference is not converted into invented vector contacts.'],references=[dict(title='CGS Mariposa sheet, Strand (1967)',url=PAGE,scale=250000),dict(title='Lockwood and Bateman (1976), Shaver Lake quadrangle, USGS GQ-1271',url='https://pubs.usgs.gov/publication/gq1271',scale=62500,note='Detailed map reference; not the source of this vector layer.'),dict(title='USGS National Geologic Map Database: Shaver Lake map',url='https://ngmdb.usgs.gov/Prodesc/proddesc_368.htm',note='Map catalog and mapView access.')],qa=dict(terrain_coverage_fraction=round(coverage,9),unit_features=len(out['units']['features']),line_features=len(out['lines']['features']),fault_features=sum('fault' in f['properties']['type'].lower() for f in out['lines']['features']),valid_geometries=True))
 for key,obj in out.items():save(args.output/(key+'.geojson'),obj)
 save(args.output/'metadata.json',metadata)
 print(json.dumps({'qa':metadata['qa'],'units':used,'terrain_units':terrain_units}))
if __name__=='__main__':main()
