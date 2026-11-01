"""The committed map data must keep the corrections the pipeline applies."""
import json
import pathlib
import sys

from shapely.geometry import Point, shape

ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from fetch_geodata import TERRITORY_CORRECTIONS  # noqa: E402


def test_territory_corrections_are_in_the_data():
    features = json.loads((ROOT / "app" / "data" / "world.geojson").read_text(encoding="utf-8"))["features"]
    for _, target, point in TERRITORY_CORRECTIONS:
        owners = [f["properties"]["name"] for f in features if shape(f["geometry"]).contains(Point(point))]
        assert owners == [target]
