# Diagram-Lab — Application Pilot Preparation

**Status:** Planning / investigation only (26 Nov 2026). **Not** an implementation release.  
**Purpose:** Complement selfchecks and D5d benchmarks with practical usage scenarios.  
**Related:** [diagram-lab-strategic-vision.md](diagram-lab-strategic-vision.md), [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md), [status-handoff-2026-11-26-d5d.md](status-handoff-2026-11-26-d5d.md).

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
| Stable free-endpoint drag (**S5b**) | A + B | RCA done; **not released** |
| Free-angle / non-orthogonal wires | B1 constellation, annotations | Elbow routing only |
| Wire style (dash, colour, arrows/markers) | B1–B3, teaching diagrams | ADR only |
| Block / symbol fill & border colour | A2 / B2 differentiation | ADR; optional later micro-slice |
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
| **A1** | Synchronous 4-bit counter (clk, en, rst, Q) | Reuse Counter/Register/DFF; named stubs (`clk`, `rst`); feedback / enable; junctions |
| **A2** | Digital communication system blocks | Varied block sizes; Gain/Adder/Filter/etc.; shared nets; reusable symbol instances |

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
| Signal processing | Gain, Adder, Multiplier, Delay, Filter, Integrator | Oscillator, ADC, DAC |
| General / teaching | Rectangle, Round rect, Ellipse, Text box, Generic block | Triangle, Point, Document |
| Flowchart | Start/End, Process, Decision, I/O | Terminator ≈ Start/End |

~20–25 symbols already covered by builtins for A1/A2/B2/B3. B1 is mostly **geometry/style**, not missing gate symbols.

---

## 4. Expected limitations (by class)

| Class | Examples |
| --- | --- |
| **Usability** | Endpoint jump until S5b; Port Drag confirmation open; constellation via orthogonal stubs looks awkward |
| **Functional defect** | Anything that violates accepted S3/S4/S5a behaviour |
| **Missing feature** | Dashed/arrow wires, block colour, free-angle wires, SVG export |
| **Architecture** | Net semantics forced on “connectors”; dual Vue Flow + SVG z-order; no persisted style on Segment |

**Minimal block styling (fill / border / text / reset):** Likely high teaching value for A2/B2; treat as a **possible later micro-slice** after pilots, not as start of a full style system. Decide after drawing A/B, not before.

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

1. **Wire gates still open** — S4 Port Drag confirmation; **S5b** only after explicit release; any further edge/vertex work only if freigegeben (user’s “S5a.2” is not an open Lab milestone today — clarify before inventing a slice).  
2. **Pilot sessions** — same Lab UI; A then B (or interleaved); findings-only.  
3. **Optional tiny test library JSON** — only if builtins prove awkward to browse; still no Library Manager.  
4. **D5d performance campaign** — must not wait on pilots; pilots must not spawn unplanned features that delay D5d.  
5. **D5e SVG/export → D5f viewer/library** — natural path for Webskriptum (JSON source + SVG figure; later interactive viewer).  
6. **First specialised host app** — only after F0-style stability (vision), not now.

Pilots may run **in parallel** with D5d prep if findings stay documentation-only.

---

## 7. Dependencies on approved milestones

| Milestone | Role for pilots |
| --- | --- |
| S3 / S5a / S5a.1 | Stub copy / draw / step-undo — available |
| S4 | Resize OK; finish Port Drag acceptance |
| S5b | Needed for comfortable stub endpoint edit — gated |
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

Next human decision: approve pilot **execution** (sessions + findings templates) and/or release **S5b**; do not treat the shape/style wish-list as an automatic queue.
