# Deploying Map Projektor to the public internet

A step-by-step guide to publish this app so anyone can open a URL and use it, with HTTPS and no server maintenance. Target platform: **Render** (free tier to start, ~$7/month for an always-on instance). Fly.io is a solid alternative — noted where it diverges.

## Why Render

The app is a stateful Python process (Uvicorn serving FastAPI + Jinja2 + a generated GeoJSON file), not a static site — so static hosts (GitHub Pages, Netlify, Vercel's static tier) don't apply. Render runs the app as a real process from a `git push`, gives a free public HTTPS domain out of the box, and needs no Kubernetes/Docker knowledge to start.

**Trade-off of the free tier:** the instance sleeps after ~15 minutes of inactivity, so the first request after a lull takes 30–60s to wake up. Fine for sharing with a few people; upgrade to a paid instance ($7/mo) if you want it always warm.

---

## 1. Prepare the repository

### 1.1 Generate the GeoJSON at build time, not commit time

`app/data/world.geojson` is gitignored — it's generated locally by `scripts/fetch_geodata.py`. The deploy build must run that script, so add a build command that does both dependency install and data generation (step 3 below wires this in).

### 1.2 Pin dependencies

`poetry.lock` is already committed — good, this guarantees Render installs the exact versions you tested with. Verify it's up to date:

```bash
poetry lock --check
```

### 1.3 Turn off reload in production

`--reload` (used in local dev) watches the filesystem and is not meant for production — it adds overhead and is a minor attack surface (arbitrary file-change-triggered restarts). The production start command (step 3) omits it.

### 1.4 Add a `.python-version` or confirm `requires-python`

`pyproject.toml` already pins `requires-python = ">=3.10"` — Render's Python buildpack reads this, no extra file needed.

---

## 2. Choose a deployment shape

Two options; pick one.

| | Native buildpack | Docker |
|---|---|---|
| Setup effort | Lowest — Render detects Poetry automatically | You write a `Dockerfile` |
| Reproducibility | Good | Best — identical environment locally and in prod |
| Recommended when | You want the fastest path | You want to test the exact deploy image locally first |

Both are described below; the native buildpack is enough for this app's size.

### Option A — Native buildpack (recommended)

No extra files needed. Render's Python environment detects `pyproject.toml` and Poetry automatically.

### Option B — Docker

Add this `Dockerfile` at the repo root:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN pip install poetry==1.8.3 && poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock ./
RUN poetry install --no-root --only main

COPY . .
RUN python scripts/fetch_geodata.py

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 3. Configure the Render service

1. Push the repo to GitHub (Render deploys from a git remote).
2. On [render.com](https://render.com), **New → Web Service**, connect the GitHub repo.
3. Fill in:
   - **Environment:** Python 3 (or Docker, if you went with Option B)
   - **Build command:**
     ```bash
     poetry install --only main && python scripts/fetch_geodata.py
     ```
   - **Start command:**
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
     (Render injects `$PORT`; the app must bind to it, not a hardcoded `8000`.)
   - **Instance type:** Free (to try it out) or Starter ($7/mo, no sleep).
4. Click **Create Web Service**. First deploy takes a few minutes (installs deps, fetches/simplifies geodata).

You can also commit a `render.yaml` at the repo root so this configuration is versioned instead of set by hand in the dashboard:

```yaml
services:
  - type: web
    name: map-projektor
    env: python
    plan: free
    buildCommand: poetry install --only main && python scripts/fetch_geodata.py
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

---

## 4. Verify

Render gives you a URL like `https://map-projektor.onrender.com` — HTTPS is automatic and free (Render provisions a certificate). Open it and check:

- The world map renders (confirms `world.geojson` was generated during build).
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
- **`--reload` off in production** — already covered in step 1.3.
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

1. Commit `poetry.lock`, keep `--reload` out of the prod start command.
2. Push to GitHub.
3. Create a Render Web Service, build command runs `poetry install` + `fetch_geodata.py`, start command binds to `$PORT`.
4. Verify the live URL.
5. (Optional) custom domain, Basic Auth if you want to restrict access.
