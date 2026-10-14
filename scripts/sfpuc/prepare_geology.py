"""Clip USGS OFR 96-252 geology for the shared SFPUC map.
Set SFPUC_WORK to the private build-cache directory. Source archives are cached
under geology/. Output geometries are transformed from NAD27 / UTM 10N to WGS84.
"""
import os,json,hashlib,zipfile
from pathlib import Path
import requests,geopandas as gpd
from shapely.geometry import box,mapping
from shapely import make_valid
from pyproj import Transformer,Geod
ROOT=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data/geology'
WORK=Path(os.environ['SFPUC_WORK'])/'geology';ROOT.mkdir(parents=True,exist_ok=True);WORK.mkdir(parents=True,exist_ok=True)
URL='https://ngmdb.usgs.gov/docs/gis/NGMDB_22969_shp.zip'
archive=WORK/'NGMDB_22969_shp.zip'
if not archive.exists():r=requests.get(URL,timeout=90);r.raise_for_status();archive.write_bytes(r.content)
shapes=WORK/'shapefiles';shapes.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
 for name in z.namelist():
  if Path(name).name!=name:raise ValueError('Unexpected archive path')
  (shapes/name).write_bytes(z.read(name))
# The converted shapefiles omit their CRS. The original report specifies UTM 10
# meters but omits the datum. These original AL_QUAD.TIC control points coincide
# with the documented 7.5-minute grid in NAD27; NAD83 misses by about 205 meters.
tics=[(599277,4164599.8,-121.875,37.625),(610308.25,4164739.5,-121.75,37.625),(599443.06,4150731.2,-121.875,37.5)]
checks={}
for code,geog in [(26710,4267),(26910,4269)]:
 t=Transformer.from_crs(code,geog,always_xy=True);g=Geod(ellps='clrk66' if code==26710 else 'GRS80')
 errors=[g.inv(*t.transform(x,y),lon,lat)[2]for x,y,lon,lat in tics];checks[str(code)]=errors
assert max(checks['26710'])<1 and min(checks['26910'])>200
bounds=[-121.881,37.537,-121.835,37.612];extent=box(*bounds)
# Concise descriptions summarize the original algeo text. Ages are intentionally
# broad where the same unit symbol has different descriptions by assemblage.
rows={
'QTl':['Livermore gravels','Pliocene–Pleistocene','Poorly to moderately consolidated gravel, conglomerate and coarse sand; locally siltstone and claystone.','#ecd59a'],
'Tbr':['Briones Formation','Miocene','Marine sandstone, siltstone, conglomerate and shell-rich beds.','#e7b96c'],
'Ks':['Unnamed sandstone and shale','Cretaceous','Bedded sandstone, siltstone and shale; sandstone is locally mica-bearing and cross-bedded.','#8fbd99'],
'Qu':['Surficial deposits, undivided','Holocene–Pleistocene','Undifferentiated young surface deposits. This bedrock map does not resolve their detailed sediment types.','#f4edc4'],
'Qar':['Artificial rock fill','Modern','Sand, gravel, cobbles and boulders used in dam construction.','#c8b8c1'],
'Qls':['Landslide deposits','Holocene–Pleistocene','Selected large landslide deposits. The source intentionally omits most landslides.','#d7c3a0'],
'H2O':['Water','Not applicable','Water area in the source map.','#8ec7dc'],
'Tt':['Tice Shale','Miocene','Shale and claystone, locally with siltstone, mudstone and siliceous beds.','#bdb8d8'],
'To':['Oursan Sandstone','Miocene','Sandstone with siltstone and mudstone or claystone; lithology varies among mapped assemblages.','#c4ceaa'],
'Tcs':['Claremont siliceous rocks','Miocene','Chert and siliceous shale; described as Claremont Shale or a member of the Claremont Formation.','#c5a8ce'],
'Tccs':['Claremont sandstone and siltstone','Miocene','Fine-grained quartz sandstone and siltstone within the Claremont unit.','#d8b8a4'],
'Ts':['Sobrante Sandstone','Miocene','White quartz sandstone, locally calcareous.','#e7cd8c'],
'Tss':['Unnamed sandstone','Late Miocene–Pliocene','Poorly consolidated sandstone and siltstone with diatomite, diatomaceous chert and freshwater limestone.','#d9d1a1'],
'Tlp':['Unnamed freshwater limestone','Pliocene(?)','Freshwater limestone; age uncertain in the source description.','#cddcc0'],
'Tn':['Neroly Sandstone','Late Miocene','Volcanic-rich sandstone with minor siltstone, shale, tuff and conglomerate.','#b4c5a8'],
'Tgvt':['Green Valley and Tassajara formations, undivided','Miocene–Pliocene','Nonmarine sandstone, siltstone and conglomerate, with local tuff beds.','#e1c3a0'],
'Tsv':['Silicic volcanic rocks','Miocene or younger','Rhyolite and dacite plugs, dikes and sills.','#d99899'],
'Ku':['Unnamed sedimentary rocks','Late Cretaceous','Mudstone, siltstone and sandstone; proportions vary among mapped assemblages.','#9bc9b9'],
'KJfm':['Franciscan mélange','Late Jurassic–Early Cretaceous','A heterogeneous mixture of blocks in a sheared matrix.','#a4b6c7'],
'sp':['Serpentinite','Mesozoic association; unit age unspecified','Sheared serpentinite and serpentinized ultramafic rock, locally altered to silica-carbonate rock.','#9bad94']}
units={k:dict(zip(['name','age','description','color'],v))for k,v in rows.items()}
def load(name):return gpd.read_file(shapes/name).set_crs(26710).to_crs(4326)
polys=load('al_um_py_polygon.shp');polys=polys[polys.intersects(extent)]
features=[]
for _,r in polys.iterrows():
 code=r.PTYPE;assert code in units,code
 geom=make_valid(r.geometry).intersection(extent)
 if geom.is_empty:continue
 features.append({'type':'Feature','properties':{'unit':code,'source_id':int(r.AL_UM_PY_),'kind':'geology'},'geometry':mapping(geom)})
