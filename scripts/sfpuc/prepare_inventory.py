"""Compile the two requested sites without altering the source workbooks."""
import csv, hashlib, json, re, collections, os, xml.etree.ElementTree as E
from pathlib import Path
from pyproj import Geod,Transformer
import rasterio

ROOT=Path(os.environ['SFPUC_WORK'])
SRC=Path(os.environ['SFPUC_SOURCE'])
OUT=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data'
ns={'k':'http://www.opengis.net/kml/2.2'}
geod=Geod(ellps='WGS84')
def records(kind):
    rows=json.loads((ROOT/f'{kind}_data_drought_study.json').read_text())[f'{kind}_data_drought_study']
    return [dict(zip(rows[0],r)) for r in rows[1:]]
trees={d['tree_id']:d for d in records('tree') if d['location_name'] in ['MN','SCN']}
plots={}
for d in records('plot'):
    site=re.sub(r'\d','',d['location_name']).upper()
    if site in ['MN','SCN']:
        key=f"{site}.{int(d['plot_number'])}"
        assert key not in plots
        plots[key]=d
regen={}
for d in records('regeneration'):
    site=re.sub(r'\d','',d['location_name']).upper()
    if site in ['MN','SCN']:regen[f"{site}.{int(d['plot_number'])}"]=d
plans={d['Tree ID']:d for d in json.loads((ROOT/'sampling-plan.json').read_text())}
assert len(plans)==36 and all(k in trees for k in plans)
species={'quercus_agrifolia':'Coast live oak','quercus_lobata':'Valley oak','quercus_douglasii':'Blue oak','aesculus_californica':'California buckeye','other':'Other / uncertain'}
data={'MN':{'trees':[],'plots':[],'boundaries':[],'regeneration':[]},'SCN':{'trees':[],'plots':[],'boundaries':[],'regeneration':[]}}
errors=[]
for folder in E.parse(SRC/'SFPUC_tree_plot_map.kml').getroot().findall('.//k:Folder',ns):
    kind={'Trees':'trees','Plot centers':'plots','Plot boundaries':'boundaries'}[folder.findtext('k:name',namespaces=ns)]
    for p in folder.findall('k:Placemark',ns):
        d={e.attrib['name']:e.findtext('k:value',namespaces=ns) or '' for e in p.findall('k:ExtendedData/k:Data',ns)}
        key=d.get('plot_id',d.get('plot_key'));site=key.split('.')[0]
        if site not in data:continue
        name=p.findtext('k:name',namespaces=ns)
        coords=[[float(v) for v in pt.split(',')[:2]] for pt in p.findtext('.//k:coordinates',namespaces=ns).split()]
        geom={'type':'Polygon','coordinates':[coords]} if kind=='boundaries' else {'type':'Point','coordinates':coords[0]}
        pr=plots[key]
        acc=float(re.search(r'Horizontal Accuracy:([\d.]+)',pr['plot_location'])[1])
        d.update(id=name,site=site,plot=key,kind=kind,source='SFPUC_tree_plot_map.kml',gps_accuracy_m=acc)
        if kind=='trees':
            raw=trees[name]
            assert raw['location_name']==site and int(raw['plot_number'])==int(key.split('.')[1])
            for col,kmlcol in [('dbh_cm','dbh_cm'),('azimuth','azimuth_degrees'),('distance_m','distance_from_center_m'),('tree_tag_number','tree_tag_number')]:
                assert float(raw[col])==float(d[kmlcol]),(name,col)
            assert raw['status']==d['status'] and raw['entered_species']==d['entered_species']
            lon,lat,_=geod.fwd(float(pr['longitude']),float(pr['latitude']),float(raw['azimuth']),float(raw['distance_m']))
            err=geod.inv(lon,lat,*coords[0])[2];errors.append(err)
            assert err<.06,(name,err)
            d.update(species=species.get(d['entered_species'],d['entered_species']),record_date=raw['CREATED_DATE'][:10],dbh_cm=float(d['dbh_cm']),azimuth_degrees=float(d['azimuth_degrees']),distance_from_center_m=float(d['distance_from_center_m']),tree_tag_number=str(int(raw['tree_tag_number'])),inventory_source='tree_data_drought_study.xls',position_note='Calculated from plot GPS, clockwise azimuth from north and distance; azimuth reference and slope-distance correction not documented. No imagery alignment applied.',in_sampling_plan=name in plans)
            if name in plans:
                d['sampling_plan']=plans[name]
                assert float(plans[name]['DBH (cm)'])==d['dbh_cm']
                assert plans[name]['Status'].lower()==d['status']
        else:
            assert abs(float(pr['latitude'])-float(d['latitude']))<1e-7 and abs(float(pr['longitude'])-float(d['longitude']))<1e-7
            d.update(radius_m=float(d['mapped_radius_m']),record_date=pr['CREATED_DATE'][:10],inventory_source='plot_data_drought_study.xls',slope_recorded=pr['slope'],aspect_degrees=pr['aspect_degrees'],gps_elevation_m=pr['elevation_m'],position_note='Recorded plot GPS; reported horizontal accuracy is a device estimate, not a validated confidence radius.')
            if kind=='plots' and key in regen:
                r=regen[key]
                rp={'id':key+' regeneration','site':site,'plot':key,'kind':'regeneration','source':'regeneration_data_drought_study.xls','record_date':r['CREATED_DATE'][:10],'notes':r['notes'],'position_note':'Plot-level regeneration record shown at plot center; individual seedlings were not positioned. Report describes a 5 square meter subplot.'}
                for c,v in r.items():
                    if c.startswith(('all_','total_count_','sc1_other','sc2_other')):rp[c]=v
                data[site]['regeneration'].append({'type':'Feature','geometry':geom,'properties':rp})
        data[site][kind].append({'type':'Feature','geometry':geom,'properties':d})

