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

### 3. Set up Supabase (once per group)

Only one person needs to do this. Everyone else just needs the keys from step 4.

1. Create a project at [supabase.com](https://supabase.com). Pick the **Singapore** region and save the database password.
2. Go to **SQL Editor** → **New query**, paste all of `backend/supabase/schema.sql`, then **Run**.
3. New query again, paste all of `backend/supabase/seed.sql`, then **Run**. This adds sample products, orders and the demo accounts.
4. Go to **Storage** → **New bucket**, name it `products` and turn on **Public bucket**. Product photos uploaded by the admin go here.
5. Go to **Authentication** → **Emails** → **Reset Password** and add `{{ .Token }}` to the email body, so forgot password sends a 6 digit code.

### 4. Create `backend/.env`

Make a new file named `.env` inside the `backend` folder:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=paste-here
SUPABASE_SERVICE_KEY=paste-here
DATABASE_URL=postgresql://postgres.xxxx:YOUR-DB-PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
FRONTEND_URLS=http://localhost:5173
```

Where to find them in the Supabase dashboard:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`: **Project Settings** → **API** (the service key is the `service_role` one)
- `DATABASE_URL`: the **Connect** button at the top → **Session pooler**, then replace `[YOUR-PASSWORD]` with the database password

> Never commit `.env` or post the service key in the group chat. It's already in `.gitignore`.

### 5. Run it

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

### Demo accounts

| Email | Password | Role |
|---|---|---|
| juan@comfyco.ph | password123 | customer |
| admin@comfyco.ph | admin123 | admin |

All other customers in `seed.sql` also use `password123`. Change the admin password before presenting.

To make another account an admin, run this in the Supabase SQL Editor:

```sql
update "user" set user_role_id = 2 where email = 'their@email.com';
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

## Troubleshooting

| You see | Fix |
|---|---|
| "Can't reach the server right now" on the site | The backend isn't running. Check the `[backend]` lines in the terminal |
| "Database is not set up yet" | `backend/.env` is missing or has no `DATABASE_URL` |
| "Incorrect email or password" with the demo accounts | `seed.sql` wasn't run, or it failed halfway. Check the SQL Editor result |
| Product pictures are blank / placeholder | Normal. The sample product drawings aren't in the repo, upload real photos from Admin → Inventory |
| `Port 5173 is in use` | Another `npm run dev` is still open. Close it, or the site opens on 5174 instead |
| `python` not found on Windows | Use `py run.py`, or reinstall Python with "Add Python to PATH" ticked |
| Page shows "Outdated Optimize Dep" errors | Stop the frontend, run `npm run dev -- --force` in `frontend`, then hard refresh (Ctrl+Shift+R) |

If the frontend needs to talk to a backend on a different address, create `frontend/.env` with `VITE_API_URL=http://that-address/api`.

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

## Progress

- [x] Customer store: home, product list, search, product details, likes
- [x] Admin: login, dashboard, inventory
- [x] Backend: all endpoints in API_CONTRACT.md
- [ ] Cart and checkout pages
- [ ] Customer login, register, forgot password
- [ ] Admin orders and reviews pages
