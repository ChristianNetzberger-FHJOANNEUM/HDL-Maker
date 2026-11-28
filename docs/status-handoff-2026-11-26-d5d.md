# Status handoff — Diagram-Lab / D5d.0-A (26 Nov 2026, evening)

For an **external agent**: read this first, then linked docs. Do **not** invent HDL/hardware. German with the user; English technical names. **No commit / push / ZIP** unless explicitly asked.

Earlier same-day baseline (D5b–D5c): [status-handoff-2026-11-26.md](status-handoff-2026-11-26.md). This file **supersedes the “what’s next” section** for the D5d / stub track.

---

## 1. Standing constraints (unchanged)

| Rule | Detail |
| --- | --- |
| History | One shared project history (Variant A); preview **from baseline** each frame |
| Forbidden without release | `libs/` edits, EditableDiagram product changes, FPGA without approval |
| Locked / deferred | **D5b.6**, **CL**, **EDU**, **D5c.7** (spec only), **S1/S2** selection (until after D5d campaign) |
| D5d.0-B–D | **Closed** until freigegeben (no harness / Benchmark Center yet) |
| `libs/sbus_rtc_lib` | Read-only; no HDS→Lab mapper in D5d.0 |
| Commit | Only when the user explicitly asks |

---

## 2. Acceptance snapshot — this chain

| Item | Status | Doc |
| --- | --- | --- |
| D5b … D5c.6 | Accepted (earlier today / prior) | `status-handoff-2026-11-26.md` |
| D5c.7 wire-only copy | **Deferred** (spec only) | `d5c7-wire-copy-spec.md` |
| D5d.0 prep / Class A–C policy | Spec accepted | `d5d-large-diagrams-prep.md` |
| D5d.0-A0 HDS inventory | Done (stats only) | same prep §5 |
| **D5d.0-A generator** | Implemented; recipe `d5d0a-5` | `d5d0a-generator.md` |
| Fix1 wheel zoom | Accepted | stage wheel + Vue Flow zoom-on-scroll off |
| Fix2 Σ dialog | Accepted | Vue dialog (not `prompt`) |
| Fix3 corridor / ortho routed | Accepted | exclusive tracks |
| Fix4 wiring mode | Accepted | `stubs` (default) \| `routed` |
| Stub pitch + 9px labels | Accepted | compact readable stubs |
| **Stub-move (rigid Port↔Free)** | **Accepted** | `d5d0a-stub-block-move.md` |
| Selection/copy investigation | Analysis only | `d5d0a-selection-stub-copy-investigation.md` |
| **S3 stub-aware block copy** | **Accepted** (15/15 manual; B4–B6 via selfcheck) | `d5d0a-s3-stub-aware-copy.md` |
| **S4 Resize / Port Drag stubs** | **Resize accepted**; Port Drag pending confirmation | `d5d0a-s4-stub-resize-port-drag.md` |
| **S5a Port-originated stub draw** | **Double-click stub accepted** (26 Nov) | `d5d0a-s5a-port-stub-draw.md` |
| **S5a.1 Incremental drawing undo** | **Accepted** (26 Nov) | `d5d0a-s5a1-wire-drawing-undo.md` |
| **S5b Stable free-endpoint drag** | **Accepted** (26 Nov) | `d5d0a-s5b-stub-endpoint-drag.md` |
| Geometry / style architecture | ADR recorded; no implement | `adr-diagram-geometry-routing-style.md` |
| Animation / runtime (optional) | Linked ADR; no implement | `adr-diagram-animation-runtime.md` |
| Strategic vision (F0–F11 orient.) | Vision only; not a work queue | `diagram-lab-strategic-vision.md` |
| Executable Python block diagrams | **ADR accepted** (architecture only — no implement) | `adr-executable-python-block-diagrams.md` |
| Application pilots A/B | Prep accepted; **A1 findings** filed (presentation; no implement) | `diagram-lab-application-pilots.md`, `diagram-lab-pilot-a1-presentation-findings.md` |
| A1 presentation P0 | **Accepted** (visual) | `diagram-lab-pilot-a1-presentation-findings.md` |
| A1 P0b grid stacking | **Accepted** (visual); live interaction **open** | `diagram-lab-pilot-a1-grid-stacking-findings.md`, `diagram-lab-pilot-a1-p0b-regression.md` |
| A1 presentation P1 | **Fully accepted** (9/9) | `diagram-lab-pilot-a1-p1-visibility.md`, `diagram-lab-pilot-a1-p1-fix-undo.md` |
| A1 presentation P2 | **Accepted** | `diagram-lab-pilot-a1-p2-display-text.md` |
| A1 presentation P3 | **Function confirmed** (user) | `diagram-lab-pilot-a1-p3-block-appearance.md` |
| A1 presentation P3a | **Accepted** (visual; persistence open if regressions) | `diagram-lab-pilot-a1-p3a-text-position.md` |
| A1 presentation P4 | **Function confirmed** (4 combos, blocks+wires) | `diagram-lab-pilot-a1-p4-grid-snap.md` |
| A1 presentation P4a | **Function confirmed** (consistent snap) | `diagram-lab-pilot-a1-p4a-geometry-snapping.md` |
| A1 presentation P4b | **Accepted** (preferences available) | `diagram-lab-pilot-a1-p4b-preferences.md` |
| A1 presentation P5 | Investigation accepted | `diagram-lab-pilot-a1-p5-wire-label-investigation.md` |
| A1 presentation P5a | **Accepted** | `diagram-lab-pilot-a1-p5a-label-position.md` |
| A1 presentation P5b | **Accepted** (Remove fix + user confirm) | `diagram-lab-pilot-a1-p5b-remove-label.md` |
| **A1 final pilot evaluation** | **Formally closed** | `diagram-lab-pilot-a1-final-evaluation.md` |
| A2 BPSK + AWGN (symbol library) | **Unique Net Naming closed**; **P5c canonical semantics implemented** — manual 14/14 pending | `diagram-lab-pilot-a2-p5c-wire-arrowheads.md` |
| Vertex-handle / edge / vertex drag (“S5a.2”) | Discussed only — **not** an open work package | needs separate freigabe |
| D5d.0 performance campaign | **Not released** — after S5a/S5b | prep + generator docs |

