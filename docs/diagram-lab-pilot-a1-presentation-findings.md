# Application Pilot A1 — Presentation and Usability Findings

**Status:** Findings **accepted** (26 Nov 2026). **P0–P5b** functionally accepted. **A1 formally closed** — [a1-final](diagram-lab-pilot-a1-final-evaluation.md).  
**Source:** Manual A1 pilot (synchronous counter sketch) — connectivity OK; presentation insufficient for teaching/docs.  
**Related:** [diagram-lab-application-pilots.md](diagram-lab-application-pilots.md), [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md), [d5d0a-s5b-stub-endpoint-drag.md](d5d0a-s5b-stub-endpoint-drag.md), **[diagram-lab-pilot-a1-grid-stacking-findings.md](diagram-lab-pilot-a1-grid-stacking-findings.md)** (grid over blocks — defect).

### Review decision (product)

- Presentation control outranks new symbols / Library Manager for the next editing slices.
- P0→P1→P2→P3 stepwise; optional P4 later.
- Keep A1 JSON for before/after after each slice.
- Layers: **semantics** (names, connectivity) ≠ **persistent presentation** (display text, colours, visibility) ≠ **editor view state** (selection, handles, grid, snap, zoom).

---

## 1. Current capability inventory

| Capability | Status | Where |
| --- | --- | --- |
| Editable text *inside* a block (instance display) | **Missing** | `Block` has only `name`; no `displayText` |
| Centred multiline block text | **Partial** | Plain blocks: `.block-name` is centred in the box but is the **instance name**, single-line CSS flex; wraps awkwardly |
| Symbol-embedded labels | **Present** | `SymbolLabel` + `SymbolShape` `kind: 'text'` via `SymbolFace` — **symbol-level**, fixed in symbol coords, not instance override |
| Independent instance name vs display text | **Missing** | Only `Block.name` |
| Hide instance name | **P1 done** | `Block.showName === false` hides glyph; Properties checkbox; logical name kept |
| Hide port names | **P1 done** | `Block.showPortNames === false` hides pin text; marks stay |
| Hide wire / net labels | **P1 done** | `Label.visible === false` per **segment**; other segments on same named net unaffected |
| Block fill colour | **Missing** | CSS `#fff` / transparent for symbols; no document field |
| Block border colour | **Missing** | CSS `#243140` / none for symbols |
| Block text colour | **Missing** | CSS only |
| Grid visibility | **Coupled** | Toolbar Snap toggles `snapOn` → grid **and** snap together (`v-if="snapOn"`) |
| Grid vs block stacking | **P0b done** | `svg.world-grid` under Vue Flow; see [grid stacking](diagram-lab-pilot-a1-grid-stacking-findings.md) |
| Wire bend (vertex) handles | **P0 done** | Square handles only when wire selected; ~6 CSS px (world = px/zoom) |
| Free-end markers | **P0 done** | Unselected: small open tip; selected: edit handle; S5b geometry unchanged |
| Junction markers | **Correct** | Permanent filled `.junction` — semantic |
| Resize handles | **OK** | Only when block selected |
| Wire name edit | **Present** | Select wire → Properties → Name (logical net) |
| Add extra wire label | **Present** | Wire properties → Add label |
| Label drag / fontSize | **Present** | D5c.1; optional `Label.fontSize` |

**Conclusion:** A1 pain is almost entirely **presentation control**, not missing shapes or Library Manager.

---

## 2. Instructions for features already available (no new code)

| Goal | What to do today |
| --- | --- |
| Rename instance | Select block → Properties **Name** |
| Rename net / label text (name labels) | Select wire → Properties **Name** |
| Move a wire label | Drag the label (D5c.1) |
| Smaller stub labels (generator) | Bench stubs use compact `fontSize`; manual wires use default unless set in data |
| Hide grid (also disables snap) | Toolbar **Snap** off |
| Edit symbol artwork / symbol text | Open symbol editor / copy symbol to user library — affects **definition**, all instances |
| Remove a wire entirely | Select wire → Del |
| Junction vs bend | Only real junctions are filled dark dots; bend circles are edit chrome |

After **P0**: bend handles appear only on the selected wire. Free ends keep a small tip when unselected. There is still **no** UI to hide port/instance names or set fill colour (P1–P3).