catalog={'built':'2026-10-14','inventory_year':2022,'sites':[],'source_files':[]}
qa={'tree_count':len(trees),'sampling_plan_count':len(plans),'max_geodesic_check_difference_m':max(errors),'sites':{}}
for code,slug,name in [('SCN','sheep-camp','Sheep Camp'),('MN','maguire-ridge','Maguire Ridge')]:
    dest=OUT/slug;dest.mkdir(parents=True,exist_ok=True)
    ds=data[code]
    with rasterio.open(dest/'terrain.tif') as terrain:
        t=Transformer.from_crs(4326,terrain.crs,always_xy=True)
        for kind,features in ds.items():
            for f in features:
                if f['geometry']['type']=='Point':
                    xy=t.transform(*f['geometry']['coordinates']);z=float(next(terrain.sample([xy]))[0]);assert z!=terrain.nodata
                    f['properties']['lidar_ground_elevation_m']=round(z,2)
            (dest/f'{kind}.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'),ensure_ascii=False))
    assert len(ds['trees'])==len([t for t in trees.values() if t['location_name']==code])
    ll=[f['geometry']['coordinates'] for f in ds['trees']]
    counts={k:len(v) for k,v in ds.items()}
    counts['sampling_plan']=sum(f['properties']['in_sampling_plan'] for f in ds['trees'])
    counts['recorded_dead']=sum(f['properties']['status']=='dead' for f in ds['trees'])
    qa['sites'][code]={'counts':counts,'missing_regeneration':[k for k in plots if k.startswith(code+'.') and k not in regen],'outside_nominal_plot_radius':[f['properties']['id'] for f in ds['trees'] if f['properties']['distance_from_center_m']>12.6],'gps_accuracy_m':collections.Counter(str(f['properties']['gps_accuracy_m']) for f in ds['plots'])}
    catalog['sites'].append({'id':slug,'code':code,'name':name,'full_name':name+' North','counts':counts,'bounds':[[min(p[1] for p in ll),min(p[0] for p in ll)],[max(p[1] for p in ll),max(p[0] for p in ll)]],'terrain':json.loads((dest/'terrain.json').read_text())})
    fields=['id','site','plot','tree_tag_number','species','entered_species','status','dbh_cm','record_date','crown_condition_rating','azimuth_degrees','distance_from_center_m','gps_accuracy_m','lidar_ground_elevation_m','in_sampling_plan','longitude','latitude','position_note']
    with (dest/'trees.csv').open('w',newline='') as out:
        w=csv.DictWriter(out,fieldnames=fields,extrasaction='ignore',lineterminator='\n');w.writeheader()
        for f in ds['trees']:w.writerow(dict(f['properties'],longitude=f['geometry']['coordinates'][0],latitude=f['geometry']['coordinates'][1]))
for filename in ['SFPUC_tree_plot_map.kml','tree_data_drought_study.xls','plot_data_drought_study.xls','regeneration_data_drought_study.xls','SFPUC_Tree_Sampling_Measurement_Plan.xlsx','SFPUC_DROUGHT_REPORT_2022.pdf']:
    catalog['source_files'].append({'name':filename,'sha256':hashlib.sha256((SRC/filename).read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps(catalog,indent=2))
(OUT/'qa.json').write_text(json.dumps(qa,indent=2))
print(json.dumps(qa,indent=2))
