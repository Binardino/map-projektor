"""Guards the string dictionary: every key the code or markup asks for must exist in en.json,
otherwise the UI would show a raw key like "projection.mercator.name" (see t() in i18n.js)."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent.parent
EN = json.loads((ROOT / "static" / "i18n" / "en.json").read_text(encoding="utf-8"))
JS_DIR = ROOT / "static" / "js"
# Every module, since t() is called from all over the split frontend.
ALL_JS = "\n".join(p.read_text(encoding="utf-8") for p in sorted(JS_DIR.rglob("*.js")))
PROJECTIONS_JS = (JS_DIR / "data" / "projections.js").read_text(encoding="utf-8")
VIEWS_JS = (JS_DIR / "data" / "views.js").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
ONBOARDING_JS = (JS_DIR / "ui" / "onboarding.js").read_text(encoding="utf-8")


I18N_DIR = ROOT / "static" / "i18n"
I18N_JS = (JS_DIR / "i18n.js").read_text(encoding="utf-8")
LANGUAGE_CODES = re.findall(r'\{ code: "([\w-]+)", name:', I18N_JS)
PLACEHOLDER = re.compile(r"\{(\w+)\}")


def test_every_listed_language_is_complete():
    assert len(LANGUAGE_CODES) >= 2, "did the LANGUAGES list change shape?"
    for code in LANGUAGE_CODES:
        if code == "en":
            continue
        messages = json.loads((I18N_DIR / f"{code}.json").read_text(encoding="utf-8"))
        assert sorted(set(EN) - set(messages)) == [], f"{code}: missing keys"
        assert sorted(set(messages) - set(EN)) == [], f"{code}: keys that English does not have"
        wrong = [k for k in EN if set(PLACEHOLDER.findall(EN[k])) != set(PLACEHOLDER.findall(messages[k]))]
        assert wrong == [], f"{code}: placeholders differ"


def test_every_listed_language_names_every_country():
    world = json.loads((ROOT / "app" / "data" / "world.geojson").read_text(encoding="utf-8"))
    names = {f["properties"]["name"] for f in world["features"]}
    for code in LANGUAGE_CODES:
        if code == "en":
            continue
        countries = json.loads((I18N_DIR / "countries" / f"{code}.json").read_text(encoding="utf-8"))
        assert sorted(names - set(countries)) == [], f"{code}: countries without a name"


def test_html_keys_exist():
    keys = re.findall(r'data-i18n(?:-html)?="([^"]+)"', INDEX_HTML)
    for attr_list in re.findall(r'data-i18n-attr="([^"]+)"', INDEX_HTML):
        keys += [pair.split(":")[1] for pair in attr_list.split(";")]
    assert keys, "no data-i18n attributes found — did the markup lose them?"
    assert [k for k in keys if k not in EN] == []


def test_literal_t_calls_exist():
    keys = re.findall(r'\bt\("([^"$`]+)"\)', ALL_JS)
    assert [k for k in keys if k not in EN] == []


def test_every_projection_and_view_has_its_texts():
    # Ids live in data/; texts are built dynamically as projection.<id>.<field>, so check them by id.
    projections_src = PROJECTIONS_JS
    projection_ids = re.findall(r'^    id: "(\w+)",', projections_src, re.M)
    families = re.findall(r'^    family: "(\w+)",', projections_src, re.M)
    view_src = VIEWS_JS[VIEWS_JS.index("const RECENTER_PRESETS"):]
    view_ids = re.findall(r'\{ id: "(\w+)"', view_src[: view_src.index("];")])

    assert len(projection_ids) == 17 and view_ids
    expected = [f"projection.{i}.{f}" for i in projection_ids for f in ("name", "origin", "preserves", "distorts", "bestFor")]
    expected += [f"family.{f.lower()}" for f in families]
    expected += [f"view.{i}.{f}" for i in view_ids for f in ("name", "description")]
    assert [k for k in expected if k not in EN] == []


def test_every_tour_step_has_its_texts():
    # Built dynamically as tour.step.<id>.<field>, like the projection texts.
    step_ids = re.findall(r'^  \{ id: "(\w+)"', ONBOARDING_JS, re.M)
    assert step_ids
    expected = [f"tour.step.{i}.{f}" for i in step_ids for f in ("title", "text")]
    assert [k for k in expected if k not in EN] == []
