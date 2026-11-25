# D0 feasibility

D0 is a working prototype and a license reading. It is not the HDL-Maker editor.

Run it from `diagram-lab` with `npm install`, then `npm run dev`. The page is `http://localhost:5174/`. It does not start the Python API. `npm run selfcheck` checks the document rules without a browser. `npm run check` is `vue-tsc`.

## What HDL-Maker already has

| Piece | Keep for now | Replace later, in the engine |
| --- | --- | --- |
| `EditableDiagram` schema 1 and `find_by_source` | Yes. Opening `top_rtc_app` and `morse_transmitter` still returns those ids. | An adapter may project a file into the engine document. It does not run in D0. |
| `DiagramEditor.vue`, `DiagramView.vue`, `StateEditor.vue` | Yes. They remain the studio. | The studio view, after D4, not during D0–D3. |
| Net endpoints versus wire polylines | The idea. The generator reads endpoints and ignores geometry. | The engine segment and label anchor. The studio's absolute `label_x` stays until an explicit edit. |
| Undo snapshots in the studio store | The same idea, capped at 40. | The lab has its own history. The two histories are not shared. |
| `analyze` and `render_vhdl` | Yes. Untouched. | Still the only structural generator. |
| `.bd` and `.sm` import | Yes. Those files are not written. | No writer in this program. |

`DiagramView.vue` is no longer mounted. `DiagramEditor.vue` is the studio block editor. It is coupled to the Pinia store and to HDL checks. That coupling is why the lab does not import it.

## Libraries

Versions below are the ones named by the registry on 23 November 2026. The lab installs Vue Flow, `perfect-freehand`, and `simplify-js`. It does not install elkjs or tldraw.

| Library | Version | License | Use in D0 |
| --- | --- | --- | --- |
| Vue | 3.5.x | MIT | The lab UI. |
| `@vue-flow/core` | 1.48.2 | MIT | Blocks, drag, zoom, pan. `updateNodeInternals` runs after the port list changes. Edges are empty. |
| `perfect-freehand` | 1.2.3 | MIT | Stroke outline only. The centerline is the saved geometry. |
| `simplify-js` | 1.2.4 | BSD-2-Clause | Reduces a stroke before orthogonalization. Keep its notice if the lab is distributed. |
| elkjs | 0.12.1 | EPL-2.0 OR GPL-3.0-or-later | Not installed. Auto-layout is not part of D0. The GPL alternative is not usable in this MIT project. EPL redistribution is unread and unapproved. |
| tldraw | 5.6.2 | `SEE LICENSE IN LICENSE.md` | Not installed. Not the editor base. |
| Pointer Events | browser API | — | Mouse and pen pressure. Touch was not exercised. |
| SVG | browser | — | The world layer. Canvas was not required. |

## Demonstrator

The page opens two blocks and one orthogonal wire with two bend handles. The label `link` is anchored to the vertical edge.

Checked without the browser, `src/core/selfcheck.ts`:

- Moving Block A to the right leaves the trunk x at 350 and the label at (366, 250). The anchor distance stays 70. Net and segment ids stay `net_link` and `seg_link`.
- Moving Block A down moves the label with that edge, to (366, 280).
- A second net that crosses the first keeps its own id.
- An L-shaped stroke becomes an orthogonal polyline. A stroke with many turns is refused.
- `extensions` and an unknown top-level field survive save and load.
- Undo restores a block. Redo applies the move again.

Checked in the browser at `http://localhost:5174/`:

- Fit-to-view zoom was 2.5. The SVG transform used that same viewport. The wire points and the label position matched the document, not a second coordinate system.
- ArrowRight on Block A moved it by 20. The wire start moved from x 240 to 260. The trunk stayed at 350. The label stayed at world (366, 250). Undo restored the wire to `240,180 350,180 350,320 460,320`.
- Add port raised the port count from 2 to 3 and moved the connected pin from y 180 to y 160. The segment still cited the same port.
- A freehand stroke was stored as ink. Convert showed a preview and left the ink in place. Confirm replaced the ink with a second wire and a `sketch` label. The original `link` wire remained. Undo removed that wire and restored the ink.
- Round-trip reported that ids, nets, segments, and anchors survived a serialize and parse. Save JSON wrote `schemaVersion` 1 and `doc_demo`.

The automated drag gesture did not move a Vue Flow node. Keyboard nudge and the core move use `moveBlock`, which is the same function the node drag-stop handler calls.

## Limits

- A port-to-port wire has two bend handles and one free value, the trunk x. Both handles set that x.
- Orthogonal conversion refuses more than six corners and refuses a very short stroke. It can leave a short closing segment, as it did on the browser stroke.
- Conversion does not create a net until Confirm. A crossing is not a connection. Ends snap to a port only when they fall within 20 world units. Otherwise they stay free ends.
- Pressure is stored when the pointer event reports it. A mouse often reports a constant pressure.
- Touch, pinch, and a second pointer were not tested.
- `top_rtc_app` was not loaded into the lab. The SVG wire layer is the planned way to draw hundreds of wires. That claim is not a measurement.
- The lab does not open HDL-Maker, Nuxt, GHDL, or Vivado.

## Migration and Nuxt

Do not rewrite `edg_*.json` as part of adopting the engine. The adapter is specified in [diagram-engine-architecture.md](diagram-engine-architecture.md) and is not implemented.

Nuxt should import the Vue package inside a client-only mount, pass a JSON document, and listen for change and check events. It should not point the component at an HDL-Maker store or at a filesystem path. That page is future work.

## Recommendation for D1

D1 should extend this lab, not the HDL-Maker studio. Ten plain blocks, save and load, undo across move, delete, and duplicate, still with no VHDL and no change to `workspace/diagrams/`. D2 is the first step that must keep branched nets and anchored labels under the rules already in the core.
