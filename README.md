# HDL Design Studio

HDL-Maker is open-source software for students, universities, and other developers. It is a browser-based studio for migrating existing HDL Designer libraries and editing hierarchical VHDL designs. It does not require a Siemens HDL Designer license, and it is not a clone of that product.

M5b is **Tested on hardware** in the working tree. A Zybo Z7-20 run of `xc7z020_1` passed the JTAG download, the DONE pin, and LED0 at about 1.07 s. An open-source bitstream for the same counter was written and was not programmed. The investigation is [docs/o1-open-source-toolchain.md](docs/o1-open-source-toolchain.md), and the backend pipeline is [docs/o2a-open-source-build.md](docs/o2a-open-source-build.md). The window does not start that pipeline. The Vivado executable is set in Preferences; that path is local tool configuration and does not change `PATH`. A browser waveform view remains **M4b**. Order and scope are fixed in [docs/roadmap.md](docs/roadmap.md). The batch flow is described in [docs/m5a-vivado.md](docs/m5a-vivado.md) and the JTAG flow in [docs/m5b-jtag.md](docs/m5b-jtag.md). Simulation details are in [docs/m4a-simulation.md](docs/m4a-simulation.md) and [docs/m4a1-gtkwave.md](docs/m4a1-gtkwave.md).

## License

HDL-Maker is released under the [MIT License](LICENSE).

Copyright (c) 2026 Christian Netzberger

The VHDL designs and graphical design files in `libs/sbus_rtc_lib` are the author's work and may be distributed under the same MIT License. Third-party board files and generated tool output keep their own terms. Those notices are listed in [docs/third-party-notices.md](docs/third-party-notices.md).

A portable Windows build for students is described in [docs/student-edition.md](docs/student-edition.md). Development still uses the Vite server. The packaged app serves the built page and the API on `127.0.0.1` and does not need Node.js or a separate Python install.

## Stack

- Frontend: Vue 3, TypeScript, Vite, Pinia, and Vue Flow
- Backend: Python 3.10.9 (this machine's existing environment; FastAPI and Pydantic 2). GHDL is optional for generation and required before a file can be called analyzed.
- Project state: versioned JSON under `workspace/` (not committed)
- Original HDL files stay where they are and are never modified

## Prerequisites

- Windows 11
- Python 3.10 at `C:\Program Files\Python310` and the repository `.venv`
- Node.js 22 or newer
- GHDL is optional while generating VHDL and required to run a simulation. GTKWave is optional. When it is missing, the waveform file is kept. Vivado is optional and is required only for an FPGA build. The health endpoint reports `ghdl` from `PATH`, and GTKWave and Vivado from `workspace/tools.json` or, when the setting is empty, from `PATH`.

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
- [docs/m3a-limitations.md](docs/m3a-limitations.md)
- [docs/m5a-vivado.md](docs/m5a-vivado.md)
- [docs/m5b-jtag.md](docs/m5b-jtag.md)
- [docs/student-edition.md](docs/student-edition.md)