---

## 3. Identified presentation limitations (A1)

1. **Instance names** always visible (and on symbols, perched above the body) — compete with intended “Register 4 Bit” style titles.  
2. **Port names** always on — collide with wire labels (`clk` vs `CLOCK`).  
3. **Bend handles** always on all wires — dominate the look; scale with zoom (world `r=6`).  
4. **Free-end handles** always on — useful for edit, noisy for screenshots.  
5. **No instance fill** — diagrams look flat / unfinished for teaching.  
6. **No instance display text** — cannot centre a teaching title without renaming the instance or editing the shared symbol.  
7. **Wire labels** cannot be hidden without deleting geometry or renaming nets.  
8. **Grid** cannot hide while keeping snap.

---

## 4. Proposed minimal implementation slices

Aligned with ADR layers: semantics ≠ geometry ≠ **persistent style** ≠ **transient chrome**.

### Slice P0 — Transient chrome (renderer only; no schema) — **implemented**

| Change | Behaviour |
| --- | --- |
| Bend handles | Only when `wire.id === selectedSegment`; **square** `.bend` (~6 CSS px); transparent `.bend-hit` for hit target |
| Free-end | Unselected: small open `.free-end.tip`; selected: filled edit handle; transparent `.free-end-hit` |
| Junctions | Unchanged (always on) |
| Hit-testing | Wire hit stroke + freeEndNear + handle hits preserved; existing bend→span and S5b free-end drag unchanged |
| History / schema | None |

- Fewer bend DOM nodes when many wires unselected → **possible** D5d win; measure before claiming.  
- Existing bend interaction remains span-axis move (not freigegeben as full vertex drag).

### Slice P1 — Visibility flags — **implemented**

See [diagram-lab-pilot-a1-p1-visibility.md](diagram-lab-pilot-a1-p1-visibility.md).

| Field | Default | Effect |
| --- | --- | --- |
| `Block.showName?: boolean` | omit = show | `false` hides instance name glyph |
| `Block.showPortNames?: boolean` | omit = show | `false` hides pin name text; marks stay |
| `Label.visible?: boolean` | omit = show | `false` skips paint; toggled for labels on the **selected segment** only |

Omit field ⇒ today’s appearance. Showing again **deletes** the flag. Properties remain usable when glyphs are hidden.

### Slice P2 — Instance display text — **implemented**

See [diagram-lab-pilot-a1-p2-display-text.md](diagram-lab-pilot-a1-p2-display-text.md).

| Field | Behaviour |
| --- | --- |
| `Block.displayText?: string` | Multiline (`\n`); centred HTML overlay in the instance box |
| `Block.showDisplayText?: boolean` | omit = show when text set; `false` hides |

No separate text engine. Symbol-level labels unchanged.

### Slice P3a — Display text position — **accepted** (visual)

| Field | `Block.displayTextOffset?: { x, y }` (centre-relative; omit = centred) |
| --- | --- |
| Interaction | Drag caption on selected block; Reset text position |
| Doc | [p3a-text-position](diagram-lab-pilot-a1-p3a-text-position.md) |

### Slice P3 — Minimal instance colours — **function confirmed**

See [diagram-lab-pilot-a1-p3-block-appearance.md](diagram-lab-pilot-a1-p3-block-appearance.md).

| Field | Behaviour |
| --- | --- |
| `Block.style?: { fill?; fillTransparent?; stroke?; text? }` | Instance overrides; closed shapes + plain boxes |
| Reset | Clears `style` only (keeps P1/P2) |

No gradients/shadows/framework.

### Slice P4 — Grid vs snap — **accepted**

| Setting | Behaviour |
| --- | --- |
| Show grid (`showGrid`) | Editor view state; paint only on `svg.world-grid` |
| Snap to grid (`snapOn`) | Editor view state; geometry rounding |

Independent toolbar toggles; no document history. Doc: [p4-grid-snap](diagram-lab-pilot-a1-p4-grid-snap.md).

### Slice P4a — Consistent geometry snapping — **function confirmed**

Free wire bends, stub finish, bend drag, junction drag reuse `snapValue`. Hit-test before quantise. Doc: [p4a-geometry-snapping](diagram-lab-pilot-a1-p4a-geometry-snapping.md).

