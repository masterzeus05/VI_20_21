import json
import pandas as pd

js = None
with open('uk_test.json', 'r') as ukFile:
    js = json.load(ukFile)


def getArrayCounties():
    counties = list()

    subunits = js['features']
    for feature in subunits:
        properties = feature['properties']
        counties.append([properties['LAD13NM'], properties['LAD13CDO']])

    return counties


df = pd.DataFrame(getArrayCounties(), columns=['name', 'id'])
df.to_csv("list_counties.csv", index=False, sep=';')
