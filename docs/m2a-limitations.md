# M2a limitations

M2a edits a copy of an imported block diagram. These limits are known from `libs/sbus_rtc_lib` and are left for a later milestone.

## Kept, and still not a full HDL model

- Embedded blocks `mux`, `eb1`, and `eb2` now keep the `HdlTextMgr` source. The editor shows that text. It does not parse the statements.
- A wire field `sl` is the start-side slice. In this library that is `ramp(31 downto 22)` on `fxgen` and `h_cnt(2 downto 0)` on `vga_txt_core`. Those two no longer show up as a net-name conflict. The slice stays on the wire and on the start endpoint.
- `top_rtc_app` still differs where the diagram net is `scl1` and the generated VHDL says `scl1_internal`. That is a different name, not a slice.
- Unknown record types remain as preserved payloads. The editor does not draw `FFT`, `Mux`, `CommentGraphic`, or `PageSetupInfo`.

## Editor limits

- New wires use one elbow. Existing wires keep their imported points. There is no global router.
- A port whose direction was not in the diagram or the entity is reported as unknown. The check does not invent a mode or a width.
- Two ports that already belong to different nets are not merged.
- Deleting an instance asks for confirmation when wires are attached, then removes those wires.
- Undo stores document snapshots, up to 40. It is local to the open page.
- `tb_audio1/symbol.sb` still has a symbol body and no placed ports. Adding that component creates an instance without pins.
- State diagrams are still counted only. M2c is the FSM import. M2a does not edit them.
- The original view and the editable copy are separate. Saving writes `workspace/diagrams/edg_*.json` and does not write `.bd`, `.sb`, `.sm`, or `.vhd`.
