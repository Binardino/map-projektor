# Deploying Map Projektor to the public internet

A step-by-step guide to publish this app so anyone can open a URL and use it, with HTTPS and no server maintenance. Target platform: **Render** (free tier to start, ~$7/month for an always-on instance). Fly.io is a solid alternative — noted where it diverges.

## Why Render

The app is a stateful Python process (Uvicorn serving FastAPI + Jinja2 + a generated GeoJSON file), not a static site — so static hosts (GitHub Pages, Netlify, Vercel's static tier) don't apply. Render runs the app as a real process from a `git push`, gives a free public HTTPS domain out of the box, and needs no Kubernetes/Docker knowledge to start.

**Trade-off of the free tier:** the instance sleeps after ~15 minutes of inactivity, so the first request after a lull takes 30–60s to wake up. Fine for sharing with a few people; upgrade to a paid instance ($7/mo) if you want it always warm.

---

## 1. What the repository already provides

- **`Dockerfile`** — two-stage image (Poetry install in a builder, slim runtime, non-root user). It starts Uvicorn without `--reload` (the file watcher is for local dev only) and binds to the `$PORT` the platform injects, defaulting to 8000.
- **`app/data/world.geojson` and `terrain.geojson` are committed**, so the build needs no network access. The Dockerfile only runs `scripts/fetch_geodata.py` if they are missing.
- **`poetry.lock`** pins the exact versions you tested with.
- **`render.yaml`** — a Render Blueprint describing the service (Docker runtime, free plan, auto-deploy from `main`, health check on `/`), so the settings live in git instead of the dashboard.

Test the exact deploy image locally first:

```bash
docker compose up --build
```

---

## 2. Create the service on Render

1. Push to GitHub (Render deploys from the git remote).
2. On [render.com](https://render.com), **New → Blueprint**, connect the GitHub repo. Render reads `render.yaml` and shows the `map-projektor` web service.
3. Click **Apply**. The first deploy builds the Docker image (a few minutes).

Every merge to `main` then redeploys automatically (`autoDeploy: true`).

**Plan:** `plan: free` in `render.yaml`. Switch it to `starter` (~$7/month) to avoid the cold start after ~15 minutes idle.

---

## 4. Verify

Render gives you a URL like `https://map-projektor.onrender.com` — HTTPS is automatic and free (Render provisions a certificate). Open it and check:

- The world map renders (confirms the committed `world.geojson` made it into the image).
- Switching projections and themes works (confirms static assets are served).
- Browser console has no errors, no mixed-content (`http://`) warnings.

---

## 5. Custom domain (optional)

If you own a domain: Render dashboard → the service → **Settings → Custom Domain**, add e.g. `map.yourdomain.com`, then add the CNAME record Render shows you at your DNS provider. Certificate renewal is automatic.

---

## 6. Security checklist

The app is read-only (no login, no user data, no database), so the attack surface is small. Still worth doing:

- **HTTPS only** — Render enforces this by default; nothing to configure.
- **No secrets in the repo or logs** — the app currently has none; if you later add an API key, use Render's **Environment** tab (encrypted at rest), never commit it.
- **`--reload` off in production** — the Dockerfile's start command omits it.
- **Dependencies patched** — `poetry lock --check` periodically, `poetry update` when CVEs show up (e.g. via `pip-audit` or GitHub Dependabot alerts, which work fine on a Poetry repo).
- **Restrict access (optional)** — if this should stay private-ish (e.g. shared with a few people, not indexed publicly), the simplest option is HTTP Basic Auth via FastAPI middleware:

  ```python
  from fastapi.security import HTTPBasic, HTTPBasicCredentials
  from fastapi import Depends, HTTPException
  import secrets, os

  security = HTTPBasic()

  def require_auth(credentials: HTTPBasicCredentials = Depends(security)):
      correct_user = secrets.compare_digest(credentials.username, os.environ["APP_USER"])
      correct_pass = secrets.compare_digest(credentials.password, os.environ["APP_PASSWORD"])
      if not (correct_user and correct_pass):
          raise HTTPException(status_code=401, headers={"WWW-Authenticate": "Basic"})
  ```

  Then add `dependencies=[Depends(require_auth)]` to the routes in `app/main.py`, and set `APP_USER` / `APP_PASSWORD` in Render's **Environment** tab. Not implemented today — only add this if you decide the app shouldn't be fully public.
- **Security headers (optional, low priority for a read-only app)** — `Content-Security-Policy`, `X-Frame-Options`, etc. can be added later via `fastapi` middleware if you want to hand-harden it; not required to go live.

---

## Summary

1. The repo ships a `Dockerfile`, the committed geodata and a `render.yaml` Blueprint.
2. Push to GitHub.
3. Render → **New → Blueprint** → connect the repo → **Apply**.
4. Verify the live URL.
5. (Optional) custom domain, Basic Auth if you want to restrict access.
