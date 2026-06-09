import requests
import json
import pathlib
from shapely.geometry import mapping, shape, box as shapely_box

SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_50m_admin_0_countries.geojson"
)

OUTPUT_PATH = pathlib.Path(__file__).parent.parent / "app" / "data" / "world.geojson"

SIMPLIFY_TOLERANCE   = 0.1  # degrees - ~11km around Equator (was 0.5 = too aggressive)
COORDINATE_PRECISION = 4    # decimals - ~11km of precision, enough for web map

# Clip every geometry to stay strictly inside ±179.9° longitude.
# Countries like Russia, Fiji, Antarctica have vertices at exactly ±180° — D3 then
# tries to fill the complement of the polygon (everything *outside* the country),
# producing the large black shapes that cover the map.
ANTIMERIDIAN_CLIP = shapely_box(-179.9, -90.0, 179.9, 90.0)

def round_coordinates(geometry, precision):
    """Recursively round all coordinate floats in a GeoJSON geometry dict."""
    def _round(value):
        if isinstance(value, (int, float)):
            return round(value, precision)
        
        return [_round(v) for v in value]
    
    result = dict(geometry)
    result["coordinates"] = _round(geometry["coordinates"])
    return result

def simplify_feature(feature, tolerance):
    """Simplify a GeoJSON feature with Douglas-Peucker via Shapely.

    Returns a cleaned feature (only name + continent properties),
    or None if the geometry becomes empty after simplification.
    """
    try:
        geometry = shape(feature["geometry"])
        simplified = geometry.simplify(tolerance, preserve_topology=True)
        clipped   = simplified.intersection(ANTIMERIDIAN_CLIP)

        if clipped.is_empty:
            return None

        return {
            "type"       : "Feature",
            "properties" : {
                "name"      : feature["properties"].get("NAME", "Unknown"),
                "continent" : feature["properties"].get("CONTINENT", "Unknown")
            },
            "geometry": round_coordinates(mapping(clipped), COORDINATE_PRECISION)
        }

    except Exception as e:
        print(f"Warning : {e}")
        return None
    
def main():
    """Fetch Natural Earth 110m countries, simplify geometries, save to app/data/world.geojson."""
    print(f"Fetching {SOURCE_URL} ...")
    response = requests.get(SOURCE_URL, timeout=30)
    response.raise_for_status()
    print(f"  → fetch OK ({response.status_code})")

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