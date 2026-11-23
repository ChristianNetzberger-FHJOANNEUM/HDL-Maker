# M4a.1 GTKWave

M4a.1 checks the external viewer. It does not draw waveforms in the browser. The local GTKWave 3.3.100 install recorded below is not part of the application package.

## Where the executable is configured

`workspace/tools.json` holds `gtkwave_path`. Preferences edits that file. An empty value means `gtkwave` on `PATH`. A value that is not an existing file is `invalid_gtkwave_path`. The health check then reports no GTKWave, and Open in GTKWave does not start a process. The waveform file stays in the run directory.

This path is local to the machine. It is not a field of the diagram, not `ui.json`, and not `project.json`.

## Save file

`simulation.gtkw_path` is one optional `.gtkw` file for the simulation configuration. A later run keeps that path in its snapshot. When the file exists, GTKWave is started as:

```text
gtkwave.exe <waveform.ghw-or-vcd> <signals.gtkw>
```

When the path is set and the file is missing, GTKWave is not started. HDL-Maker does not write a replacement signal list or zoom.

## Signal names

The prepared map is unchanged. A testbench port is still `/{entity}/{port}`. A port under an instance label read from the architecture is still `/{entity}/{label}/{port}`.

After a VCD run, the header is read up to `$enddefinitions`. A slash path and a dotted VCD name are the same hierarchy when the separators are the only difference: `/gate_tb/uut/y` matches `gate_tb.uut.y`. A stored path that is not in the header is `signal_not_in_waveform`. A VCD name with no object id is `unmapped_waveform_signal`. No object id is created for that name.

GHW is binary. The report records `waveform_names_unchecked` and does not claim that the map was confirmed from the file.

On the small gate testbench, the project record contains only port `y`. GHDL's VCD also contains the testbench signals `a`, `b`, and `y`, and the instance ports `a` and `b`. Those extra names are reported. They are not added to the map.

## Process

GTKWave is started with an argument list and `shell=False`. The API does not wait for it. On Windows the process is created with `DETACHED_PROCESS` and `CREATE_NEW_PROCESS_GROUP`, so it is not tied to the server console. A short-lived parent that starts a process this way can exit while the child keeps running.

## This machine

GTKWave was not already installed. The official Windows binary used for the local check is GTKWave Analyzer v3.3.100, from `gtkwave-3.3.100-bin-win64.zip` (22 March 2019, 22.8 MB) on the GTKWave SourceForge project:

https://sourceforge.net/projects/gtkwave/files/gtkwave-3.3.100-bin-win64/gtkwave-3.3.100-bin-win64.zip

It is unpacked under `%LOCALAPPDATA%\HDL-Maker\tools\gtkwave-3.3.100\`. `workspace/tools.json` points at `gtkwave64\bin\gtkwave.exe`. No system install was changed, and this binary is not part of the portable HDL-Maker ZIP. `workspace/` is excluded from that package.

Version 3.3.100 is old enough that it is only for local tests of waveform files this project generates with GHDL. It is not for opening waveforms from elsewhere, and it is not the viewer for a public student distribution. The current LTS, 3.3.128, is source only. A newer maintained Windows build is still to be chosen before a student release.

The M4a pytest dumps were temporary, so the same gate testbench was simulated again for 100 ns into `workspace/simulations/m4a1-gate-ghw/` and `m4a1-gate-vcd/`. Those are the files that were opened.

GTKWave 3.3.100 reads the GHW hierarchy as `top.gate_tb.a`, `top.gate_tb.b`, `top.gate_tb.y`, `top.gate_tb.uut.a`, `top.gate_tb.uut.b`, and `top.gate_tb.uut.y`. The same VCD is `gate_tb.a` through `gate_tb.uut.y`, without the `top` root. The prepared object id `po_y` still has the path `/gate_tb/uut/y`. That matches the VCD name. The GHW name has the extra viewer root `top`. The stored path was not rewritten. The other five names still have no object id.

`ghwdump` from that install shows two values at 0 fs, then a hold: `a`/`b`/`y` are `'0'`, `'0'`, `'U'`, then `'1'`, `'1'`, `'1'`. The next recorded time is 10 ns, and the values are still `'1'`. The run command contains `--stop-time=100ns`. The GHW file's last time is 10 ns, which is the `wait for 10 ns` in the testbench. The GHW window shows that range, From 0 to 10 ns, with `a`, `b`, `y`, and the instance `y` held high. The VCD file only has the final value at time 0, so its window is From 0 sec To 0 sec and the same four names are in the signal list.

One `.gtkw` for the GHW names and one for the VCD names were written by GTKWave itself. Opening a copy of the GHW together with the GHW save file showed the same four signals. The studio start passed the waveform and the save file, and the GTKWave process kept running after the request returned.

## Not in this milestone

- A waveform view in the browser (M4b)
- Live simulation
- Vivado
- A new portable ZIP
