import pathlib

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Resolve paths relative to this file so the app works from any working directory
BASE_DIR = pathlib.Path(__file__).parent
ROOT_DIR = BASE_DIR.parent

app = FastAPI(title="Map Projektor Universal Converter")

templates = Jinja2Templates(directory= ROOT_DIR / "templates")

app.mount("/static", StaticFiles(directory= ROOT_DIR / "static"), name="static")

@app.get('/')
async def return_index(request : Request): 
    return templates.TemplateResponse(request, "index.html")

@app.get("/data/world.geojson")
async def world_geojson():
    """
    Serve the pre-processed world GeoJSON file.

    This file is generated once by scripts/fetch_geodata.py.
    It contains simplified country geometries with NAME and CONTINENT properties.
    """
    geojson_path = BASE_DIR / "data" / "world.geojson"
    return FileResponse(geojson_path, media_type="application/json")

@app.get("/data/terrain.geojson")
async def terrain_geojson():
    """
    Serve the pre-processed mountain range/plateau GeoJSON file.

    This file is generated once by scripts/fetch_geodata.py.
    It contains simplified Natural Earth physical-region geometries
    (FEATURECLA "Range/mtn" and "Plateau") for the terrain overlay.
    """
    geojson_path = BASE_DIR / "data" / "terrain.geojson"
    return FileResponse(geojson_path, media_type="application/json")
