"""Guards the string dictionary: every key the code or markup asks for must exist in en.json,
otherwise the UI would show a raw key like "projection.mercator.name" (see t() in i18n.js)."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent.parent
EN = json.loads((ROOT / "static" / "i18n" / "en.json").read_text(encoding="utf-8"))
MAP_JS = (ROOT / "static" / "js" / "map.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")


def test_html_keys_exist():
    keys = re.findall(r'data-i18n(?:-html)?="([^"]+)"', INDEX_HTML)
    for attr_list in re.findall(r'data-i18n-attr="([^"]+)"', INDEX_HTML):
        keys += [pair.split(":")[1] for pair in attr_list.split(";")]
    assert keys, "no data-i18n attributes found — did the markup lose them?"
    assert [k for k in keys if k not in EN] == []


def test_literal_t_calls_exist():
    keys = re.findall(r'\bt\("([^"$`]+)"\)', MAP_JS)
    assert [k for k in keys if k not in EN] == []


def test_every_projection_and_view_has_its_texts():
    # Ids live in map.js; texts are built dynamically as projection.<id>.<field>, so check them by id.
    projections_src = MAP_JS[: MAP_JS.index("// SVG SETUP")]
    projection_ids = re.findall(r'^    id: "(\w+)",', projections_src, re.M)
    families = re.findall(r'^    family: "(\w+)",', projections_src, re.M)
    view_src = MAP_JS[MAP_JS.index("const RECENTER_PRESETS"):]
    view_ids = re.findall(r'\{ id: "(\w+)"', view_src[: view_src.index("];")])

    assert len(projection_ids) == 17 and view_ids
    expected = [f"projection.{i}.{f}" for i in projection_ids for f in ("name", "preserves", "distorts", "bestFor")]
    expected += [f"family.{f.lower()}" for f in families]
    expected += [f"view.{i}.{f}" for i in view_ids for f in ("name", "description")]
    assert [k for k in expected if k not in EN] == []
