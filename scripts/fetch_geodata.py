import requests
import json
import pathlib
from shapely.geometry import mapping, shape

SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_110m_admin_0_countries.geojson"
)

OUTPUT_PATH = pathlib.Path(__file__).parent.parent / "app" / "data" / "world.geojson"

SIMPLIFY_TOLERANCE   = 0.5 # degrees - ~55km around Equator
COORDINATE_PRECISION = 4   # decimals - ~11km of precision , enough for web map

def round_coordinates(geometry, precision):
    def _round(value):
        if isinstance(value, (int, float)):
            return round(value, precision)
        
        return [_round(v) for v in value]
    
    result = dict(geometry)
    result["coordinates"] = _round(geometry["coordinates"])
    return result

def simplify_feature(feature, tolerance):
    try:
        geometry = shape(feature["geometry"])
        simplified = geometry.simplify(tolerance, preserve_topology=True)

        if simplified.is_empty:
            return None
        
        return {
            "type"       : "Feature",
            "properties" : {
                "name"      : feature["properties"].get("NAME", "Unknown"),
                "continent" : feature["properties"].get("CONTINENT", "Unknown")
            },
            "geometry": round_coordinates(mapping(simplified), COORDINATE_PRECISION) 
        }

    except Exception as e:
        print(f"Warning : {e}")
        return None
    
def main():
    response = requests.get(SOURCE_URL, timeout=30)
    response.raise_for_status()
    
    data     = response.json()
    features = data["features"]

    simplified_features = []
    for raw in features:
        simp = simplify_feature(raw, SIMPLIFY_TOLERANCE)
        if simp is not None:
            simplified_features.append(simp)

    dict_feature = {"type"     : "FeatureCollection",
                    "features" : simplified_features}
    
    OUTPUT_PATH.write_text(json.dumps(dict_feature, separators=(",", ":")))

if __name__ == "__main__":
    main()