import json
import pandas as pd
import numpy as np
from shapely.geometry import shape, Point
from tqdm import tqdm
import sys
import math

js = None
with open('uk_test.json', 'r') as ukFile:
    js = json.load(ukFile)

counties_problems = set()


def getCountyId(longitude, latitude, pbar):
    global counties_problems
    subunits = js['features']
    for feature in subunits:
        properties = feature['properties']
        polygon = shape(feature['geometry'])
        point = Point(longitude, latitude)

        try:
            if polygon.contains(point):
                # print('Found containing polygon:', properties['name'], "- id:", properties['cartodb_id'])
                pbar.update(1)
                return properties['LAD13NM']
        except:
            counties_problems.add(properties['LAD13NM'])
            pass

    pbar.update(1)
    return "NaN"

with open('accidents.csv', 'r') as dataFile:
    dataset = pd.read_csv(dataFile, sep=';')
    print(len(dataset))

    step = math.floor(len(dataset)/4)
    # step = 2000
    index = int(sys.argv[1]) # 1 to 4

    print("Index:", str(index))

    start = step * (index - 1)
    end = step * index
    print(start, end)

    dataset = dataset.iloc[start:end]
    
    pbar = tqdm(total=step)
    dataset['county'] = np.vectorize(getCountyId)(dataset['Longitude'], dataset['Latitude'], pbar)
    pbar.close()
    dataset.to_csv("accidents_with_county" + str(index) + ".csv", sep=';')

    print(counties_problems)