(ROOT/'units.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'))+'\n')
lines=load('al_um_py_arc.shp');lines=lines[lines.intersects(extent)];fs=[]
for _,r in lines.iterrows():
 typ=r.LTYPE.strip().rstrip('@,');kind='fault' if 'fault' in typ else 'contact' if 'contact' in typ else None
 if not kind:continue
 geom=r.geometry.intersection(extent)
 fs.append({'type':'Feature','properties':{'kind':kind,'type':typ,'certain':'certain' in typ,'concealed':'concealed' in typ},'geometry':mapping(geom)})
(ROOT/'lines.geojson').write_text(json.dumps({'type':'FeatureCollection','features':fs},separators=(',',':'))+'\n')
# Check continuous geology coverage over both terrain patches, without inventing
# geometry in gaps. All plot centers must fall in exactly one source unit.
plot_units={}
for site in ['sheep-camp','maguire-ridge']:
 pts=gpd.read_file(ROOT.parent/site/'plots.geojson');joined=gpd.sjoin(pts,polys,predicate='intersects');assert len(joined)==len(pts)==10
 plot_units[site]=dict(zip(joined['plot'],joined.PTYPE))
t=Transformer.from_crs(26710,4326,always_xy=True);t.transform(599277,4164599.8);op=t.get_last_used_operation()
metadata={'title':'Preliminary geologic map emphasizing bedrock formations in Alameda County, California','authors':'R. W. Graymer, D. L. Jones and E. E. Brabb','report':'USGS Open-File Report 96-252','year':1996,'source_url':'https://pubs.usgs.gov/of/1996/of96-252/','description_url':'https://pubs.usgs.gov/of/1996/of96-252/algeo.pdf','download_url':URL,'retrieved':'2026-10-14','source_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'source_detail_scale':50000,'source_crs':'EPSG:26710 (NAD27 / UTM 10N), determined from source grid controls','crs_validation':{'control_file':'al_quad.e00 AL_QUAD.TIC in https://pubs.usgs.gov/of/1996/of96-252/al_g1.tar.Z','controls_e_n_lon_lat':tics,'grid_residuals_m':checks},'transformation':op.description,'transformation_accuracy_m':op.accuracy,'output_crs':'EPSG:4326','bounds':bounds,'units':units,'plot_center_intersections':plot_units,'notes':['General geologic context at approximately 1:50,000 source detail. Contacts are not surveyed plot-scale boundaries.','Source mapped in 1996; newer mapping may exist. NGMDB shapefile conversion preserves the original data.','Geology is clipped to a rectangle surrounding both study sites. No simplification or imagery alignment was applied.','Most Quaternary deposits are combined into Qu. Most landslides are omitted.','Fault line type and location certainty are preserved; this layer does not describe present fault activity.','Descriptions summarize the original report and combine variation among assemblages; colors are atlas display colors, not official map symbols.','Mapped rock units do not measure soil depth, weathered-bedrock thickness or water-storage capacity.']}
(ROOT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(len(features),'unit polygons;',len(fs),'contacts and faults;',plot_units)
