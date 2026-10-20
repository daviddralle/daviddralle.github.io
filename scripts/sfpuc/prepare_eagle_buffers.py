"""Extract the Maguire Peaks buffer polygons; keep the full source KMZ outside the repo."""
import argparse, hashlib, html, json, re, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from pyproj import Transformer
from shapely.geometry import Polygon, Point, mapping
from shapely.ops import transform
from rasterio.features import rasterize
from rasterio.transform import from_origin
from PIL import Image

parser=argparse.ArgumentParser();parser.add_argument('kmz',type=Path);args=parser.parse_args()
root=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data';out=root/'eagle-buffers';out.mkdir(exist_ok=True)
raw=args.kmz.read_bytes()
with zipfile.ZipFile(args.kmz) as z:text=z.read('doc.kml').decode('utf-8')
# The supplied export uses xsi:schemaLocation but omits its namespace declaration.
repair='xmlns:xsi=' not in text and 'xsi:schemaLocation' in text
if repair:text=text.replace('<kml ', '<kml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ',1)
doc=ET.fromstring(text);ns={'k':'http://www.opengis.net/kml/2.2'}
project=Transformer.from_crs(4326,26910,always_xy=True).transform
features=[];scene=[]
plots=json.loads((root/'maguire-ridge/plots.geojson').read_text())['features']
tm=json.loads((root/'maguire-ridge/3d/scene.json').read_text())['terrain'];w,h,step=tm['width'],tm['height'],tm['step'];grid=from_origin(tm['x0']-step/2,tm['y0']+step/2,step,step)
for folder in doc.findall('.//k:Folder',ns):
 name=folder.findtext('k:name',default='',namespaces=ns)
 if name not in ['SFPUC 2026 Eagle Nest Buffers_Min','SFPUC 2026 Eagle Nest Buffers_Max']:continue
 kind='min' if name.endswith('_Min') else 'max'
 matches=[p for p in folder.findall('k:Placemark',ns) if p.findtext('k:name',namespaces=ns)=='Maguire Peaks'];assert len(matches)==1
 pm=matches[0];polys=pm.findall('.//k:Polygon',ns);assert len(polys)==1
 rings=[]
 for boundary in ['outerBoundaryIs','innerBoundaryIs']:
  for coord in polys[0].findall('k:'+boundary+'/k:LinearRing/k:coordinates',ns):
   rings.append([list(map(float,c.split(',')))[:2] for c in coord.text.split()])
 polygon=Polygon(rings[0],rings[1:]);assert polygon.is_valid and polygon.area>0
 desc=pm.findtext('k:description',default='',namespaces=ns)
 attributes={html.unescape(re.sub('<[^>]*>','',a)).strip():html.unescape(re.sub('<[^>]*>','',b)).strip() for a,b in re.findall(r'<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>',desc)}
 distance=int(attributes['BUFF_DIST']);assert distance=={'min':800,'max':1600}[kind]
 color={'min':'#ff9b67','max':'#e7c86a'}[kind]
 inside=[p['properties']['plot'] for p in plots if polygon.covers(Point(p['geometry']['coordinates']))];assert len(inside)==10
 props={'id':'maguire-peaks-'+kind,'territory':'Maguire Peaks','site':'maguire-ridge','buffer_class':'Minimum' if kind=='min' else 'Maximum','buffer_m':distance,'species_code':attributes['Species'],'source_year':2026,'source_layer':name,'source_file':args.kmz.name,'color':color,'plot_centers_inside':inside}
 features.append({'type':'Feature','properties':props,'geometry':mapping(polygon)})
 projected=transform(project,polygon)
 # Validate distance units against the geographic polygon size without regenerating it.
 radius=(projected.area/np.pi)**.5;assert abs(radius-distance)<distance*.01,(radius,distance)
 mask=rasterize([(projected,1)],out_shape=(h,w),transform=grid,dtype='uint8')
 line=rasterize([(projected.boundary,1)],out_shape=(h,w),transform=grid,dtype='uint8')
 rgba=np.zeros((h,w,4),dtype=np.uint8);rgb=[int(color.lstrip('#')[i:i+2],16) for i in (0,2,4)]
 rgba[mask==1]=rgb+[255];rgba[line==1]=rgb+[255];Image.fromarray(rgba).save(out/(kind+'.png'))
 scene.append({'properties':props,'geometry':mapping(projected),'texture':kind+'.png'})
assert len(features)==2
(out/'buffers.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'))+'\n')
(out/'scene.json').write_text(json.dumps({'crs':'EPSG:26910','site':'maguire-ridge','features':scene},separators=(',',':'))+'\n')
meta={'source_file':args.kmz.name,'source_sha256':hashlib.sha256(raw).hexdigest(),'source_year':2026,'territory':'Maguire Peaks','feature_count':2,'namespace_repair':repair,'notes':['Only the Maguire Peaks minimum and maximum buffer polygons are included. Nest points, other territories, roads, and ownership layers are omitted.','Original KML WGS84 polygon vertices retained without simplification or replacement by circles. Buffer distances interpreted as meters and checked against projected polygon area within 1%.','Minimum and maximum are source layer labels, not newly inferred activity restrictions.','3D fill is rasterized onto the existing 2 m Maguire Ridge terrain mesh; extent outside that terrain cutout is shown only in 2D. Terrain cutout edges are not buffer boundaries.']}
(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps({'features':len(features),'plots_in_each':10,'namespace_repair':repair}))
