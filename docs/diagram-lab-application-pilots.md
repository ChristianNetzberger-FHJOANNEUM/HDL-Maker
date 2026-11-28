# Diagram-Lab — Application Pilot Preparation

**Status:** Preparation **accepted** (26 Nov 2026). **A1 formally closed** (27 Nov 2026) — [final evaluation](diagram-lab-pilot-a1-final-evaluation.md). Preferred order **A1 → A2 → B2 → B3 → B1**. **A2** requires a separate release (symbol-library focus).  
**Purpose:** Complement selfchecks and D5d benchmarks with practical usage scenarios.  
**Related:** [diagram-lab-strategic-vision.md](diagram-lab-strategic-vision.md), [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md), [status-handoff-2026-11-26-d5d.md](status-handoff-2026-11-26-d5d.md), [d5d0a-s5b-stub-endpoint-drag.md](d5d0a-s5b-stub-endpoint-drag.md), **[diagram-lab-pilot-a1-presentation-findings.md](diagram-lab-pilot-a1-presentation-findings.md)**, [diagram-lab-pilot-a1-final-evaluation.md](diagram-lab-pilot-a1-final-evaluation.md).

---

## 1. Current editor capability inventory (verified)

### 1.1 Document & editing (usable today)

| Capability | Status |
| --- | --- |
| Blocks (plain templates Note / Process / Decision) | Yes |
| Symbol instances from built-in + user libraries | Yes — place, import/export JSON library |
| Ports (side + free pins), rename, resize block, move/port drag | Yes (S4: resize accepted; port-drag TBD confirmation) |
| Orthogonal wires, bends, stubs (Port↔Free), named nets / by-name join | Yes (S5a + S5a.1 accepted) |
| Junctions, labels on segments, freehand strokes | Yes |
| Hierarchy / components / extract-expand | Yes (lab model; no VHDL emit in Lab) |
| One shared undo history; Esc stack; Shift+Drag duplicate | Yes |
| Save/load diagram JSON; project open | Yes |

### 1.2 Built-in symbol libraries (`catalog.ts`)

| Library | Symbols already present |
| --- | --- |
| **General** | Rectangle, Rounded rectangle, Ellipse, Generic block (in/out), Text box |
| **Flowchart** | Start/End, Process, Decision, Input/Output |
| **Digital Logic** | AND, OR, NOT, NAND, NOR, XOR, Multiplexer, D flip-flop, Register, Counter |
| **Signal Processing** | Gain, Adder, Multiplier, Integrator, Delay, Filter |
| **Pictures** | Embedded image symbols (reference meters/scope-style) |

`SymbolShape` kinds: `rect`, `ellipse`, `line`, `polygon`, `text`, `image`. No path/curve primitive. No per-shape fill/stroke in the document (appearance is CSS / SymbolFace defaults).

Plain `BLOCK_TEMPLATES` remain available alongside symbols.

### 1.3 Explicit gaps for pilots (do not implement from this doc)

| Gap | Affects | Notes |
| --- | --- | --- |
| Stable free-endpoint drag (**S5b**) | A + B | **Accepted** |
| Presentation control (labels, fill, bend chrome) | A1 teaching look | **P0–P5b** accepted; **A1 closed** |
| Free-angle / non-orthogonal wires | B1 constellation, annotations | Elbow routing only |
| Wire style (dash, colour, arrows/markers) | B1–B3, teaching diagrams | ADR only |
| Block / symbol fill & border colour | A1 / A2 / B2 | Covered by A1 **P3** (function confirmed) |
| Sheet SVG export | Webskriptum | **D5e** specified, not started |
| Reusable Vue surface / read-only viewer | Script embed | **D5f** specified, not started |
| Oscillator, ADC, DAC, Triangle, Point, Document shapes | Desired test set | Not in catalog; representable later as polygons/ellipse/text or deferred |
| Library Manager / Shape Designer | Comfort | Existing: palette + user library import/export only |
| Mixed selection / wire marquee (S1/S2), wire-only copy (D5c.7) | Convenience | Deferred |

### 1.4 Three test pillars

| Pillar | Question |
| --- | --- |
| Selfchecks | Technically correct? |
| D5d benchmarks | Does it scale? |
| **Application pilots** (this doc) | Can someone usefully work with it? |

---

## 2. Proposed pilot diagrams

### Pilot A — HDL-Maker (graphical editing only; no VHDL)

| ID | Diagram | Intent |
| --- | --- | --- |
| **A1** | Synchronous 4-bit counter (clk, en, rst, Q) | **Formally closed** — [final](diagram-lab-pilot-a1-final-evaluation.md); findings [here](diagram-lab-pilot-a1-presentation-findings.md) |
| **A2** | BPSK modulator + AWGN / coherent RX | **Demonstrator accepted** — [bpsk demonstrator](diagram-lab-pilot-a2-bpsk-demonstrator.md); [P5 roadmap](diagram-lab-pilot-a2-p5-roadmap.md); A2.2–A2.3 library lifecycle optional |

**Acceptance (practical):** Completing A1/A2 without dead-end edits; stubs/names/junctions usable; missing features logged as defects vs enhancements vs architecture limits.

