# P1 test report

Date: 2026-11-21. Package: `release/HDL-Maker-0.1.0-win64.zip`.

SHA-256: `992731CB5057276469FCA035C8695D18F9C31CB9C14C449841637C425549CEDA` (`release/SHA256SUMS.txt`).

## Build

`packaging/build_release.ps1` produced a PyInstaller `onedir` folder and the ZIP. The ZIP contains `HDL-Maker.exe`, `README.txt`, the bundled `examples/` tree, and the built page. It has no `libs/` path and no `workspace/` path (404 entries checked).

## Automated tests

`pytest backend`: 47 passed, including the distribution checks for the listen address, the project directory, and serving the built page together with `/api/health`.

## Packaged executable

The executable was started with `PATH` reduced to `C:\Windows\System32;C:\Windows`, `HDS_PORT=8765`, `HDS_NO_BROWSER=1`, and `HDS_WORKSPACE` pointed at a temporary directory. This PC already has Python and Node.js installed, so the reduced `PATH` is the stand-in for a PC without those tools. The process image was `HDL-Maker.exe`.

| Check | Result |
| --- | --- |
| `GET /api/health` | 200, service `hdl-design-studio`, Python 3.10.9 |
| `GET /` | 200, page contains `HDL Design Studio` |
| Built script under `/assets/` | 200 |
| `GET /api/examples/path` | 200, path inside the bundle `_internal\examples` |
| Listen address | `127.0.0.1:8765` only |
| Second launch | exit 0, no second listener, browser start skipped in this test |
| Close (Ctrl+Break) | Uvicorn shut down and the process exited 0 |
| `libs/sbus_rtc_lib` bytes | unchanged |
| `examples/` bytes | unchanged |
| Test project directory | created at the `HDS_WORKSPACE` path, outside the install folder |

A PC that has never had Python or Node.js installed was not available for this run.
