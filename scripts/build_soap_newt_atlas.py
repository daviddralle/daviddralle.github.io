#!/usr/bin/env python3
"""Build reproducible Soap–Newt atlas products from the external research archive.

Raw files remain external. Unknown borehole depths and current conditions remain
unknown; inferred outlet locations are explicitly labeled approximate. Requirements: numpy, rasterio, pyproj, shapely, contourpy, Pillow.
"""
import argparse, csv, hashlib, json, math
from datetime import datetime, timezone
from scipy.ndimage import distance_transform_edt
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds
from rasterio.transform import from_bounds, from_origin
from rasterio.features import geometry_mask, shapes
from pyproj import Transformer
from shapely.geometry import shape, mapping, Point, LineString, box
from shapely.ops import transform, unary_union
from PIL import Image
import contourpy

TO_LL = Transformer.from_crs(32611,4326,always_xy=True)
TO_XY = Transformer.from_crs(4326,32611,always_xy=True)
def rounded(v):
    if isinstance(v, float): return round(v,7)
    if isinstance(v,(list,tuple)): return [rounded(x) for x in v]
    if isinstance(v,dict): return {k:rounded(x) for k,x in v.items()}
    return v
def save(path,obj): path.write_text(json.dumps(rounded(obj),separators=(',',':'),allow_nan=False)+'\n')
def feat(g,**p): return {'type':'Feature','geometry':mapping(g),'properties':p}
def coll(fs): return {'type':'FeatureCollection','features':fs}
def num(v):
    try: return float(v)
    except (TypeError,ValueError): return None

