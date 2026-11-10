# Comfy&Co

Online furniture store for CS Elective 3. *"Making every corner feel like home."*

React (Vite + TypeScript + Tailwind) → FastAPI → Supabase (PostgreSQL + Auth + Storage)

## How to run

### 1. Install these first

| Tool | Version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org) | 20 or newer | `node -v` |
| [Python](https://www.python.org/downloads/) | 3.11 or newer | `python --version` |
| [Git](https://git-scm.com) | any | `git --version` |

On Windows, tick **"Add Python to PATH"** when installing Python.

### 2. Get the code

```bash
git clone https://github.com/angelcms31/Comfy-and-Co-Web.git
cd Comfy-and-Co-Web
```

### 3. Add `backend/.env`

Ask the group for the `.env` file and put it inside the `backend` folder. The backend needs it to connect to Supabase.

> Never commit `.env` or post it in the group chat. It's already in `.gitignore`.

### 4. Run it

```bash
python run.py
```

The first run installs everything (takes a few minutes). After that it skips straight to starting the servers. When you see the links, open:

| Page | URL |
|---|---|
| Store | http://localhost:5173 |
| Admin | http://localhost:5173/admin/login |
| API docs | http://localhost:8000/docs |

Press **Ctrl+C** to stop.

Other options:

```bash
python run.py --frontend   # frontend only
python run.py --backend    # backend only
python run.py --install    # just install, don't start
```

## Running without run.py

If you'd rather use two terminals:

```bash
# terminal 1 - backend
cd backend
python -m venv .venv
.venv\Scripts\activate            # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# terminal 2 - frontend
cd frontend
npm install
npm run dev
```

## Deploy

The store runs on **Vercel** and the API on **Render**, both from this GitHub repo. Every push to `main` redeploys both.

**1. Backend on Render**

1. On [render.com](https://render.com), **New → Blueprint**, pick this repo. It reads `render.yaml`.
2. Fill in the values it asks for, copied from `backend/.env`. Leave `FRONTEND_URLS` as `http://localhost:5173` for now.
3. When it's live, open `https://<your-service>.onrender.com/api/health`. It should say `{"ok":true}`.

The free plan sleeps after 15 minutes without visits, so the first request after that takes about 30–50 seconds.

**2. Store on Vercel**

1. On [vercel.com](https://vercel.com), **Add New → Project**, import this repo.
2. Set **Root Directory** to `frontend`. Vercel detects Vite.
3. Add the environment variable `VITE_API_URL` = `https://<your-service>.onrender.com/api`, then **Deploy**.

**3. Connect them**

In Render, set `FRONTEND_URLS` to the Vercel URL (e.g. `https://comfy-and-co.vercel.app`, no `/` at the end) and save. Render restarts the API, and after that the store can call it.

## Project structure

```
frontend/                  React app
  src/pages/               customer, admin and auth pages
  src/services/            every call to the backend goes through here
  src/features/reviews/    reviews kept separate since the table may still change
backend/                   FastAPI
  app/routers/             API endpoints
  supabase/schema.sql      tables from the ERD
  supabase/migrations/     changes on top of the ERD (002 = admin panel, 011 = Lalamove delivery), run after schema.sql
  supabase/load_dimensions.py  fills each variant's packed size and weight from products.json (run once after migration 011)
  app/delivery.py          Lalamove: picks the vehicle for an order, road distance from the store, the fee
  supabase/seed.sql        sample data + demo accounts
  API_CONTRACT.md          list of endpoints
SCHEMA_GAPS.md             things the ERD is missing
run.py                     installs and starts everything
```
