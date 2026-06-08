from fastapi.testclient import TestClient
from app.main import app

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


