# Portable student edition

Students run HDL-Maker from a ZIP file. They do not install Node.js, npm, or Python. Development on this repository stays on the Vite server and is unchanged.

## Build

From the repository root, with the existing `.venv` and Node.js:

```powershell
powershell -ExecutionPolicy Bypass -File packaging\build_release.ps1
```

The script builds `frontend/dist`, runs PyInstaller in `onedir` mode, and writes:

```
release/pyinstaller/HDL-Maker/HDL-Maker.exe
release/HDL-Maker-0.1.0-win64.zip
release/SHA256SUMS.txt
```

`libs/` and `workspace/` are not copied into the folder or the ZIP. The bundled `examples/` directory is the small demo in this repository.

## Run

Unzip the archive and start `HDL-Maker.exe`. A console window stays open and the default browser opens at `http://127.0.0.1:8000/`. Closing the console stops the server. Starting the program again while it is already running opens the browser and does not start a second server.

Projects and UI settings are stored in `Dokumente\HDL-Maker\Projects` (the Windows Documents folder). Replacing the program files does not replace that folder.

The original HDL Designer libraries are not included. A student selects a library directory in the program. The Examples button opens the bundled demo.

FSM editing, VHDL generation, and simulation are not part of this package.