### Pilot B — Educational web diagrams (same Lab editor)

| ID | Diagram | Intent |
| --- | --- | --- |
| **B1** | QPSK constellation | Axes, I/Q points, vectors — stresses free angles, markers, dashed guides, free text |
| **B2** | Modulator block diagram | Symbol variety, math labels, coloured paths (desire) |
| **B3** | Simple algorithm flowchart | Flowchart library + connectors/arrows |

**Method:** Attempt with **today’s** features only. Document workarounds (orthogonal axes as stubs, labels as Text box / symbol labels, Decision/Process for flowchart). Do not implement gaps mid-pilot.

---

## 3. Proposed minimal test shape inventory

**Do not build a Library Manager.** Prefer existing builtins; optionally a small JSON user-library file assembled later from `saveSymbolToLibrary` / export (separate freigabe).

| Category | Use from builtins | Still missing / future |
| --- | --- | --- |
| Digital logic | AND, OR, NOT, XOR, NAND, NOR, MUX, DFF, Register, Counter | — |
| Signal processing | Gain, Adder, Multiplier, Delay, Filter, Integrator | ADC, DAC (Oscillator exists under **Pictures** — see A2 prep) |
| General / teaching | Rectangle, Round rect, Ellipse, Text box, Generic block | Triangle, Point, Document |
| Flowchart | Start/End, Process, Decision, I/O | Terminator ≈ Start/End |

~20–25 symbols already covered by builtins for A1/A2/B2/B3. B1 is mostly **geometry/style**, not missing gate symbols.

---

## 4. Expected limitations (by class)

| Class | Examples |
| --- | --- |
| **Usability** | Port Drag confirmation open; constellation via orthogonal stubs looks awkward; always-on bend handles (A1) |
| **Functional defect** | Anything that violates accepted S3/S4/S5a/S5b behaviour |
| **Missing feature** | Free-angle wires, dashed/arrow wires, bus-width marks, SVG export, Library Manager |
| **Architecture** | Net semantics forced on “connectors”; dual Vue Flow + SVG z-order; no persisted style on Segment |

**A1 outcome:** **Formally closed.** Technical block diagrams viable with documented limits. Next: **A2** (separate release) — symbol library / reuse focus, not more A1 presentation features.

---

## 5. Practical acceptance criteria (pilots)

For each diagram A1–B3, record a short sheet:

1. Steps that worked.  
2. Awkward steps.  
3. Missing shapes.  
4. Missing editor functions (essential vs optional).  
5. Bugs (with repro).  
6. Architecture constraints hit.  
7. Whether the result is “good enough” for teaching/sketch use **without** new features.

Pass for this **preparation** phase: proposal reviewed; pilots scheduled; no accidental implementation from the findings list.

Pass for a later **execution** phase (separate freigabe): five diagrams attempted; findings filed; D5d not blocked.

---

## 6. Suggested execution sequence

1. **S5b** — **accepted**.  
2. **A1 presentation** — **closed** (P0–P5b).  
3. **A2** — digital baseband / communication system — **separate freigabe** (symbol library focus).  
4. **S4** Port Drag — finish user confirmation.  
5. **Manual pilots** B2→B3→B1 — findings only unless released.  
6. **Vertex-handle / edge / vertex drag** (“S5a.2”) — **not** an open milestone; separate freigabe only.  
7. **D5d** — independent; must not be delayed by pilots.  
8. **D5e / D5f** — unchanged path for Webskriptum.

Pilots may run **in parallel** with D5d prep if findings stay documentation-only.

---

## 7. Dependencies on approved milestones

| Milestone | Role for pilots |
| --- | --- |
| S3 / S5a / S5a.1 | Stub copy / draw / step-undo — available |
| S4 | Resize OK; finish Port Drag acceptance |
| S5b | **Accepted** — free-end drag available |
| A1 presentation P0–P5 | **Closed** — [final evaluation](diagram-lab-pilot-a1-final-evaluation.md) |
| D5d | Benchmarks; independent of pilots |
| D5e | SVG/static export for scriptum |
| D5f | Embeddable surface / viewer |
| CL / EDU / vision F* | Context only — not pilot gates |

---

## 8. Future web integration (conceptual only)

```text
Diagram-Lab Editor → JSON (editable) → SVG (D5e) → Webskriptum figure
                              ↘ later: read-only / interactive viewer (D5f)
```

Compatible with the strategic vision (education + export). No web integration work from this document.

---

## 9. Scope restrictions (this deliverable)

Read-only investigation and documentation only.

No implementation, schema, styling, symbol engine, Library Manager, standalone apps, renderer refactor, performance work, roadmap renumbering, commit, or push.

Preserve S-series gates and D5d priorities.

---

## 10. Stop for review

**A2-P1 → P5b closed**; **BPSK application demonstrator accepted** (Nov 2026). **Next freigabe:** [A2-P5c wire arrowheads](diagram-lab-pilot-a2-p5-roadmap.md#3-a2-p5c--wire-arrowheads). Keep **D5d** independent.
