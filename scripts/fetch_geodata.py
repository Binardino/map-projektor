import requests
import json
import pathlib
from shapely.geometry import mapping, shape, box as shapely_box
from shapely.ops import unary_union

SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_50m_admin_0_countries.geojson"
)

# Natural Earth has no dedicated "forest" layer, but its physical regions
# dataset includes real mountain range polygons (Alps, Himalayas, Andes,
# Rockies...) via the FEATURECLA field — used for the terrain overlay.
# "Plateau" is deliberately excluded: it covers large elevated-but-flat
# regions (Brazilian Highlands, the Mexican Altiplano, Australia's Western
# Plateau...) that read as "100% mountain" on the map despite not being
# rugged terrain — confirmed visually, see CHANGELOG. Deserts have their
# own FEATURECLA too (Sahara, Gobi, Kalahari...). Tropical forests have no
# polygon of their own, so the two relevant "Basin" features (river
# drainage basins, not canopy) stand in as an approximation — picked by
# name rather than the whole Basin class, since most of it (Great Basin,
# Tarim Basin...) is arid, not forest.
TERRAIN_SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_50m_geography_regions_polys.geojson"
)
TERRAIN_FEATURECLASSES = {
    "Range/mtn": "mountain",
    "Desert":    "desert",
}
FOREST_BASIN_NAMES = {"AMAZON BASIN", "CONGO BASIN"}

OUTPUT_PATH = pathlib.Path(__file__).parent.parent / "app" / "data" / "world.geojson"
TERRAIN_OUTPUT_PATH = pathlib.Path(__file__).parent.parent / "app" / "data" / "terrain.geojson"

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

def fetch_terrain():
    """Fetch Natural Earth physical regions, keep mountains/deserts and the two
    named forest-basin proxies, dissolve same-kind polygons into one shape each,
    simplify, save with a "kind" property per feature."""
    print(f"Fetching {TERRAIN_SOURCE_URL} ...")
    response = requests.get(TERRAIN_SOURCE_URL, timeout=30)
    response.raise_for_status()
    print(f"  → fetch OK ({response.status_code})")

    data = response.json()

    geometries_by_kind = {}
    for raw in data["features"]:
        featurecla = raw["properties"].get("FEATURECLA")
        name       = raw["properties"].get("NAME")

        if featurecla in TERRAIN_FEATURECLASSES:
            kind = TERRAIN_FEATURECLASSES[featurecla]
        elif featurecla == "Basin" and name in FOREST_BASIN_NAMES:
            kind = "forest"
        else:
            continue

        geometries_by_kind.setdefault(kind, []).append(shape(raw["geometry"]))

    # Dissolve each kind's polygons into a single shape before simplifying.
    # Natural Earth splits real massifs into many adjacent/overlapping named
    # sub-ranges (e.g. dozens of individual Alps sub-massifs) — left as
    # separate features, their semi-transparent CSS fill stacks wherever
    # they overlap, showing up as visibly darker blotches instead of one
    # even color.
    simplified_features = []
    for kind, geometries in geometries_by_kind.items():
        merged     = unary_union(geometries)
        simplified = merged.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
        clipped    = simplified.intersection(ANTIMERIDIAN_CLIP)

        if clipped.is_empty:
            continue

        simplified_features.append({
            "type"       : "Feature",
            "properties" : {"kind": kind},
            "geometry"   : round_coordinates(mapping(clipped), COORDINATE_PRECISION),
        })

    dict_feature = {"type"     : "FeatureCollection",
                    "features" : simplified_features}

    TERRAIN_OUTPUT_PATH.write_text(json.dumps(dict_feature, separators=(",", ":")))

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

    fetch_terrain()

if __name__ == "__main__":
    main()