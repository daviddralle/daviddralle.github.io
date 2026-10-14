"""Read source workbooks and cache public terrain catalog queries. No source edits."""
import json, os
from pathlib import Path
import xlrd
import requests
from openpyxl import load_workbook

source=Path(os.environ['SFPUC_SOURCE'])
work=Path(os.environ['SFPUC_WORK']);work.mkdir(parents=True,exist_ok=True)
for name in ['tree','plot','regeneration']:
    book=xlrd.open_workbook(source/f'{name}_data_drought_study.xls')
    result={s.name:[s.row_values(i) for i in range(s.nrows)] for s in book.sheets()}
    (work/f'{name}_data_drought_study.json').write_text(json.dumps(result))
rows=list(load_workbook(source/'SFPUC_Tree_Sampling_Measurement_Plan.xlsx',read_only=True,data_only=True)['Tree measurements'].values)
(work/'sampling-plan.json').write_text(json.dumps([dict(zip(rows[0],r)) for r in rows[1:] if r[0]]))
for site,bbox in [('sheep-camp','-121.873,37.596,-121.859,37.604'),('maguire-ridge','-121.856,37.545,-121.843,37.554')]:
    response=requests.get('https://tnmaccess.nationalmap.gov/api/v1/products',params={'datasets':'Digital Elevation Model (DEM) 1 meter','bbox':bbox,'max':30,'outputFormat':'JSON'},timeout=60)
    response.raise_for_status()
    (work/f'{site}-tnm.json').write_text(json.dumps(response.json(),indent=2))
print('Source extraction complete. Intermediate workbooks remain outside the public site.')
