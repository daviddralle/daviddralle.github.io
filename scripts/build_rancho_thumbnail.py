#!/usr/bin/env python3
"""Render a field-atlas card from the native DEM and published map layers."""
import argparse
import json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from pyproj import Transformer
from PIL import Image, ImageDraw, ImageFont

ap=argparse.ArgumentParser()
ap.add_argument('--dem', type=Path, required=True)
ap.add_argument('--site', type=Path, default=Path(__file__).resolve().parents[1]/'field-sites/rancho')
a=ap.parse_args()
data=a.site/'atlas/data'
project=Transformer.from_crs(4326,26910,always_xy=True).transform
W,H=1200,750
cx,cy=project(-122.3475,39.1518)
span=900
bounds=(cx-span/2,cy-span*H/W/2,cx+span/2,cy+span*H/W/2)
with rasterio.open(a.dem) as dem:
    z=dem.read(1,window=from_bounds(*bounds,dem.transform),out_shape=(H,W),resampling=Resampling.bilinear)
gy,gx=np.gradient(z,span/W,span/W)
light=np.clip((.65-gx*.5+gy*.5)/np.sqrt(1+gx*gx+gy*gy),.15,1)
rgb=np.clip(np.array([165,183,158])[None,None,:]*(.35+.75*light[:,:,None]),0,255).astype('uint8')
im=Image.fromarray(rgb).convert('RGBA')
draw=ImageDraw.Draw(im,'RGBA')
def xy(ll):
    x,y=project(*ll[:2]);return ((x-bounds[0])/span*W,(bounds[3]-y)/span*W)
def features(name):return json.loads((data/name).read_text())['features']
for f in features('contours.geojson'):
    pts=[xy(p) for p in f['geometry']['coordinates']]
    if all(p[0]<0 for p in pts) or all(p[0]>W for p in pts) or all(p[1]<0 for p in pts) or all(p[1]>H for p in pts):continue
    draw.line(pts,fill=(35,47,38,125 if f['properties']['major'] else 55),width=2 if f['properties']['major'] else 1)
for f in features('channels.geojson'):
    for line in f['geometry']['coordinates'] if f['geometry']['type']=='MultiLineString' else [f['geometry']['coordinates']]:
        draw.line([xy(p) for p in line],fill=(136,211,225,230),width=3)
for f in features('catchments.geojson'):
    for ring in f['geometry']['coordinates']:draw.line([xy(p) for p in ring],fill=(209,243,178,255),width=3)
def font(size,serif=False):
    paths=[Path('/System/Library/Fonts/Supplemental')/('Georgia.ttf' if serif else 'Arial.ttf'),Path('/usr/share/fonts/truetype/dejavu')/('DejaVuSerif.ttf' if serif else 'DejaVuSans.ttf')]
    return ImageFont.truetype(str(next(p for p in paths if p.exists())),size)
for f in features('catchments.geojson'):
    if f['properties']['kind']!='catchment':continue
    x,y=xy(f['properties']['label_position'])
    if 50<x<W-50 and 180<y<H-50:
        label=f['properties']['id'];box=draw.textbbox((x,y),label,font=font(27,True),anchor='mm')
        draw.rounded_rectangle((box[0]-10,box[1]-7,box[2]+10,box[3]+7),radius=3,fill=(17,38,45,225))
        draw.text((x,y),label,font=font(27,True),fill='#edf3ee',anchor='mm')
for f in features('boreholes.geojson'):
    if not f['geometry']:continue
    x,y=xy(f['geometry']['coordinates']);color='#63dbea' if f['properties']['kind']=='well' else '#efbf73'
    draw.ellipse((x-5,y-5,x+5,y+5),fill=color,outline='#edf3ee',width=1)
draw.rectangle((0,0,W,145),fill=(17,38,45,240))
draw.text((40,24),'RANCHO VENADA',font=font(20),fill='#c0ec94')
draw.text((38,55),'Mountain House field atlas',font=font(44,True),fill='#edf3ee')
draw.text((40,113),'LiDAR contours · catchments · wells & piezometers',font=font(19),fill='#a6bbc0')
x,y=W-80,200
draw.line((x,y+55,x,y),fill='#edf3ee',width=3)
draw.polygon([(x,y),(x-7,y+15),(x+7,y+15)],fill='#edf3ee')
draw.text((x,y-18),'N',font=font(19),fill='#edf3ee',anchor='mm')
draw.rectangle((30,H-61,221,H-20),fill=(17,38,45,220))
draw.line((45,H-35,45+100/span*W,H-35),fill='#edf3ee',width=3)
draw.text((45,H-58),'100 m',font=font(17),fill='#edf3ee')
im.convert('RGB').save(a.site/'atlas/preview.webp',quality=90)
