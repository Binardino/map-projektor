from fastapi.testclient import TestClient
from app.main import app
import json
import pathlib
import pytest

client = TestClient(app)

def test_index_returns_200():
    response = client.get("/")
    assert response.status_code == 200

def test_index_returns_html():
    response = client.get("/")
    assert "text/html" in response.headers["content-type"]

def test_static_css_served():
    response = client.get("/static/css/style.css")
    assert response.status_code == 200

def test_static_js_served():
    response = client.get("/static/js/map.js")
    assert response.status_code == 200

def test_geojson_endpoint_returns_200():
    if not pathlib.Path("app/data/world.geojson").exists():
        pytest.skip("file not generated yet")
    
    response = client.get("/data/world.geojson")
    assert response.status_code == 200

def test_geojson_is_valid_feature_collection():
    if not pathlib.Path("app/data/world.geojson").exists():
        pytest.skip("file not generated yet")
    
    data = json.loads(pathlib.Path("app/data/world.geojson").read_text())

    assert data['type'] == "FeatureCollection"
    assert len(data['features']) > 100
    first_entry = data["features"][0]
    assert "name" in first_entry["properties"]
    assert "continent" in first_entry["properties"]

        