def derive_channels(source_dem, out, clip, source_label):
    """Route the available DEM extent before clipping the display linework."""
    import tempfile
    from pysheds.grid import Grid
    with tempfile.TemporaryDirectory() as td:
        path=Path(td)/'routing-dem.tif'
        with rasterio.open(source_dem) as src:
            valid_source=src.read_masks(1)>0
            valid_extent=unary_union([shape(g) for g,value in shapes(valid_source.astype('uint8'),mask=valid_source,transform=src.transform)]).buffer(-5)
            clip=clip.intersection(valid_extent)
            a=src.read(1,out_shape=(src.height//5,src.width//5),resampling=Resampling.bilinear)
            aff=src.transform*src.transform.scale(src.width/a.shape[1],src.height/a.shape[0])
            with rasterio.open(path,'w',driver='GTiff',height=a.shape[0],width=a.shape[1],count=1,dtype='float32',crs=src.crs,transform=aff,nodata=src.nodata) as dst:dst.write(a,1)
        grid=Grid.from_raster(str(path));dem=grid.read_raster(str(path))
        filled=grid.resolve_flats(grid.fill_depressions(grid.fill_pits(dem)))
        fdir=grid.flowdir(filled);acc=grid.accumulation(fdir)
        net=grid.extract_river_network(fdir,acc>20000/abs(aff.a*aff.e))
        features=[]
        for f in net['features']:
            line=shape(f['geometry']).intersection(clip)
            if line.is_empty or line.length<30:continue
            features.append(feat(transform(TO_LL.transform,line.simplify(2)),name='DEM-derived drainage',type='derived drainage',threshold_ha=2,source=source_label,note='D8 paths from 5 m DEM resampling; not mapped channel banks or observed flow.'))
        save(out/'channels.geojson',coll(features))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source-root',type=Path,required=True,help='Soaproot_Providence archive root')
    ap.add_argument('--derive-channels',action='store_true',help='Rebuild D8 drainage using pysheds and the selected DEM before display clipping')
    ap.add_argument('--dem',type=Path,help='Optional documented 1 m terrain raster in EPSG:32611')
    ap.add_argument('--canopy',type=Path,help='Optional NEON canopy height raster')
    ap.add_argument('--aop-metadata',type=Path,help='NEON Earth Engine acquisition metadata JSON')
    ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/soap-newt/atlas/data')
    args=ap.parse_args(); gis=args.source_root/'GIS'; out=args.output;out.mkdir(parents=True,exist_ok=True)
    aop=json.loads(args.aop_metadata.read_text()) if args.aop_metadata else {}
    if (args.dem or args.canopy) and not aop:
        ap.error('--dem/--canopy require --aop-metadata with CHM and/or DTM Earth Engine image metadata')
    def acquisition(key):
        props=aop[key]['properties']
        date=datetime.fromtimestamp(props['system:time_start']/1000,timezone.utc).strftime('%Y-%m-%d')
        return f"{date}; {props['system:index']} ({props['PROVISIONAL_RELEASED'].lower()})"

    polygons=[]; watersheds=[]
    for site,name in [('Soap','soaprootcreek_boundary.geojson'),('Newt','newtcreek_boundary.geojson')]:
        data=json.loads((gis/name).read_text())
        assert data['crs']['properties']['name'].endswith('32611'), 'Unexpected source CRS'
        g=unary_union([shape(f['geometry']) for f in data['features']]);assert g.is_valid
        polygons.append(g)
        watersheds.append(feat(transform(TO_LL.transform,g.simplify(0.7)),name=site+' Creek',site=site,area_ha=round(g.area/10000,4),area_km2=round(g.area/1e6,6),source='GIS/'+name,note='Archived watershed delineation; original area measured before display simplification.'))
    save(out/'watersheds.geojson',coll(watersheds))
    b=unary_union(polygons).bounds
    xmin=math.floor((b[0]-250)/10)*10; ymin=math.floor((b[1]-250)/10)*10
    xmax=math.ceil((b[2]+250)/10)*10; ymax=math.ceil((b[3]+250)/10)*10
    clip=box(xmin,ymin,xmax,ymax)
    if args.derive_channels: derive_channels(args.dem or gis/'soaproot_dem.tif',out,clip,'NEON SOAP LiDAR DTM DP3.30024.001; '+acquisition('DTM') if args.dem else 'Archived GIS/soaproot_dem.tif; acquisition unknown')
    infrastructure=[]
    with (gis/'well_and_piezo_metadata - all holes.csv').open() as f:
        for r in csv.DictReader(f):
            if r['SITE']!='Soaproot':continue
            lon=num(r['LONGITUDE']);lat=num(r['LATITUDE'])
            if lon is None or lat is None:continue
            depth=num(r['FINAL DEPTH TO BOTTOM OF BOREHOLE FROM GROUND SURFACE AT TIME OF COMPLETION (M)'])
            infrastructure.append(feat(Point(lon,lat),name=r['HOLE ID'],type='borehole',site='Soap',depth_m=depth,original_drilled_depth_m=num(r['ORIGINAL DRILLED DEPTH (M)']),completion=r['COMPLETED AS'],drilled=r['DATE DRILLED'],source='GIS/well_and_piezo_metadata - all holes.csv',note='Completed depth below ground; missing completion depths remain unknown.'))
    for f in json.loads((gis/'newt_holes.geojson').read_text())['features']:
        infrastructure.append(feat(shape(f['geometry']),name=f['properties']['Title'],type='borehole',site='Newt',depth_m=None,source='GIS/newt_holes.geojson',surveyed=f['properties']['Date Created'],note='Archived averaged GPS position. Depth and completion not provided in this coordinate file; GPS averaging precision is not positional accuracy.'))
    for f in json.loads((gis/'soap_spears.geojson').read_text())['features']:
        infrastructure.append(feat(shape(f['geometry']),name='Spear · '+f['properties']['Nearest Well'],type='soil sensor',site='Soap',depth_m=None,source='GIS/soap_spears.geojson',note='Archived spear sensor position; installation depth and current status unverified.'))
    with (gis/'stream_gage_gps_soap.csv').open(encoding='utf-8-sig') as f:
        for r in csv.DictReader(f): infrastructure.append(feat(Point(float(r['long']),float(r['lat'])),name='Soap Creek stream gage',type='stream gage',site='Soap',depth_m=None,source='GIS/stream_gage_gps_soap.csv',note='Archived GPS position; current operating status unverified.'))
    # NEON tower location and dimensions are from official TOWER111206 metadata.
    infrastructure.append(feat(Point(-119.262197,37.033400),name='NEON SOAP flux tower',type='flux tower',site='SOAP',depth_m=None,tower_height_m=53.34,tower_width_m=2.82,source_ground_elevation_m=1209.8888,source='https://data.neonscience.org/api/v0/locations/TOWER111206',note='Official NEON tower location TOWER111206. Dimensions from DistZaxsTow and DistTowWidt; displayed ground elevation comes from the terrain raster.'))
    with rasterio.open(args.dem or gis/'soaproot_dem.tif') as src:
        assert src.crs.to_epsg()==32611 and src.res==(1.,1.)
        width=int(xmax-xmin);height=int(ymax-ymin)
        affine=from_origin(xmin,ymax,1,1)
        dem=np.full((height,width),np.nan,dtype='float32')
        reproject(rasterio.band(src,1),dem,src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,dst_transform=affine,dst_crs=src.crs,dst_nodata=np.nan,resampling=Resampling.nearest)
        for f in infrastructure:
            x,y=TO_XY.transform(*f['geometry']['coordinates'])
            elevation=next(src.sample([(x,y)]))[0]
            f['properties']['elevation_m']=round(float(elevation),2) if elevation!=src.nodata else None
        # 10 m node spacing, edge nodes at stated xmin/ymax. Bilinear source sampling.
        w=int((xmax-xmin)/10)+1;h=int((ymax-ymin)/10)+1
        grid=np.full((h,w),np.nan,dtype='float32')
        reproject(rasterio.band(src,1),grid,src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,dst_transform=from_origin(xmin-5,ymax+5,10,10),dst_crs=src.crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
    save(out/'infrastructure.geojson',coll(infrastructure))
    valid_dem=np.isfinite(dem)
    # Fill only the shading work array at footprint edges; preserve original masks/elevations.
    shade_dem=dem.copy()
    if not valid_dem.all():
        indices=distance_transform_edt(~valid_dem,return_distances=False,return_indices=True)
        shade_dem=dem[tuple(indices)]
    gy,gx=np.gradient(shade_dem)
    slope=np.arctan(np.sqrt(gx**2+gy**2));aspect=np.arctan2(-gx,gy)
    shade=np.zeros_like(dem)
    for az in [225,270,315,360]:
        a=np.deg2rad(az);alt=np.deg2rad(45)
        shade+=np.clip(np.sin(alt)*np.cos(slope)+np.cos(alt)*np.sin(slope)*np.cos(a-aspect),0,1)/4
    gray=np.uint8(np.clip(80+shade*175,0,255));rgba=np.stack([gray,gray,gray,np.uint8(np.isfinite(dem))*255],axis=-1)
    Image.fromarray(rgba).save(out/'terrain-texture.webp',quality=92)
    # Web-Mercator image so Leaflet's rectangular overlay has correct pixel alignment.
    wb=transform_bounds(32611,3857,xmin,ymin,xmax,ymax,densify_pts=21)
    ww=width;wh=round(height*(wb[3]-wb[1])/(wb[2]-wb[0])*width/height)
    wa=from_bounds(*wb,ww,wh);web=np.zeros((4,wh,ww),dtype='uint8')
    for k in range(4):
        reproject(rgba[:,:,k],web[k],src_transform=affine,src_crs=32611,dst_transform=wa,dst_crs=3857,resampling=Resampling.bilinear)
    Image.fromarray(np.moveaxis(web,0,-1)).save(out/'hillshade.webp',quality=90)
    ll=Transformer.from_crs(3857,4326,always_xy=True);west,south=ll.transform(wb[0],wb[1]);east,north=ll.transform(wb[2],wb[3]);bounds=[[south,west],[north,east]]
    elev=[round(float(v),2) if np.isfinite(v) else None for v in grid.ravel()]
    terrain={'crs':'EPSG:32611','width':w,'height':h,'xmin':xmin,'ymax':ymax,'xmax':xmax,'ymin':ymin,'cell_size':10,'node_convention':'row-major; node x=xmin+column*cell_size, y=ymax-row*cell_size','elevations':elev,'min_elevation_m':round(float(np.nanmin(grid)),2),'max_elevation_m':round(float(np.nanmax(grid)),2),'bounds':bounds,'texture':'terrain-texture.webp','texture_extent_utm':[xmin,ymin,xmax,ymax],'source_resolution_m':1,'display_grid_spacing_m':10,'vertical_datum':'Not documented in archived raster','source':'GIS/soaproot_dem.tif'}
    save(out/'terrain.json',terrain)
    # Contours use the native 1m DEM, simplified only after extraction.
    con=contourpy.contour_generator(x=np.arange(width)+xmin+.5,y=ymax-np.arange(height)-.5,z=np.ma.masked_invalid(dem))
    contours=[]
    for elevation in range(math.ceil(float(np.nanmin(dem))/10)*10,math.floor(float(np.nanmax(dem))/10)*10+1,10):
        for points in con.lines(elevation):
            if len(points)<2:continue
            line=LineString(points)
            if line.length<25:continue
            contours.append(feat(transform(TO_LL.transform,line.simplify(1)),elevation_m=elevation,index=elevation%50==0,source=('10 m contours from NEON SOAP 1 m DTM; '+acquisition('DTM')) if args.dem else '10 m contours from archived 1 m DEM'))
    save(out/'contours.geojson',coll(contours))
    source_names=['soaproot_dem.tif','soaprootcreek_boundary.geojson','newtcreek_boundary.geojson','well_and_piezo_metadata - all holes.csv','newt_holes.geojson','soap_spears.geojson','stream_gage_gps_soap.csv']
    manifest={'compiled':'2026-11-03','bounds':bounds,'hillshade_bounds':bounds,'crs':'EPSG:32611','dem_source':'Archived 1 m Soaproot DEM (GIS/soaproot_dem.tif)','dem_acquisition':'Not documented in archived raster','vertical_datum':'Not documented in archived raster','hillshade_resolution_m':1,'terrain_grid_spacing_m':10,'watersheds':[f['properties'] for f in watersheds],'mapped_boreholes':sum(f['properties']['type']=='borehole' for f in infrastructure),'mapped_infrastructure':len(infrastructure),'known_completed_depths':sum(f['properties'].get('depth_m') is not None for f in infrastructure),'contours':{'interval_m':10,'index_interval_m':50,'count':len(contours)},'canopy':{'available':False,'status':'unavailable','reason':'NEON canopy product metadata lists SOAP acquisitions, but file API returns 403 without a token; no synthetic canopy is displayed.','product':'DP3.30015.001','url':'https://data.neonscience.org/data-products/DP3.30015.001'},'sources':[{'path':'GIS/'+n,'sha256':hashlib.sha256((gis/n).read_bytes()).hexdigest()} for n in source_names],'notes':['Watershed names follow the user; archived Soap boundary filename is soaprootcreek_boundary.geojson.','Source boundaries use projected EPSG:32611 coordinates and are explicitly transformed to WGS84.','Only Soap and Newt records included; Providence is a separate site.','Borehole coordinates and completion metadata are archival; no assertion of current instrument operation.','Completed depths and original drilled depths are separate. No shaft is inferred where completed depth is absent.','Burn outline omitted: its shapefile has no CRS or attributes identifying acquisition or fire.','NEON tower position and dimensions are from official location TOWER111206. The terrain elevation is not shifted to match source ground elevation.','All terrain elevations are taken from the original raster without vertical offsets. The raster acquisition date and vertical datum remain unknown.']}
    if args.dem:
        manifest['dem_source']='NEON SOAP LiDAR DTM, DP3.30024.001; Earth Engine DEM/001'
        manifest['dem_acquisition']=acquisition('DTM')
        manifest['vertical_datum']='See NEON DP3.30024.001 documentation; no vertical conversion applied'
        manifest['notes'][-1]='Terrain elevations use NEON DTM directly with no offsets. Acquisition: '+acquisition('DTM')
        manifest['sources'].append({'path':args.dem.name,'sha256':hashlib.sha256(args.dem.read_bytes()).hexdigest(),'url':'https://data.neonscience.org/data-products/DP3.30024.001'})
        terrain.update(source=manifest['dem_source'],acquisition=manifest['dem_acquisition'],vertical_datum=manifest['vertical_datum'])
        save(out/'terrain.json',terrain)
    if args.canopy:
        chm=np.full((height,width),np.nan,dtype='float32');cg=np.full((h,w),np.nan,dtype='float32')
        with rasterio.open(args.canopy) as src:
            reproject(rasterio.band(src,1),chm,src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,dst_transform=affine,dst_crs=32611,dst_nodata=np.nan,resampling=Resampling.nearest)
            reproject(rasterio.band(src,1),cg,src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,dst_transform=from_origin(xmin-5,ymax+5,10,10),dst_crs=32611,dst_nodata=np.nan,resampling=Resampling.nearest)
        valid=np.isfinite(chm)&(chm>=0)&(chm<100)
        chm[~valid]=np.nan;cg[(cg<0)|(cg>=100)]=np.nan
        t=np.nan_to_num(np.clip(chm/40,0,1))
        colors=np.stack([np.uint8(214-187*t),np.uint8(228-131*t),np.uint8(160-99*t),np.uint8(valid&(chm>=1))*210],axis=-1)
        cw=np.zeros((4,wh,ww),dtype='uint8')
        for k in range(4):reproject(colors[:,:,k],cw[k],src_transform=affine,src_crs=32611,dst_transform=wa,dst_crs=3857,resampling=Resampling.nearest)
        Image.fromarray(np.moveaxis(cw,0,-1)).save(out/'canopy.webp',quality=90)
        canopy={'crs':'EPSG:32611','width':w,'height':h,'xmin':xmin,'ymax':ymax,'cell_size':10,'bounds':bounds,'heights':[round(float(v),2) if np.isfinite(v) else None for v in cg.ravel()],'ground_elevations':elev,'source':'NEON SOAP CHM DP3.30015.001; Earth Engine CHM/001','acquisition':acquisition('CHM'),'sampling':'One nearest 1 m CHM sample at each 10 m terrain node; represents canopy surface, not individual trees.','max_height_m':round(float(np.nanmax(chm)),2),'coverage_fraction':round(float(valid.mean()),4)}
        save(out/'canopy.json',canopy)
        manifest['canopy']={'available':True,'image':'canopy.webp','grid':'canopy.json','bounds':bounds,'description':'NEON airborne LiDAR canopy height above ground; '+acquisition('CHM'),'status':'available','source':canopy['source'],'acquisition':canopy['acquisition'],'source_resolution_m':1,'display_grid_spacing_m':10,'height_units':'metres above ground','coverage_fraction':canopy['coverage_fraction'],'max_height_m':canopy['max_height_m'],'url':'https://data.neonscience.org/data-products/DP3.30015.001','note':'Provisional data. Canopy surface samples are not tree counts or stem locations; heights under 1 m are transparent.'}
        manifest['sources'].append({'path':args.canopy.name,'sha256':hashlib.sha256(args.canopy.read_bytes()).hexdigest(),'url':manifest['canopy']['url']})
    if args.aop_metadata:
        save(out/'aop-metadata.json',aop)
        manifest['aop_metadata']='aop-metadata.json'
    if (out/'channels.geojson').exists():
        channel_features=json.loads((out/'channels.geojson').read_text())['features']
        manifest['channels']={'source':channel_features[0]['properties']['source'] if channel_features else 'No derived lines','routing_resolution_m':5,'method':'D8 routing with pit/depression filling and flat resolution; 2 ha contributing-area threshold. Full available raster routed before display clipping; linework clipped 5 m inside the valid raster footprint.','count':len(channel_features),'note':'Terrain-derived potential drainage; not surveyed stream positions, channel widths, or current streamflow. Display elevations remain unchanged by routing fills. No flow is inferred across source nodata.'}
    manifest['terrain_coverage_fraction']=round(float(np.isfinite(dem).mean()),6)
    for record,polygon in zip(manifest['watersheds'],polygons):
        inside=geometry_mask([mapping(polygon)],out_shape=dem.shape,transform=affine,invert=True)
        good=inside&np.isfinite(dem)
        record['terrain_coverage_fraction']=round(float(good.sum()/inside.sum()),6)
        record['min_elevation_m']=round(float(np.min(dem[good])),2)
        record['max_elevation_m']=round(float(np.max(dem[good])),2)
        if args.canopy:
            record['canopy_coverage_fraction']=round(float((inside&valid).sum()/inside.sum()),6)
    save(out/'manifest.json',manifest)
    from build_soap_newt_gages import update_gages
    infrastructure=update_gages(out)
    print(json.dumps({'bounds':bounds,'terrain':[w,h],'infrastructure':len(infrastructure),'contours':len(contours),'coverage':float(np.isfinite(dem).mean())}))
if __name__=='__main__':main()
