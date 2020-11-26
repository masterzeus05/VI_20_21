import json
import pandas as pd
import numpy as np
import topojson as tp
import geopandas as gpd

with open('uk_test_2.json', 'r') as ukFile:
    js = gpd.read_file(ukFile)
    topo = tp.Topology(js)
    topo.to_geojson("uk_test_2.geo.json")