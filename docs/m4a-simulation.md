# M4a simulation

M4a runs a VHDL testbench with GHDL 6.0.0 and can open the waveform in GTKWave. It does not draw the waveform in the browser. That is M4b.

## What the studio stores

The simulation block on the project is separate from `ui.json`:

| Field | Meaning |
| --- | --- |
| `testbench_unit_id` | The VHDL entity that is elaborated and run. The hierarchy root is not used. |
| `stop_time` | A positive duration such as `1us` or `100ns`. The unit is `fs`, `ps`, `ns`, `us`, `ms`, `sec`, `min`, or `hr`. |
| `waveform_format` | `ghw` or `vcd`. GHW is the default. |
| `generic_overrides` | Optional `name` / `value` pairs for generics of the testbench entity. A value is one token. |
| `gtkw_path` | Optional GTKWave save file for this configuration. It is reused by later runs. HDL-Maker does not write the signal list. |

`vhdl_standard` and `library_profile` are the existing project settings. The simulation does not keep a second copy.

## GHDL pipeline

The runner is the same command builder used for M3c.

1. Walk the selected entity, its architectures, `work` packages, and instantiations recorded by the library scan.
2. Order the files so a package precedes its body and a instantiated design precedes the file that instantiates it.
3. `ghdl -a`, then `ghdl -e`, then `ghdl -r`, with one `--workdir` per run.
4. Pass `--std=93` or `--std=08`.
5. Pass `-fsynopsys -fexplicit` only when the library profile is `synopsys`.
6. Pass `-gNAME=VALUE` on elaboration and on the run. GHDL mcode applies a top-level generic when the simulation starts.
7. Pass `--stop-time` and either `--wave=<file>.ghw` or `--vcd=<file>.vcd`.

`ieee` and `std` packages come from GHDL. A `work` package or an instantiated entity that is not in the project is `missing_dependency`, and GHDL is not started. A missing file on disk is the same diagnostic.

The process is started with an argument list. `shell=True` is not used. Output is written only under the workspace. The HTTP request returns as soon as the run is accepted. A second run is refused while one is active. Cancel terminates the GHDL process. A stage that runs longer than its wall-clock limit is stopped: 60 seconds for analysis or elaboration, 10 minutes for the simulation.

Analysis, elaboration, and simulation each record `not_run`, `passed`, or `failed`. A failed analysis does not elaborate. A failed elaboration does not simulate.

## Run directory

Each run is `workspace/simulations/<run-id>/` and is not overwritten.

- `config.json` — the settings and the inherited standard and profile
- `manifest.json` — source files, the GHDL argument lists, and the signal map
- `analysis.log`, `elaboration.log`, `simulation.log`
- `report.json` — status, diagnostics, timestamps, and duration
- `waveform.ghw` or `waveform.vcd`
- `work/` — the GHDL library for that run

## Signal names

The manifest lists stable HDL-Maker ids beside a hierarchical VHDL path. A port of the testbench is `/{entity}/{port}`. A port under an instance label read from the architecture is `/{entity}/{label}/{port}`. Diagram ports, nets, and instances are included when their names match that path. The map is prepared for M4b and for a later ILA view. It is not read back out of the waveform file.

## GTKWave

The health check reports the GTKWave executable from `workspace/tools.json` when that path is a file, and otherwise `gtkwave` on `PATH`. The executable path is not a diagram setting and not a project field. Open in GTKWave starts that program with the waveform path and, when the simulation configuration names an existing `.gtkw` file, that save file. If GTKWave is absent, the path is not a file, or the save file is missing, the studio says so and leaves the waveform where it is. HDL-Maker does not install GTKWave. M4a.1 records the check: `docs/m4a1-gtkwave.md`.

## Checks

GHDL 6.0.0 mcode ran these cases:

- A two-input gate and its testbench, writing both a GHW and a VCD file. The second run did not replace the first.
- A testbench generic `WIDTH` overridden to `4`. The simulated integer output was 4.
- An assertion `severity failure` with the message `boom`. Analysis and elaboration passed. Simulation failed.
- A testbench that instantiates a design the project does not contain. The diagnostic names it, and GHDL is not started.
- A stop time of `later` or `0ns` is rejected before a process starts.
- The existing `morse_transmitter` comparison testbench, with `utilities` analyzed first and the Synopsys legacy flags. `--stop-time=1us` produced a GHW file. The original sources were not modified. This short run is not the 19,300,012-cycle comparison from M3c.

Command lists are tested without starting GHDL. The studio request returns while a slow run is still marked running.

## Not in this milestone

- A waveform drawing inside the browser, or clicking a diagram net to select a trace (M4b)
- Automatic testbench generation
- Interactive forcing of signals
- Mixed-language simulation
- Vivado, or a new portable ZIP
