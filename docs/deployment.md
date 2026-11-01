# Deploying Map Projektor

The site is live at <https://binardino.lauramini.fr>, hosted on **GitHub Pages**. Every push to `main` publishes it, once pytest and the JS tests have passed.

## Why a static host

In production the app has no server-side logic: FastAPI only serves files, and `index.html` has no template variable. Static hosting needs no process, so there is no cold start and nothing to maintain. FastAPI stays for local development.

**A consequence to keep in mind:** a new route in `app/main.py` does not exist on the live site. Anything the front end fetches must be a file copied by the `deploy` job.

## How it works

The `deploy` job in `.github/workflows/tests.yml` copies the files to the paths FastAPI serves, then publishes them:

| Source | Published at |
|---|---|
| `templates/index.html` | `/` |
| `static/` | `/static/` |
| `app/data/*.geojson` | `/data/` |

Nothing else in the repository is published.

To test that export before a push, build the same folder and serve it with a plain file server:

```bash
mkdir -p _site/data
cp templates/index.html _site/
cp -r static _site/static
cp app/data/*.geojson _site/data/
python -m http.server 8000 --directory _site
```

## Settings outside the repository

- **GitHub:** Settings → Pages. Source is **GitHub Actions**, the custom domain is `binardino.lauramini.fr`, and **Enforce HTTPS** is on.
- **DNS:** one record, `CNAME binardino` → `binardino.github.io`, on the `lauramini.fr` domain. A subdomain takes no A record.

The site's paths start from the root, so it renders broken at `binardino.github.io/map-projektor/`: only the custom domain works.

## Caching

GitHub Pages sets its own cache headers and they cannot be changed. For a few minutes after a publish, a returning visitor may get a mix of old and new files.

## If the address changes

Update `og:url` and `og:image` in `templates/index.html`, which must be absolute, and the custom domain and DNS record above.

## Running it as a server instead

The `Dockerfile` and `docker-compose.yml` still run the FastAPI app as a process, which is what a host such as Render or Fly.io would use:

```bash
docker compose up --build
```
