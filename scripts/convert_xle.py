import sys
import pandas as pd
import numpy as np
import glob
import xmltodict
import os


def main():
	'''
	run python script like in bash command line: 
	`python convert_xle.py src dst`
	where src is the source folder with xle files
	dst is the destination folder where you'd like to store converted csvs
	'''
	argv = sys.argv[1:]
	src = argv[0]
	dst = argv[1]
	print('Reading xle files from %s'%src)
	print('Saving converted csv files to %s'%dst)
	fs = glob.glob(os.path.join(src, '*.xle'))
	for f in fs:
		with open(f) as fd:
			doc = xmltodict.parse(fd.read())
			numchannels = int(doc['Body_xle']['Instrument_info']['Channel'])
			serial = doc['Body_xle']['Instrument_info']['Serial_number']
			newcols = [doc['Body_xle']['Ch%d_data_header'%i]['Identification'] for i in range(1,numchannels+1)]
			units = [doc['Body_xle']['Ch%d_data_header'%i]['Unit'] for i in range(1,numchannels+1)]
			cols = ['ch%d'%i for i in range(1,numchannels+1)]
			temp = pd.DataFrame.from_dict(doc['Body_xle']['Data']['Log'])
			date = temp.Date.values
			time = temp.Time.values
			datetime = pd.to_datetime(date + ' ' + time)
			temp = temp[cols]
			temp[cols] = temp[cols].apply(pd.to_numeric, errors='coerce')
			temp.index = datetime
			temp.columns = newcols
			newf = serial + '_' + temp.index[-1].strftime('%Y-%m-%d') + '.csv'
			newf = os.path.join(dst, newf)
			if 'kPa' in units:
				mult = 0.101972*100.0
			else: 
				mult = 100
			temp['LEVEL'] = mult*temp['LEVEL']
			temp.to_csv(newf)
	print('Completed converting %d xles to csvs'%len(fs))

if __name__ == "__main__":
    main()