# HDL Design Studio

License-independent, browser-based studio for migrating existing HDL Designer libraries and editing hierarchical VHDL designs. This is not a clone of Siemens HDL Designer.

The current milestone is **M1**: import a VHDL library, browse entities, and inspect generated symbols. Block diagrams, FSM editing, VHDL generation, and GHDL simulation come later.

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

Use two terminals.

```powershell
cd C:\_Git\HDL-Maker
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

```powershell
cd C:\_Git\HDL-Maker\frontend
npm run dev
```

Open http://127.0.0.1:5173 . The Vite dev server proxies `/api` to the backend. Bind the API to localhost only. In the library browser, **Examples** scans `examples/` and shows the counter, comparator, and controller.

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
schemas/      design.schema.json (inventory schema version 1)
examples/     counter, comparator, controller, plus files the importer must not parse
docs/         architecture, roadmap, migration, changelog
workspace/    local project file, gitignored
```

## Documents

- [docs/architecture.md](docs/architecture.md)
- [docs/roadmap.md](docs/roadmap.md)
- [docs/migration.md](docs/migration.md)
- [docs/changelog.md](docs/changelog.md)
