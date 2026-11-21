# HDL Designer graphical format investigation

The sample is the local library `libs/sbus_rtc_lib`. The scan reads it and does not write it. This note records only structures that appear in those files.

## File kinds

| Extension | Role in this library | Count |
| --- | --- | --- |
| `.bd` | Block diagram | 8 |
| `.sb` | Symbol | 46 |
| `.sm` | State diagram | 14 |
| `.ibd` | Interface diagram | 0 |
| `.fc` | Flowchart | 0 |
| `.tt` | Truth table | 0 |
| `._epf` | Default view reference | 55 |

The whole scan still sees 376 files, 58 entities, 58 architectures, 1 package, 1 package body, and 118 design units. Six files under `work/` are larger than 2 MB (`.qpg` and `vsim.wlf`) and are listed, not parsed. Hidden directories stay skipped unless `--include-side-data` or `include_side_data` is set. Those files are listed and still not parsed.

`hds/_audio_gain._epf` is two text lines:

```
DEFAULT_FILE atom audio_gain/struct.bd
DEFAULT_ARCHITECTURE atom struct
```

## Grammar

`struct.bd`, `symbol.sb`, and `fsm.sm` share one text envelope. The first line is `DocumentHdrVersion "1.1"`. Records look like `(TypeName key value ...)`. Arrays use `[...]`. `*N` labels an object and `&N` refers to that object. Strings are quoted. Atoms include integers and values such as `994,0`.

The header carries `instances` for component instances and `embeddedInstances` for HDL text blocks. The drawing itself is `model (BlockDiag ...)`, `model (Symbol ...)`, or `model (StateMachine ...)`. `optionalChildren` holds the drawn objects. Fields whose names start with `default` are prototypes, not placed objects. In `audio_gain/struct.bd` that includes `defaultSaComponent`.

Variable pairs under `VariableExpander` name the design unit. `entity_name` is `audio_gain` and `arch_name` is `struct`. The expander still contains the old absolute paths under `C:\HDL\ip_repo\sbus_rtc_lib\`. Those paths are not used as identity.

## What a block diagram stores

From `hds/audio_gain/struct.bd`:

- `SaComponent` is a placed component. `uid 994,0` matches header instance `U_0`. The component name and library name are `Text` records with `tm` `CptNameMgr`, `InstanceNameMgr`, and `BdLibraryNameMgr`. The body rectangle is `shape (Rectangle xt "-41000,46000,-22000,52000")`.
- Generics are `GiElement` records. `U_0` has `nbits_g` / `integer` / `24`.
- `CptPort` is a pin on that component. The declaration is `thePort (LogicalPort decl (Decl n t b))`. `U_0` has seven pins, including `sig_i` and `enable_o`.
- Diagram pins are `PortIoIn` and `PortIoOut`. The visible name is the `Text` with `tm "WireNameMgr"`. The direction used by the importer is the record type. `PortIoInOut` and `PortIoBuffer` exist in this grammar as default prototypes; this particular diagram does not place one.
- `Net` holds `decl (Decl n t b)`. `Wire` holds an `OrthoPolyLine` `pts` list plus `start &object`, `end &object`, and `on &net`.
- `HdlText` is an embedded HDL block. The name and number are `HdlTextNameMgr` and `HdlTextNumberMgr`. `audio_gain` has `mux` / 19, `eb1` / 1, and `eb2` / 2. These are not component instances.
- Titles on `U_0` sit at Y 52000–55000, above the rectangle at Y 46000–52000. In this file, Y increases upward. The viewer flips Y for the screen and keeps the source numbers in the JSON.

`marker_m` is the integer field `m` on `LogicalPort`. Outputs in this symbol and on `enable_o` carry `m 1`. Inputs in the same files omit it. The importer stores the integer and does not treat it as a VHDL mode.

## Symbol and state diagram

`symbol.sb` uses the same envelope. The drawn pins are `CptPort` records under `SymbolBody`, with triangle extents. The logical table is `LogPort`. For `audio_gain` both lists name the same 14 ports, and the importer keeps the drawn pins because they have coordinates.

`fsm.sm` uses the same envelope with dialect 11. The header `Machine` is named `csm` and the nested machine sets `stateSignalName "current_state"`. `hds/audio_fifo_ctrl/fsm.sm` contains 7 `State` records and 9 `Transition` records. Those records are counted. Their fields are not converted into an editable state machine.

## Records that are kept but not interpreted

Every record type seen in `audio_gain/struct.bd`, `audio_gain/symbol.sb`, and `audio_fifo_ctrl/fsm.sm` is in the known set. A type outside that set is stored as JSON, including its fields, and the diagram is marked partial with `hds_record_preserved`.

In the rest of this library the preserved types are:

| Type | Occurrences | Where |
| --- | --- | --- |
| `FFT` | 21 | several symbols and three block diagrams |
| `CommentGraphic` | 4 | `fxgen/struct.bd` |
| `Mux` | 3 | `fxgen/struct.bd`, `top_rtc_app/struct.bd` |
| `PageSetupInfo` | 2 | `codec_interface/struct.bd`, `fxgen/struct.bd` |

`audio_gain/struct.bd` has none of these. A reduced example with one unknown `FutureWidget` is covered by the parser test. The imported `audio_gain` diagram is `docs/examples/audio_gain_struct.diagram.json`. The ids in that file are readable stand-ins derived from the HDL Designer `uid`. A real import stores random ids in `workspace/project.json`.

## Comparison with generated VHDL

The checker reads `hdl/{entity}_{architecture}.vhd` and compares instance labels, component names, generic values, and port-map actuals for pins that a wire connects to a named net. It does not rewrite either side.

`audio_gain` matches `hdl/audio_gain_struct.vhd`: `U_0` and `U_1` are `comp_barrelshifter`, `nbits_g` is 24, and the connected pins use the same signal names. `enable_o => open` has no diagram wire to a named net, so it is not reported as a conflict.

Four differences remain elsewhere. They are reported and were not corrected:

- `fxgen` pin `addr` of `U_1` is net `ramp` in the diagram and `ramp(31 downto 22)` in VHDL.
- `vga_txt_core` pin `font_column` of `U_3` is net `h_cnt` in the diagram and `h_cnt(2 downto 0)` in VHDL.
- `top_rtc_app` pins `i2c_scl1_t` and `i2c_scl1_i` of `U_6` use net `scl1` in the diagram and `scl1_internal` in VHDL.

## The two inventory errors

Both errors are `unterminated_design_unit` from the VHDL interface extractor, not from a damaged diagram file.

- `hdl/bhv_adc_model.vhd` architecture `behave` contains a function that ends with `end;`. The extractor treats that `end` as the end of the architecture, then does not see `end behave;`.
- `hdl/sine_lut.vhd` architecture `rtl` does end with `end architecture rtl;`. The body is a large aggregate and the concurrent assignment is missing a closing parenthesis. The extractor still reports the architecture as unterminated.

The other warnings on design units are unresolved vector widths (53) and duplicate unit names (8). Those are limits of the interface extractor. The library files were left unchanged.
