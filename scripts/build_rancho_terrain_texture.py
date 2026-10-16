"""Render a 1 m LiDAR hillshade texture independently of the 10 m scene mesh.

Source rasters remain external to the public website. Run after extending the
mesh context; the texture always uses the exact current terrain.json bounds.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
from scipy.ndimage import distance_transform_edt
from PIL import Image


def build_texture(dem_path, data):
    terrain = json.loads((data / 'terrain.json').read_text())
    x0, y0, x1, y1 = terrain['bounds']
    width, height = round(x1-x0), round(y1-y0)
    grid = np.full((height, width), np.nan, dtype=np.float32)
    with rasterio.open(dem_path) as dem:
        reproject(rasterio.band(dem, 1), grid, src_transform=dem.transform,
                  src_crs=dem.crs, dst_transform=from_bounds(x0,y0,x1,y1,width,height),
                  dst_crs=terrain['crs'], dst_nodata=np.nan,
                  resampling=Resampling.bilinear)
    missing = ~np.isfinite(grid)
    if missing.all():
        raise ValueError('No measured DEM cells within the scene extent')
    if missing.any():
        indices = distance_transform_edt(missing,return_distances=False,return_indices=True)
        grid[missing] = grid[tuple(indices[:,missing])]
    # Fill only for gradient calculation; the scene retains its measured-data mask.
    gy, gx = np.gradient(grid, (y1-y0)/height, (x1-x0)/width)
    light = np.clip((.65-gx*.5+gy*.5)/np.sqrt(1+gx*gx+gy*gy), .15, 1)
    gray = np.clip(180*(.3+.8*light),0,255).astype('uint8')
    Image.fromarray(gray).convert('RGB').save(data/'terrain-texture.jpg',quality=95)
    print(f'Terrain texture: {width} × {height}, 1 m LiDAR shading; mesh unchanged.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dem',type=Path,required=True)
    parser.add_argument('--data',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/rancho/atlas/data')
    args=parser.parse_args()
    build_texture(args.dem,args.data)
