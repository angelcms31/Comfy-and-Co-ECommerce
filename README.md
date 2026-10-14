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
git clone https://github.com/angelcms31/Comfy-and-Co-ECommerce.git
cd Comfy-and-Co-ECommerce
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

## Project structure

```
frontend/                  React app
  src/pages/               customer, admin and auth pages
  src/services/            every call to the backend goes through here
  src/features/reviews/    reviews kept separate since the table may still change
backend/                   FastAPI
  app/routers/             API endpoints
  supabase/schema.sql      tables from the ERD
  supabase/seed.sql        sample data + demo accounts
  API_CONTRACT.md          list of endpoints
SCHEMA_GAPS.md             things the ERD is missing
run.py                     installs and starts everything
```
