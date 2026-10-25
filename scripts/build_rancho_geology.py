"""Clip CGS's published Ukiah geology to regional context around Rancho.

Run with pyshp, shapely and pyproj. Keep the downloaded source ZIP outside
this public repository. No contacts are inferred, snapped or simplified.
"""
import argparse, hashlib, json, tempfile, zipfile
from pathlib import Path
import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping, box
from shapely.ops import transform, unary_union

SOURCE = 'https://www.conservation.ca.gov/cgs/Documents/Publications/Geologic-Atlas-Maps/GAM_24-Ukiah-1960-GIS.zip'
PAGE = 'https://www.conservation.ca.gov/cgs/publications/maps-data/rgm'
DESCRIPTIONS = {
    'Qal': dict(name='Recent alluvium', age='Recent (source terminology)', color='#dfc89c', description='Unconsolidated valley fill, including sand, conglomerate and breccia. The source groups these deposits as Recent Alluvium.'),
    'Ku': dict(name='Upper Cretaceous marine rocks', age='Late Cretaceous', color='#a9b89a', description='Marine sedimentary rocks, broadly grouped by age: sandstone, siltstone, shale and conglomerate. Individual beds and formations are not resolved by this regional layer.'),
    'Kl': dict(name='Lower Cretaceous marine rocks', age='Early Cretaceous', color='#b5afc3', description='Sandstone, shale and conglomerate of the source’s Shasta series, including Horsetown and Paskenta formations. The regional unit also includes detrital serpentine in the Wilbur Springs area.'),
}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-zip',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('field-sites/rancho/atlas/data/geology'))
    args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    # 2 km of regional context around the existing terrain, not a property line.
    bounds=[553720,4330490,559180,4337790]
    clip=box(*bounds)
    to_wgs=Transformer.from_crs(26910,4326,always_xy=True).transform
    output={}; areas=[]; source_crs=None
    with tempfile.TemporaryDirectory() as folder:
        with zipfile.ZipFile(args.source_zip) as archive: archive.extractall(folder)
        root=Path(folder)/'GAM_24-Ukiah-1960-GIS/GAM_24_Ukiah-simple'
        for name,key in [('MapUnitPolys','units'),('ContactsAndFaults','lines')]:
            path=root/(name+'.shp');crs=CRS.from_wkt(path.with_suffix('.prj').read_text());source_crs=crs.to_string()
            project=Transformer.from_crs(crs,26910,always_xy=True).transform
            source_clip=transform(Transformer.from_crs(26910,crs,always_xy=True).transform,clip)
            features=[]
            for i,record in enumerate(shapefile.Reader(str(path)).iterShapeRecords()):
                original=shape(record.shape.__geo_interface__)
                if not original.intersects(source_clip):continue
                geom=transform(project,original.intersection(source_clip))
                if geom.is_empty:continue
                p=record.record.as_dict()
                if key=='units':
                    code=p['MapUnit'];assert code in DESCRIPTIONS,code
                    props=dict(kind='geology',id=code,unit=code,source_id=i,source_name=p['Name'],source_age=p['Age'],identity_confidence=p['IdeConf'])
                    areas.append(geom)
                else:
                    props=dict(kind='geology-line',id=p['CAFs_ID'],type=p['Type'],concealed=p['IsCon']=='y',location_confidence_m=p['LocConfM'],identity_confidence=p['IdeConf'],existence_confidence=p['ExiConf'],symbol=p['Symbol'])
                features.append(dict(type='Feature',properties=props,geometry=mapping(transform(to_wgs,geom))))
            output[key]=dict(type='FeatureCollection',features=features)
    terrain=box(555720,4332490,557180,4335790)
    fraction=unary_union(areas).intersection(terrain).area/terrain.area
    assert fraction>.99999, fraction
    used=sorted({f['properties']['unit'] for f in output['units']['features']})
    metadata=dict(title='Geologic map of California, Ukiah sheet',authors='C. W. Jennings and R. G. Strand',report='CGS / CDMG GAM 24',year=1960,source_url=PAGE,download_url=SOURCE,description_url='https://www.conservation.ca.gov/cgs/Documents/Publications/Geologic-Atlas-Maps/GAM_24-Ukiah-1960-Explanation.pdf',retrieved='2026-10-24',source_sha256=hashlib.sha256(args.source_zip.read_bytes()).hexdigest(),source_crs=source_crs,output_crs='EPSG:4326',source_detail_scale=250000,bounds=list(transform(to_wgs,clip).bounds),clip_bounds_utm10=bounds,units={k:DESCRIPTIONS[k] for k in used},terrain_units=sorted({f['properties']['unit'] for f,g in zip(output['units']['features'],areas) if g.intersection(terrain).area>0}),processing='Source vectors clipped to a 2 km context margin around the terrain; transformed from supplied NAD83 / California Albers to WGS84. No simplification, snapping, inferred contacts or field-scale subdivision. Colors are atlas display colors. Source age terminology retained alongside readable age labels.',limitations='Regional context at 1:250,000. Contacts are generalized, not surveyed well or hillslope boundaries. This layer does not show weathering depth, groundwater, rock thickness or current fault activity.',qa=dict(terrain_coverage_fraction=round(fraction,9),unit_features=len(output['units']['features']),line_features=len(output['lines']['features'])))
    for name,data in output.items():(args.output/(name+'.geojson')).write_text(json.dumps(data,separators=(',',':'))+'\n')
    (args.output/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps(metadata['qa']),used)
if __name__=='__main__':main()
