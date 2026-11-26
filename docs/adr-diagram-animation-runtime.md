# ADR — Optional animation and dynamic visualisation

**Status:** Accepted as architecture guidance (26 Nov 2026). **Not** an implementation release.  
**Parent / companion:** [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md) (layers 1–4).  
**Strategic vision:** [diagram-lab-strategic-vision.md](diagram-lab-strategic-vision.md) (§3.3–3.6, §5, F5–F9).  
**Context:** Diagram-Lab as a reusable engine (D5f) may later support educational animation, presentation, HDL/sim visualisation, and live monitoring — without making animation mandatory for the static editor.

---

## 1. Decision

Add a fifth conceptual layer, **optional** and loadable only when a host needs it:

| Layer | Responsibility |
| --- | --- |
| 1–4 | Semantics, geometry, routing policy, persistent style — see companion ADR |
| **5. Animation / dynamics** | Time- or data-driven **runtime overrides** of presentable properties |

**Resolved scene → renderer:**  
`effectivePresentation = f(canonical document, persistent style, animation runtime, app overlays)`

**Hard rules:**

- Playback must **not** mutate the canonical document each frame.  
- Playback must **not** create undo entries or full document copies per frame.  
- One shared document history (Variant A) remains; editing of *animation definitions* (later) may use that history, playback must not.  
- The static editor stays fully usable with zero animation code active.  
- Do not treat animated markers as physical delay or as HDL signal direction.

---

## 2. Two animation sources (same presentation interface)

| Source | Typical use | Inputs |
| --- | --- | --- |
| **Timeline-driven** | Teaching, docs, presentations | Keyframes, tracks, duration/delay, interpolation, play/pause/seek/loop, triggers |
| **Data-driven** | HDL sim, FPGA monitor, process UI | External events, sim timestamps, signal values, FSM state, live measurements |

Both drive the same runtime presentation layer; only the driver differs. No simulation binding is released by this ADR.

---

## 3. Animatable properties (future; not implemented)

| Continuous (interpolate) | Discrete (step) |
| --- | --- |
| Position, rotation, scale | Visibility |
| Color (or stepped color) | Z-order within a layer |
| Opacity, stroke width | Text content, line pattern |
| Motion parameter along a path | Marker identity |

Also: temporary dynamic overlays (e.g. data tokens), start/end marker emphasis.

Prefer **property tracks + keyframes** over one-off effect types where possible (PowerPoint-like UX can sit on top later).

---

## 4. Path motion (reuse geometry)

Existing `Segment.points` are sufficient for motion paths:

- Arc-length parameterisation \(s = u L\) for roughly constant geometric speed.  
- No new auto-router required.  
- Branching nets need **explicit application path choice** (or multiple tokens).  
- Graphical travel ≠ physical propagation delay unless the host defines that mapping.

---

## 5. Runtime vs document

Canonical document example (static):

```text
block position + optional persistent style
```

During playback, runtime may show a different position/color/opacity. On stop/reset, presentation returns to document (+ style) unless the host intentionally commits a design edit (out of scope for v1 playback).

**v1 preference:** animate data markers and graphic overlays first; moving net-connected blocks while keeping wires consistent is substantially harder — defer.

---

## 6. Rendering layers (constraints from today’s Lab)

**Current split (inspection):**

| Surface | Content today |
| --- | --- |
| Vue Flow (under) | Blocks / symbol nodes, viewport transform |
| SVG `.world` (absolute overlay) | Grid, wire hit+ink, junctions, bends, freehand, labels, marquee, wire preview |
| CSS / chrome | Toolbar, props, dialogs (`z-index` ~5–20) |

Implications:

- Wires and blocks are **not** in one SVG z-list; “bring wire above block” is not a free continuous Z across the whole stage without a renderer redesign.  
- Future **logical layers** (guidance only):

| Band | Content |
| --- | --- |
| 0 | Background / grid |
| 1 | Graphic background shapes |
| 2 | Wires / connectors |
| 3 | Blocks / shapes |
| 4 | Labels / annotations |
| 5 | Animated data markers |
| 6 | Selection / edit handles |
| 7 | Transient UI overlays |

Support z-order **within** a band where objects share a render list; do not promise arbitrary cross-band reordering without an explicit renderer project.  
Edit handles and UI overlays stay above playback markers. Playback markers should be optionally noninteractive (`pointer-events: none`).

**No renderer refactor** is authorised by this ADR.

---

## 7. Optional modules (hosts compose)

Core remains: document, geometry, routing, styles, gestures, history, SVG render, persistence, selection, hit-test.

Optional later packages (names illustrative): Animation Player, Timeline Editor, Simulation Binding, Presentation Mode, Runtime Overlays, Event Triggers.

Avoid a speculative plugin framework; plain optional entry points / packages are enough until D5f clarifies host APIs.

---

## 8. Suggested milestone sketch (planning only)

| ID | Content |
| --- | --- |
| AN0 | This ADR + runtime-state concept |
| AN1 | Minimal player (clock, play/pause) |
| AN2 | Color / opacity / visibility |
| AN3 | Motion along polyline |
| AN4 | Keyframes / multi-track |
| AN5 | Seek / loop |
| AN6 | Timeline UI |
| AN7 | Interactive triggers |
| AN8 | External sim / VCD-style binding |
| AN9 | Presentation mode / export |

AN1–AN5 can start from JSON definitions without a timeline editor. **None of AN\* is released.**

---

## 9. Performance principles (document now; measure under D5d later)

- One shared animation clock; no per-object timer requirement.  
- Update only dirty runtime properties.  
- No full-document clone per frame; no undo during playback.  
- Zero cost when animation module inactive.  
- Separate **edit mode** and **playback mode** initially.  
- Measure before optimising; do not delay D5d for animation work.

---

## 10. Explicit non-goals (now)

- No schema, player, timeline UI, or new dependencies.  
- No HDL/GHDL/VCD integration.  
- No animation of connectivity changes.  
- No premature plugin architecture.  
- No performance optimisations justified only by future animation.  
- Does not reopen S5 gates or delay the D5d performance campaign.

---

## 11. Relation to active gates

| Track | Note |
| --- | --- |
| S5a / S5a.1 | Drawing / local undo — unaffected |
| S5b | Endpoint drag — still gated; orthogonal to animation |
| Style ADR | Persistent style ≠ runtime animation override |
| D5d | Measure static editor cost first |
| D5f | Hosts may opt into animation modules |

---

## 12. Consequences

**Positive:** Teaching and sim visualisation stay architecturally open; static HDL editing stays lean.  
**Risk:** Vue Flow + SVG dual surface limits global Z-order; plan markers in the SVG overlay (band 5) first.  
**Risk:** Confusing didactic path animation with timing — document in host UX, not in the core.
