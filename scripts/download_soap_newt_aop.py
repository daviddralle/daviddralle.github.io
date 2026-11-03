#!/usr/bin/env python3
"""One-time download of pinned NEON airborne rasters through Earth Engine.

Requires earthengine-api, rasterio and existing authorized Earth Engine login.
No API tokens or temporary download URLs are saved. Daily updates use the
separate Pi runner and do not invoke this terrain-preparation script.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request
from datetime import datetime, timezone
import ee
import rasterio
from rasterio.merge import merge


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True, help='Existing Earth Engine project')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--visit', default='2026_SOAP_9', help='Pinned NEON visit asset id')
    args = parser.parse_args()
    ee.Initialize(project=args.project)
    args.output.mkdir(parents=True, exist_ok=True)
    for product, band in [('CHM', 'CHM'), ('DEM', 'DTM')]:
        asset = f'projects/neon-prod-earthengine/assets/{product}/001/{args.visit}'
        image = ee.Image(asset)
        metadata = image.getInfo()
        paths = []
        for x in [296000, 298000]:
            for y in [4100000, 4102000]:
                path = args.output / f'{band.lower()}_{args.visit}_{x}_{y}.tif'
                region = ee.Geometry.Rectangle([x,y,x+2000,y+2000], proj='EPSG:32611', geodesic=False)
                url = image.select(band).toFloat().getDownloadURL({
                    'region': region, 'crs': 'EPSG:32611', 'scale': 1, 'format': 'GEO_TIFF',
                })
                urllib.request.urlretrieve(url, path)
                paths.append(path)
        sources = [rasterio.open(p) for p in paths]
        try:
            values, transform = merge(sources, nodata=-9999)
            profile = sources[0].profile.copy()
            profile.update(width=values.shape[2], height=values.shape[1], transform=transform,
                           nodata=-9999, compress='deflate', tiled=True)
            mosaic_path = args.output / f'{band.lower()}_{args.visit}.tif'
            with rasterio.open(mosaic_path, 'w', **profile) as out:
                out.write(values)
        finally:
            for src in sources:
                src.close()
        metadata['download'] = {
            'accessed_at': datetime.now(timezone.utc).isoformat(),
            'bounds_utm11': [296000,4100000,300000,4104000],
            'resolution_m': 1, 'dtype': 'float32', 'band': band,
            'sha256': hashlib.sha256(mosaic_path.read_bytes()).hexdigest(),
            'note': 'Pinned NEON source visit; Earth Engine holdings may lag the NEON portal. No extrapolation into nodata.',
        }
        (args.output / f'{band.lower()}_{args.visit}.metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
        print(mosaic_path)

if __name__ == '__main__':
    main()
