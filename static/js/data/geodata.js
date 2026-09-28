import { TERRAIN_GEOJSON_URL, WORLD_GEOJSON_URL } from "../config.js";

// The country and terrain GeoJSON: fetched once at boot, then only read.
// Not part of the store — it never changes and is far too large to freeze
// or diff. Live bindings: null until loadGeodata() resolves.
export let worldData = null;
export let terrainData = null;

export async function loadGeodata() {
  const [worldResponse, terrainResponse] = await Promise.all([
    fetch(WORLD_GEOJSON_URL),
    fetch(TERRAIN_GEOJSON_URL),
  ]);
  worldData = await worldResponse.json();
  terrainData = await terrainResponse.json();
}
