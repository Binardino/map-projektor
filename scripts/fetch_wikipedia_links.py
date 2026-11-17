"""Writes each projection's Wikipedia link into every language file.

The info panel links the projection on screen to its Wikipedia article in
the interface language. Which articles exist in which language is read from
Wikidata rather than guessed: an English title below gives the item, the
item's sitelinks give the other languages. A language without an article
gets the English one, so every key exists everywhere (tests/test_i18n.py).

Run it again after adding a projection, with its English article below:
    poetry run python scripts/fetch_wikipedia_links.py
"""
import json
import pathlib
import urllib.parse

import requests

ROOT = pathlib.Path(__file__).parent.parent
I18N_DIR = ROOT / "static" / "i18n"
API = "https://www.wikidata.org/w/api.php"
# Wikimedia asks automated clients to name themselves and a contact.
HEADERS = {"User-Agent": "map-projektor/1.0 (https://github.com/Binardino/map-projektor)"}

# Projection id → English Wikipedia article. The two polar views are the
# azimuthal equidistant projection centred on a pole: they share its article.
# A projection with no English article is given as (Wikidata item, English
# article to fall back on) instead.
ENGLISH_ARTICLES = {
    "mercator": "Mercator projection",
    "equirectangular": "Equirectangular projection",
    "gallPeters": "Gall–Peters projection",
    "robinson": "Robinson projection",
    "mollweide": "Mollweide projection",
    "naturalEarth": "Natural Earth projection",
    "equalEarth": "Equal Earth projection",
    "eckert4": "Eckert IV projection",
    "sinusoidal": "Sinusoidal projection",
    "orthographic": "Orthographic map projection",
    "azimuthalEqualArea": "Lambert azimuthal equal-area projection",
    "polarNorth": "Azimuthal equidistant projection",
    "polarSouth": "Azimuthal equidistant projection",
    "winkelTripel": "Winkel tripel projection",
    "aitoff": "Aitoff projection",
    "hammer": "Hammer projection",
    "albers": "Albers projection",
    "spilhaus": ("Q118727380", "Athelstan Spilhaus"),  # articles in de, es, fr only
}

# zh.wikipedia stores one article and converts its script on the fly: the
# /zh-cn/ path asks for simplified characters, which the interface uses.
PATH_BY_LANGUAGE = {"zh": "zh-cn"}


def sitelinks(article):
    """Language → article title, English fallback included."""
    if isinstance(article, tuple):
        item, fallback = article
        params = {"ids": item}
    else:
        fallback = None
        params = {"sites": "enwiki", "titles": article, "redirects": "yes"}
    response = requests.get(API, headers=HEADERS, timeout=30,
                            params={"action": "wbgetentities", "props": "sitelinks", "format": "json", **params})
    response.raise_for_status()
    (entity,) = response.json()["entities"].values()
    if "missing" in entity:
        raise SystemExit(f"No Wikidata item for {article!r}")
    titles = {site[:-4]: link["title"] for site, link in entity["sitelinks"].items() if site.endswith("wiki")}
    if fallback:
        titles.setdefault("en", fallback)
    return titles


def article_url(language, title):
    path = PATH_BY_LANGUAGE.get(language, "wiki")
    return f"https://{language}.wikipedia.org/{path}/{urllib.parse.quote(title.replace(' ', '_'))}"


def main():
    languages = sorted(p.stem for p in I18N_DIR.glob("*.json"))
    links = {}
    for projection_id, article in ENGLISH_ARTICLES.items():
        titles = sitelinks(article)
        links[projection_id] = {
            lang: article_url(lang, titles[lang]) if lang in titles else article_url("en", titles["en"])
            for lang in languages
        }
        missing = [lang for lang in languages if lang not in titles]
        print(f"{projection_id:20} {len(languages) - len(missing):2}/{len(languages)} languages"
              + (f", English for: {' '.join(missing)}" if missing else ""))

    for lang in languages:
        path = I18N_DIR / f"{lang}.json"
        raw = path.read_text(encoding="utf-8")
        items = list(json.loads(raw).items())
        for projection_id in ENGLISH_ARTICLES:
            key, value = f"projection.{projection_id}.wikipedia", links[projection_id][lang]
            keys = [k for k, _ in items]
            if key in keys:
                items[keys.index(key)] = (key, value)
            else:
                # After the last key that sorts before it, so each file keeps its own order
                at = max((i for i, k in enumerate(keys) if k < key), default=-1) + 1
                items.insert(at, (key, value))
        path.write_text(json.dumps(dict(items), ensure_ascii=False, indent=2) + ("\n" if raw.endswith("\n") else ""),
                        encoding="utf-8")


if __name__ == "__main__":
    main()