---

## 3. Product rules added in this track (must not regress)

### Generator (Σ)
- Toolbar **Σ** → dialog: topology A/B/C, size 50…1000, seed, geometry, **wiring**.
- Default wiring **`stubs`**: short Port→free stubs + compact labels; no long striped routes.
- **`routed`**: corridor stress benches (exclusive tracks).
- Generate installs a **project** (`createProject` + `openInstalled`) so Open as stays available.
- Deterministic recipe stamped in `extensions.benchgen` (`d5d0a-5`).

### Stub geometry semantics
| Operation | Attached Port↔Free stubs |
| --- | --- |
| Block move | Rigid translate with block (**done**) |
| Block delete | Removed with ports (**existing**) |
| Copy / Paste / Duplicate / **Shift+Drag** | Implicit copy closure; labels included; **keep name → D5c.5 join** (**S3 done**) |
| Resize / Port drag | Per-port Δ rigid stub translate (**S4**: resize accepted; port drag TBD) |
| Port→Free draw (dblclick) | Checkpointed finish — no companion-bend knick (**S5a**) |
| Free endpoint drag | **S5b accepted** (`placeFreeEnd` + free-end gesture) |

- Attachment = derived (`isBlockAttachedStub` / `attachedStubsForBlocks`) — **no ownership model**.
- Explicit selection does **not** auto-include stubs.
- External Port↔Port (one end outside selection) is **not** copied.
- Unrelated same-name stubs on other blocks are **not** copied/moved.
- Joining named nets on copy can create multi-driver situations in HDL; Lab does **not** add HDL DRC.

