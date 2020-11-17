import json
import pandas as pd
import numpy as np
from shapely.geometry import shape, Point
from tqdm import tqdm

js = None
with open('uk.geo.json', 'r') as ukFile:
    js = json.load(ukFile)

counties_problems = set()

def getCountyId(longitude, latitude, pbar):
    global counties_problems
    subunits = js['features']
    for feature in subunits:
        properties = feature['properties']
        print(properties)
        polygon = shape(feature['geometry'])
        point = Point(longitude, latitude)

        try:
            if polygon.contains(point):
                # print('Found containing polygon:', properties['name'], "- id:", properties['cartodb_id'])
                pbar.update(1)
                return properties['cartodb_id']
        except:
            counties_problems.add(properties['name'])
            pass

    pbar.update(1)
    return -1

with open('accidents_mini.csv', 'r') as dataFile:
    dataset = pd.read_csv(dataFile, sep=';')
    # print(dataset.head())

    # print(len(dataset))
    # dataset['county_id'] = getCountyId(dataset.Latitude, dataset.Longitude)
    # dataset.apply(lambda accident: getCountyId(accident))
    pbar = tqdm(total=len(dataset))
    dataset['county_id'] = np.vectorize(getCountyId)(dataset['Longitude'], dataset['Latitude'], pbar)
    # print(dataset.iloc[dataset.columns, 'county_id'])
    pbar.close()
    print(counties_problems)

    dataset.to_csv("accidents_mini_with_county3.csv", sep=';')
