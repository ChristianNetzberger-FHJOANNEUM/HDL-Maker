# M3a limitations

M3a generates structural VHDL for a block diagram. The project setting `vhdl_standard` is `"93"` or `"2008"`. A project file that has no field loads as VHDL-93. The Preferences tab edits the setting. It is not stored in `ui.json`, and it is not stored on the diagram.

## Three different compatibility claims

1. **Language-standard compatibility.** The generator emits syntax for the selected standard. VHDL-93 and VHDL-2008 share one netlist. The difference is which constructs the backend accepts, not a compiler flag added afterwards.
2. **GHDL analyzer compatibility.** When `ghdl` is on `PATH`, generation runs `ghdl -a --std=93` or `ghdl -a --std=08` on every unit, in dependency order, then `ghdl -e` with the same flag. Each standard has its own `--workdir`. The default library profile is `ieee` and does not add `-fsynopsys`, `-fexplicit`, or another relaxed mode. The optional Synopsys legacy profile is a separate project setting and is described in `docs/m3c-validation.md`. The result records analysis and elaboration separately. GHDL 6.0.0 mcode (`ghdl.ghdl.ucrt64.mcode`, user-scope winget install of the official release zip) analyzed and elaborated the reference hierarchy for both standards. A machine without `ghdl` on `PATH` still reports both steps as not run.
3. **Vivado synthesis compatibility.** Not measured. Vivado has accepted subsets of VHDL-2008 for a long time, and that support has to be enabled. It is not the whole VHDL-2008 standard. VHDL-93 is the conservative target for an older install, including Vivado 2019.1. M3a did not run Vivado 2019.1 and does not claim those files synthesize there. An M5 toolchain profile may later reject constructs that the language standard still allows.

## What is generated

- Entity, generics, ports, architecture, internal signals, direct entity instantiation, generic maps, and port maps.
- A net with one top-level port uses that port as the actual for every instance on the net. A slice stored on that port stays on the actual, as in `nibble => data(3 downto 0)`. A slice stored on an instance port stays on the formal.
- A net with no top-level port becomes one internal signal. Its type is the net's stored type, or the one type and range stated by every connected port. A missing or conflicting type stops the design. No width is filled in from a number the source did not state.
- Child designs are found by diagram id. A missing child, a port list that does not match, and a cycle are reported. The affected hierarchy is not written.
- An empty `architecture_name` is written as `rtl`. That name is a generator default for the architecture, not a guessed port or width. The diagram file is not changed.
- A recorded `component_library` is copied into `entity <library>.<entity>`. A library other than `work` also gets a `library` clause immediately before the architecture. A child with no library name is instantiated as `work`. GHDL compiles generated files into `work`. It does not compile a foreign source. An external unit elaborates when that library has already been analyzed and is passed with `-P`. Without that library, analysis stops and the diagnostic names the file and line.
- Output is `workspace/generated/vhdl-93/` or `workspace/generated/vhdl-2008/`. Each run writes `manifest.json` with the selected standard. A run that reports an error does not replace those files. Original HDL, `libs/`, and the editable diagram JSON are not written.

Changing coordinates, wire points, zoom, or the FSM text size does not change the VHDL. Those values are not read.

## Embedded HDL text

The text is copied unchanged into either the architecture declarative part or the concurrent statements. A block is declarative when its statements are library, use, signal, constant, type, component, or the other declarative forms recognized by the classifier. A process, a concurrent assignment, or an instantiation is concurrent. Comments alone stay in the declarative part.

A block whose context is mixed or unrecognized produces `embedded_context_unresolved`. It is not inserted, and that design is not written.

## VHDL-93

These forms are reported as `vhdl93_unsupported` and are not rewritten:

- `process(all)`
- an interface generic whose type text is `type`, `package`, `function`, or `procedure`
- the condition operator `??`
- a conditional expression (`when`) in a generic value, a port default, or a slice

Direct entity instantiation, generic maps, port maps, and ordinary slices are emitted for both standards. Interface lists use `;`. Association lists use `,`. `process(all)` is not turned into an explicit sensitivity list.

## GHDL 6.0.0 results

The reference design `top_chain`, `stage_a`, and `stage_b` was analyzed and elaborated with `--std=93` and, in a separate work directory, with `--std=08`. Children are analyzed before the parent. `stage_a` declares `WIDTH : integer := 8` and a port `nibble : in std_logic_vector(3 downto 0)`. The generic does not size that port. The actual `data(3 downto 0)` matches the formal, and elaboration succeeds. Moving coordinates does not change the text.

A connection of `std_logic_vector(7 downto 0)` to `std_logic_vector(3 downto 0)` without a slice is still generated as `nibble => data`. GHDL analysis then fails at that line with `actual constraints don't match formal ones`. The ports are not rewritten to make the file compile. Elaboration is not started after that analysis error.

A missing child stops generation, so GHDL is not run. An unconstrained `std_logic_vector` port is emitted without an invented range. GHDL analyzes that file and refuses to elaborate it as a top entity. A `process(all)` block is analyzed and elaborated only for VHDL-2008.

Vivado was not run.

## VHDL-2008

Implemented and covered by tests:

- the same structural forms as VHDL-93
- `process(all)` kept exactly, and only as a concurrent block
- an interface generic whose type text is `type`, written as `name : type`

`package` and `function` generics, `??`, and conditional actuals return `construct_not_implemented`. Selecting VHDL-2008 does not enable them, and it does not imply Vivado support.

## Not in this milestone

- FSM VHDL (M3b), simulation UI (M4), and Vivado integration (M5)
- SystemVerilog
- a new portable ZIP
- further HDL Designer migration
- inventing a missing port, direction, type, width, or default
