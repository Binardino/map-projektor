# Deploying Map Projektor

The site is live at <https://binardino.lauramini.fr/map-projektor/>, hosted on **GitHub Pages**. Every push to `main` publishes it, once pytest and the JS tests have passed.

## Why a static host

In production the app has no server-side logic: FastAPI only serves files, and `index.html` has no template variable. Static hosting needs no process, so there is no cold start and nothing to maintain. FastAPI stays for local development.

**A consequence to keep in mind:** a new route in `app/main.py` does not exist on the live site. Anything the front end fetches must be a file copied by the `deploy` job.

## How it works

The `deploy` job in `.github/workflows/tests.yml` copies the files to the paths FastAPI serves, then publishes them:

| Source | Published at |
|---|---|
| `templates/index.html` | `index.html` |
| `static/` | `static/` |
| `app/data/*.geojson` | `data/` |

Nothing else in the repository is published.

To test that export before a push, build the same folder and serve it with a plain file server:

```bash
mkdir -p _site/data
cp templates/index.html _site/
cp -r static _site/static
cp app/data/*.geojson _site/data/
mkdir serve && mv _site serve/map-projektor
python -m http.server 8000 --directory serve
```

Then open <http://localhost:8000/map-projektor/>: serving it from a subfolder is what catches a path written from the root.

## Settings outside the repository

- **This repository:** Settings → Pages. Source is **GitHub Actions**, with no custom domain: it inherits the one below, which puts the site in the `/map-projektor/` subfolder.
- **The `Binardino.github.io` repository:** it holds the root of the domain. Its Settings → Pages has the custom domain `binardino.lauramini.fr` and **Enforce HTTPS** on. Any other repository of the account with Pages enabled also appears under this domain, at `/<repository name>/`.
- **DNS:** one record, `CNAME binardino` → `binardino.github.io`, on the `lauramini.fr` domain. A subdomain takes no A record.

**Every path in the site must be relative** (`static/...`, not `/static/...`), because the site is not at the root of its domain.

## Caching

GitHub Pages sets its own cache headers and they cannot be changed. For a few minutes after a publish, a returning visitor may get a mix of old and new files.

## If the address changes

Update `og:url` and `og:image` in `templates/index.html`, which must be absolute, and the custom domain and DNS record above.

## Running it as a server instead

The `Dockerfile` and `docker-compose.yml` still run the FastAPI app as a process, which is what a host such as Render or Fly.io would use:

```bash
docker compose up --build
```
