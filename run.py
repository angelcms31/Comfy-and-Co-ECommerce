"""
Starts Comfy&Co: FastAPI backend (port 8000) + React frontend (port 5173).

    python run.py              install what's missing, then start both
    python run.py --backend    backend only
    python run.py --frontend   frontend only
    python run.py --install    only install, don't start

Packages are only installed the first time, or again when requirements.txt / package-lock.json change.
Press Ctrl+C to stop everything.
"""

import hashlib
import os
import shutil
import subprocess
import sys
import threading
import time
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
WINDOWS = os.name == "nt"
VENV_PYTHON = VENV / ("Scripts/python.exe" if WINDOWS else "bin/python")

GREEN, YELLOW, RED, BLUE, DIM, RESET = "\033[32m", "\033[33m", "\033[31m", "\033[34m", "\033[2m", "\033[0m"
if WINDOWS:
    os.system("")  # turns on colors in the Windows terminal


def say(msg, color=GREEN):
    print(f"{color}{msg}{RESET}", flush=True)


def fail(msg):
    say(msg, RED)
    sys.exit(1)


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else ""


def up_to_date(marker: Path, source: Path) -> bool:
    return marker.exists() and marker.read_text().strip() == file_hash(source)


def check_tools():
    if sys.version_info < (3, 11):
        fail(f"Python 3.11 or newer is needed, you have {sys.version.split()[0]}")
    if not shutil.which("npm"):
        fail("npm was not found. Install Node.js 20+ from https://nodejs.org and open a new terminal.")


def setup_backend():
    requirements = BACKEND / "requirements.txt"
    marker = VENV / ".installed"

    if not VENV_PYTHON.exists():
        say("Creating backend/.venv ...")
        venv.create(VENV, with_pip=True)

    if up_to_date(marker, requirements):
        say("Backend packages already installed, skipping.", DIM)
    else:
        say("Installing backend packages (first time takes a minute) ...")
        result = subprocess.run([str(VENV_PYTHON), "-m", "pip", "install", "-q", "-r", str(requirements)])
        if result.returncode != 0:
            fail("pip install failed, see the error above.")
        marker.write_text(file_hash(requirements))

    if not (BACKEND / ".env").exists():
        say("Warning: backend/.env is missing, so the backend can't reach Supabase. See README.md step 2.", YELLOW)


def setup_frontend():
    lock = FRONTEND / "package-lock.json"
    marker = FRONTEND / "node_modules" / ".installed"

    if up_to_date(marker, lock):
        say("Frontend packages already installed, skipping.", DIM)
        return

    say("Installing frontend packages (first time takes a minute) ...")
    result = subprocess.run("npm install", cwd=FRONTEND, shell=True)
    if result.returncode != 0:
        fail("npm install failed, see the error above.")
    marker.write_text(file_hash(lock))


def stream(proc, label, color):
    for line in iter(proc.stdout.readline, b""):
        text = line.decode(errors="replace").rstrip()
        if text:
            print(f"{color}[{label}]{RESET} {text}", flush=True)


def start(cmd, cwd, label, color, shell=False):
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        shell=shell,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        # own process group so Ctrl+C can stop the whole thing cleanly
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if WINDOWS else 0,
        start_new_session=not WINDOWS,
    )
    threading.Thread(target=stream, args=(proc, label, color), daemon=True).start()
    return proc


def stop(proc):
    if proc.poll() is not None:
        return
    if WINDOWS:
        # npm starts node in a child process, /T stops that too
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
    else:
        import signal

        os.killpg(proc.pid, signal.SIGTERM)


def main():
    args = set(sys.argv[1:])
    run_backend = "--frontend" not in args
    run_frontend = "--backend" not in args

    check_tools()
    if run_backend:
        setup_backend()
    if run_frontend:
        setup_frontend()
    if "--install" in args:
        say("All set.")
        return

    procs = []
    if run_backend:
        procs.append(
            start([str(VENV_PYTHON), "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], BACKEND, "backend", BLUE)
        )
    if run_frontend:
        procs.append(start("npm run dev", FRONTEND, "frontend", GREEN, shell=True))

    say("")
    if run_frontend:
        say("  Store:      http://localhost:5173")
        say("  Admin:      http://localhost:5173/admin/login")
    if run_backend:
        say("  API docs:   http://localhost:8000/docs")
    say("  Press Ctrl+C to stop.\n", DIM)

    try:
        while all(p.poll() is None for p in procs):
            time.sleep(0.5)
        say("One of the servers stopped, shutting down the other.", YELLOW)
    except KeyboardInterrupt:
        say("\nStopping ...", YELLOW)
    finally:
        for p in procs:
            stop(p)


if __name__ == "__main__":
    main()
