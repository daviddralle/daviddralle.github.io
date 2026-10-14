"""Crop USGS 1 m terrain; derive Web Mercator hillshade and 2 m contours."""
import json, math, os
from pathlib import Path
import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.warp import transform_bounds, calculate_default_transform, reproject, Resampling
from scipy.ndimage import gaussian_filter
from skimage.measure import find_contours
from shapely.geometry import LineString, mapping
from pyproj import Transformer
from PIL import Image

ROOT=Path(os.environ['SFPUC_WORK'])
OUT=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data'
OUT.mkdir(parents=True,exist_ok=True)
SITES={'sheep-camp':[-121.873,37.596,-121.859,37.604], 'maguire-ridge':[-121.856,37.545,-121.843,37.554]}
for site,bbox in SITES.items():
    dest=OUT/site;dest.mkdir(exist_ok=True)
    items=[i for i in json.loads((ROOT/f'{site}-tnm.json').read_text())['items'] if 'CA_AlamedaCounty_2021_B21' in i['title']]
    tif=dest/'terrain.tif'
    if not tif.exists():
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',GDAL_HTTP_TIMEOUT='50'):
            sources=[rasterio.open(i['downloadURL']) for i in items]
            crs=sources[0].crs
            bounds=transform_bounds('EPSG:4326',crs,*bbox)
            bounds=[math.floor(bounds[0]), math.floor(bounds[1]), math.ceil(bounds[2]), math.ceil(bounds[3])]
            print(site,'cropping',crs,bounds,flush=True)
            a,tr=merge(sources,bounds=bounds,res=1,nodata=-9999,dtype='float32')
            profile=sources[0].profile.copy();profile.update(driver='GTiff',width=a.shape[2],height=a.shape[1],transform=tr,compress='deflate',nodata=-9999,count=1)
            with rasterio.open(tif,'w',**profile) as dst:dst.write(a)
            for src in sources:src.close()
    with rasterio.open(tif) as src:
        z=src.read(1);valid=(z!=src.nodata)&np.isfinite(z);tr=src.transform;crs=src.crs
        print(site,'valid',float(valid.mean()),'range',float(z[valid].min()),float(z[valid].max()),flush=True)
        # Mask-preserving smoothing; no contours bridge missing cells.
        weights=gaussian_filter(valid.astype(float),1)
        smooth=gaussian_filter(np.where(valid,z,0),1)/np.maximum(weights,1e-9)
        gy,gx=np.gradient(smooth)
        # Average NW, W, NE illumination for readable ridges and valleys.
        shade=np.zeros(z.shape)
        for az in [270,315,360]:
            az=math.radians(az);alt=math.radians(45)
            shade+=np.maximum(0,(-gx*math.sin(az)+gy*math.cos(az))*math.cos(alt)+math.sin(alt))/np.sqrt(1+gx*gx+gy*gy)/3
        gray=np.uint8(np.clip(55+shade*195,0,255))
        wt,ww,wh=calculate_default_transform(crs,'EPSG:3857',src.width,src.height,*src.bounds)
        rgba=np.zeros((wh,ww,4),dtype=np.uint8)
        for c in range(3):reproject(gray,rgba[:,:,c],src_transform=tr,src_crs=crs,dst_transform=wt,dst_crs='EPSG:3857',resampling=Resampling.bilinear)
        reproject(valid.astype('uint8')*255,rgba[:,:,3],src_transform=tr,src_crs=crs,dst_transform=wt,dst_crs='EPSG:3857',resampling=Resampling.nearest)
        Image.fromarray(rgba).save(dest/'hillshade.webp',quality=90)
        west,south,east,north=transform_bounds('EPSG:3857','EPSG:4326',wt.c,wt.f+wh*wt.e,wt.c+ww*wt.a,wt.f)
        to_ll=Transformer.from_crs(crs,4326,always_xy=True)
        features=[]
        for level in range(math.ceil(z[valid].min()/2)*2,math.floor(z[valid].max()/2)*2+1,2):
            for line in find_contours(smooth,level,mask=valid):
                if len(line)<8:continue
                xy=[tr*(col+.5,row+.5) for row,col in line]
                geom=LineString(xy).simplify(.4,preserve_topology=False)
                if geom.length<10:continue
                coords=[list(to_ll.transform(x,y)) for x,y in geom.coords]
                features.append({'type':'Feature','properties':{'elevation_m':level,'index':level%10==0},'geometry':{'type':'LineString','coordinates':[[round(x,7),round(y,7)] for x,y in coords]}})
        (dest/'contours.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
        meta={'resolution_m':1,'crs':str(crs),'vertical_datum':'NAVD88; meters','project':'CA_AlamedaCounty_2021_B21','acquisition_note':'Alameda County 2019–2021 collections; exact acquisition date at each site not established.','image_bounds':[[south,west],[north,east]],'valid_fraction':float(valid.mean()),'elevation_range_m':[float(z[valid].min()),float(z[valid].max())],'contour_interval_m':2,'contour_smoothing_sigma_m':1,'contour_simplification_m':.4,'sources':[{k:i[k] for k in ['title','downloadURL','metaUrl']} for i in items]}
        (dest/'terrain.json').write_text(json.dumps(meta,indent=2))
        print(site,len(features),'contours',flush=True)