### Selection (unchanged; deferred expansion)
- Blocks: `selected` Set; Shift+Click toggles; Shift+Drag = duplicate (≥4 px).
- Wires: at most one `selectedSegment`; marquee = **blocks only**.
- **S1 mixed selection / S2 wire marquee** deferred until **after** D5d performance investigation.

---

## 4. Preliminary performance observations (not quantified)

| Size | Observation |
| --- | --- |
| ~50 blocks | Interactive move still usable |
| >50 | Block drag no longer fluid enough |
| 1000 | Failed to load successfully |

Cause unknown (model / preview / Vue / SVG / Vue Flow / memory). **No optimisations** until D5d.0-B–D measures. Suggested future sizes: add **10 / 25 / 75**.

---

## 5. Key code map (D5d / stubs)

| Area | Path |
| --- | --- |
| Generator | `diagram-lab/src/core/benchgen.ts` |
| Inventory CLI | `diagram-lab/src/core/benchgen-inventory.ts` |
| Stub move + attachment helpers | `diagram-lab/src/core/geometry.ts` |
| Copy / paste / duplicate + stub closure | `diagram-lab/src/core/edit.ts` |
| Σ UI / Shift+Drag | `diagram-lab/src/view/DiagramStage.vue` |
| Label `fontSize` | `diagram-lab/src/core/document.ts` + stage render |
| Regression | `diagram-lab/src/core/selfcheck.ts` |

---

## 6. Verify

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts    # expect: selfcheck ok
npx vue-tsc --noEmit             # expect: exit 0
```

Lab: typically `http://localhost:5174/`.

---

## 7. Agreed roadmap order (product)

| Order | Slice | Status |
| --- | --- | --- |
| 1 | S3 stub-aware copy | **Accepted** |
| 2 | **S4** stub follow on Resize / Port Drag | **Resize accepted**; Port Drag TBD |
| 3 | **S5a** Port-originated stub drawing | **Double-click accepted** |
| 3b | **S5a.1** Incremental wire drawing undo | **Accepted** |
| 4 | **S5b** Stable free-endpoint drag | **Accepted** |
| 5 | Manual application pilots A1→A2→B2→B3→B1 | **A1 closed**; **A2 demonstrator accepted**; **A2-P5a** spec ready; D5d independent… |
| — | ADR geometry / style / animation; strategic vision | Documented only |
| 6 | D5d.0 performance campaign (B–D as freigegeben) | Independent high priority |
| 7 | D5d.1+ optimisations | Only after measurements |
| 8 | S1 mixed selection | Later |
| 9 | S2 marquee + wires | Later |
| 10 | D5c.7 wire-only copy | Remains deferred |

Do **not** reopen S1/S2, D5c.7, edge/vertex-drag (“S5a.2”), or style work without freigabe.

---

## 8. S4 / S5 notes

- **S4:** `capturePortAnchors`, `portAnchorDeltas`, `translateAttachedStubsByPortDeltas` in `geometry.ts`; wired into `moveBlock`, `setBlockFields`, `placePort`. Details: `d5d0a-s4-stub-resize-port-drag.md`.
- **S5a:** `pointsBeforeFreeBend` + `finishFree({ fromBeforeLastFreeBend })` + `isDoublePress` (PointerEvent.detail is 0). Details: `d5d0a-s5a-port-stub-draw.md`.
- **S5a.1:** `fixedSteps` / `undoWireStep`; Esc/Backspace/Ctrl+Z step-undo; Shift+Esc cancel. Details: `d5d0a-s5a1-wire-drawing-undo.md`.
- **S5b:** `placeFreeEnd` + free-end gesture/handles. Details: `d5d0a-s5b-stub-endpoint-drag.md`.

---

## 9. One-line summary

**P5d accepted** 14/14 + F3 9/9 (28 Nov 2026) — [p5d](diagram-lab-pilot-a2-p5d-generic-circle.md). [P5e](diagram-lab-multi-object-property-editing.md) architecture approved; impl after D5d. **Next:** BPSK demonstrator 2, then D5d.
