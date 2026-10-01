"""Prepare NASA POWER grid-cell cache from its public bulk Zarr store.
Data preparation only: pip install numpy numcodecs (not app dependencies).
"""
import json, pathlib, urllib.request
import numpy as np
from numcodecs import get_codec

base = 'https://nasa-power.s3.us-west-2.amazonaws.com/merra2/spatial/power_merra2_climatology_spatial_lst.zarr/'
cache = pathlib.Path('.data/bulk')
cache.mkdir(parents=True, exist_ok=True)
def download(key):
    path = cache / key.replace('/', '_')
    if not path.exists():
        urllib.request.urlretrieve(base + key, path)
    return path.read_bytes()
metadata = json.loads(download('.zmetadata'))['metadata']
def array(name, chunk):
    spec = metadata[name + '/.zarray']
    decoded = get_codec(spec['compressor']).decode(download(name + '/' + chunk))
    for codec in reversed(spec.get('filters') or []):
        decoded = get_codec(codec).decode(decoded)
    return np.frombuffer(decoded, dtype=spec['dtype'])
months = array('time', '0').tolist()
assert sorted(months) == list(range(1, 14)), months
values = {}
for parameter in ['T2M', 'PRECTOTCORR']:
    values[parameter] = []
    for month in range(1, 13):
        values[parameter].append(array(parameter, f'{months.index(month)}.0.0'))
        print(parameter, month, flush=True)
cities = json.loads(pathlib.Path('public/data/cities.json').read_text(encoding='utf-8'))
destination = pathlib.Path('.data/power')
destination.mkdir(exist_ok=True)
names = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
for city in cities:
    # Same native nearest-cell rounding as the JS preparer; no interpolation.
    lat = np.floor(city['lat'] * 2 + .5) / 2
    lon = (np.floor((city['lng'] + 180) / .625 + .5) * .625) % 360 - 180
    index = int((lat + 90) * 2) * 576 + int((lon + 180) / .625)
    parameters = {p: dict(zip(names, [round(float(a[index]), 2) for a in values[p]])) for p in values}
    filename = destination / f'{lat:g}_{lon:g}.json'
    elevation = None
    if filename.exists():
        elevation = json.loads(filename.read_text())['geometry']['coordinates'][2]
    result = {'properties': {'parameter': parameters}, 'geometry': {'coordinates': [lon,lat,elevation]}}
    filename.write_text(json.dumps(result, allow_nan=False))
print('Prepared all city grid cells from NASA bulk climatology.')
