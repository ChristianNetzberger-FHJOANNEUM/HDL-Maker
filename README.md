# HDL Design Studio

License-independent, browser-based studio for migrating existing HDL Designer libraries and editing hierarchical VHDL designs. This is not a clone of Siemens HDL Designer.

M2b and the portable student build are in the working tree. The next milestone is **M2c**. Order and scope are fixed in [docs/roadmap.md](docs/roadmap.md).

A portable Windows build for students is described in [docs/student-edition.md](docs/student-edition.md). Development still uses the Vite server. The packaged app serves the built page and the API on `127.0.0.1` and does not need Node.js or a separate Python install.

## Stack

- Frontend: Vue 3, TypeScript, Vite, Pinia, and Vue Flow
- Backend: Python 3.10.9 (this machine's existing environment; FastAPI and Pydantic 2), GHDL when it is installed
- Project state: versioned JSON under `workspace/` (not committed)
- Original HDL files stay where they are and are never modified

## Prerequisites

- Windows 11
- Python 3.10 at `C:\Program Files\Python310` and the repository `.venv`
- Node.js 22 or newer
- GHDL is required from milestone M3 onward. It is optional for M0 and M1. The health endpoint reports whether `ghdl` is on `PATH`.

## Setup

```powershell
cd C:\_Git\HDL-Maker
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm install
```

## Run

```powershell
cd C:\_Git\HDL-Maker\frontend
npm run dev
```

Open http://127.0.0.1:5173 . The dev server starts the API on `127.0.0.1:8000` when that port is closed, and stops that process when the dev server stops. If you already started the API yourself, it is left running:

```powershell
cd C:\_Git\HDL-Maker
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Browser calls to `/api` stay on port 5173. The proxy keeps one connection open and binds it to a reserved local port outside Windows' ephemeral range, so a full TIME_WAIT pool does not turn into HTTP 502. The Windows port range is not changed. In the library browser, **Examples** scans `examples/` and shows the counter, comparator, and controller. **Create design** starts an empty block diagram for one of the imported libraries.

## Import a library without the UI

From the `backend` directory, so that the `app` package is on the path:

```powershell
cd C:\_Git\HDL-Maker\backend
..\.venv\Scripts\python.exe -m app.importers ..\examples --library demo --out ..\workspace\demo-report.json
```

`--no-save` prints the report without writing `workspace/project.json`. A relative path is resolved from the repository root. The command does not modify the library.

## Tests

```powershell
cd C:\_Git\HDL-Maker
.\.venv\Scripts\python.exe -m pytest backend
```

## Layout

```
frontend/     Vue studio
backend/app/  FastAPI, importers, design model
schemas/      design.schema.json (inventory schema version 2)
examples/     counter, comparator, controller, plus files the importer must not parse
docs/         architecture, roadmap, migration, changelog
workspace/    local project file, gitignored
```

## Documents

- [docs/architecture.md](docs/architecture.md)
- [docs/roadmap.md](docs/roadmap.md)
- [docs/migration.md](docs/migration.md)
- [docs/changelog.md](docs/changelog.md)
- [docs/m2b-limitations.md](docs/m2b-limitations.md)
- [docs/student-edition.md](docs/student-edition.md)