### Slice P4b — Editor preferences (grid/snap spacing) — **accepted**

Independent `gridSpacing` / `snapSpacing`; fixed `MIN_BLOCK_SIZE` / duplicate / nudge. Doc: [p4b-preferences](diagram-lab-pilot-a1-p4b-preferences.md).

### Slice P5 — Flexible wire labels — **investigation**

Free 2D label offset (P5a); name labels on arbitrary net segments (P5b). Bus-width marks deferred. Doc: [p5-wire-label-investigation](diagram-lab-pilot-a1-p5-wire-label-investigation.md).

### Later (not in minimal pack)

- Wire stroke style (dash/colour/markers).  
- Edge/vertex drag freigabe.  
- Free-angle routing.  
- Library Manager / Shape Designer.

---

## 5. Compatibility

| Rule | How |
| --- | --- |
| Old JSON | Missing optional fields ⇒ current look |
| Connectivity | Unchanged by hide/colour/display text |
| HDL / names | `Block.name`, `Port.name`, `Net.name` remain canonical |
| History | Persistent presentation edits = normal undo; handle show/hide = no undo |
| Parse | Prefer explicit optional fields (do not rely on stripped unknown keys — see style ADR) |

---

## 6. Recommended implementation order

1. **P0** — accepted (visual).  
2. **P0b** — accepted (visual); [interaction record](diagram-lab-pilot-a1-p0b-regression.md).  
3. **P1** — **done** (await acceptance).  
4. **P2** centred multiline display text — freigabe.  
5. **P3** fill (+ optional border) — freigabe.  
6. Optional **P4** grid/snap split — freigabe.  
7. Re-style the **same A1 JSON** for before/after.  
8. Continue pilots A2→B2→B3→B1.

---

## 7. Potential impact on D5d

| Factor | Effect |
| --- | --- |
| Bend handles | P0 skips rendering for unselected wires — fewer nodes; **unmeasured** |
| Free-end tips | Still one tip (+ hit) per free end when unselected |
| Labels / port texts | Unchanged until P1 |
| Measure | Re-run after P0 before claiming a win |

Do not delay D5d indefinitely for presentation slices.

---

## 8. Relationship to open gates

| Item | Note |
| --- | --- |
| S5b | **Accepted** — geometry/gesture unchanged by P0 |
| S4 Port Drag | Still TBD confirmation |
| Edge / vertex drag | **Not** released; P0 presentation + existing bend→span only |
| Style ADR / vision | P1–P3 instantiate the smallest instance-style path |
| Pilots | Keep A1 JSON; compare after each accepted slice |

---

## 9. P0 acceptance (manual)

1. Load a diagram with several orthogonal wires and stubs (e.g. A1).  
2. **Unselected:** no square bend handles; free ends show only a small open tip; junctions remain filled dots.  
3. **Select a wire:** wire highlights; interior bends show small squares; free ends on that wire show larger edit handles.  
4. Deselect: bend squares disappear; free tips return to small open markers.  
5. Drag a free end (S5b), drag a span, click a bend square (existing span-axis move), zoom in/out (handle screen size roughly constant).  
6. Draw a new Port↔Free stub (S5a dblclick), step-undo (S5a.1), Esc cancel.  
7. Undo/redo a geometry edit; save/reload — appearance rules still apply; JSON schema unchanged.

**Changed files:** `diagram-lab/src/view/DiagramStage.vue`, `diagram-lab/src/style.css`, this doc + pilots/handoff links.

### P1 acceptance (manual)

1. Select a block → uncheck **Show instance name** / **Show port names** → glyphs hide; Name field still editable.  
2. Select a wire → uncheck **Show wire label** → that segment’s labels hide; other segments on the same named net stay; net Name still editable.  
3. Undo/redo restores visibility.  
4. Save/load and duplicate keep flags.  
5. Connectivity and logical names unchanged.

**Changed files (P1):** `document.ts`, `edit.ts`, `BlockNode.vue`, `SymbolFace.vue`, `DiagramStage.vue`, `style.css`, `selfcheck.ts`, docs.

**Stop:** await user acceptance of P1 before P2.
