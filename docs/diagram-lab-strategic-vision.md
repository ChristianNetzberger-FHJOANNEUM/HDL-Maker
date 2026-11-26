# Diagram-Lab — Strategic Vision and Future Specialisation Roadmap

**Status:** Vision / architectural orientation (26 Nov 2026). **Not** an implementation specification. **Not** an extension of the approved D-series or HDL-Maker Studio roadmaps.  
**Related:** [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md), [adr-diagram-animation-runtime.md](adr-diagram-animation-runtime.md), [diagram-editor-roadmap.md](diagram-editor-roadmap.md), [diagram-lab-application-pilots.md](diagram-lab-application-pilots.md) (practical evaluation — planning only).

---

## 1. Purpose of this document

This document describes the long-term strategic vision of Diagram-Lab beyond its current application in HDL-Maker Studio.

It is a vision document and architectural orientation, not an implementation specification or an extension of the currently approved development roadmap.

The central principle is:

**Implement only what is needed today, while avoiding architectural decisions that unnecessarily prevent useful applications tomorrow.**

The current development must not be burdened with speculative features, abstractions or infrastructure.

### Documentation layers (how to read the docs)

| Layer | Role | Examples |
| --- | --- | --- |
| **Strategic vision** | Long-term goals, possible applications, licensing posture, philosophy | This file |
| **ADRs** | Concrete architecture decisions, compatibility, deferred choices | `adr-diagram-*.md` |
| **Operational roadmap** | Released milestones, implementation briefs, selfchecks, acceptance, measurements | D-series / S-slices, handoffs, prep specs |
| **Application pilots** | Practical usage evaluation (findings, not auto-implement) | [diagram-lab-application-pilots.md](diagram-lab-application-pilots.md) |

Long-term ideas in this file must **not** be treated as immediate work unless a separate freigabe opens a milestone.

---

## 2. Strategic vision

Diagram-Lab is intended to evolve into a reusable, general-purpose diagram editing and visualisation engine.

HDL-Maker Studio is its first specialised application and remains the primary development focus.

In the longer term, the same engine could provide the foundation for several independent applications, particularly in engineering, education, simulation and scientific visualisation.

The objective is not to develop a monolithic application containing every conceivable feature, but to establish a reliable common foundation that can be extended according to concrete application requirements.

---

## 3. Potential future specialisations

### 3.1 HDL-Maker Studio

The primary application currently under development:

- Digital circuit design.
- Hierarchical block diagrams.
- Logical nets, ports and junctions.
- State machine editing.
- VHDL generation.
- Simulation integration.
- FPGA implementation workflows.
- Educational digital design projects.

### 3.2 General Diagram Editor

A general-purpose graphical editor inspired by applications such as Microsoft Visio and draw.io.

Potential capabilities:

- General block diagrams, flowcharts, network diagrams, UML-like diagrams, technical illustrations.
- Arbitrary graphical shapes, free text and annotations.
- Orthogonal and arbitrary-angle connections.
- Graphical grouping and alignment; object layering and Z-order.
- Flexible visual styling.

General diagram objects must not necessarily be subject to HDL-specific net semantics.

### 3.3 Educational Animator

A specialised application for creating interactive and animated teaching materials.

Potential capabilities:

- Sequential presentation; motion along lines/paths; colour, transparency, visibility, rotation, scale.
- Animated text and numerical values; highlighting of active blocks.
- Interactive triggers; timeline-based animation; step-by-step explanation.

Potential educational domains: digital logic, communication systems, computer architecture, embedded systems, signal processing, algorithms, control engineering, physics and mathematics.

Objective: structural clarity of technical diagrams plus presentation-class animation — without requiring the static HDL editor to load an animation engine.

### 3.4 Simulation Visualisation

Visualising external simulation results inside diagrams.

Potential capabilities:

- HDL signal values, colour-coded logic states, active FSM highlighting, transitions.
- Register/bus values; waveform synchronisation; VCD-style playback; stepwise or continuous view.

Illustrative educational workflow: **Design → Generate HDL → Simulate → Visualise → Implement**.

Simulation-driven visualisation must remain distinct from purely illustrative animation (see animation ADR).

### 3.5 Presentation and Interactive Documentation

A lightweight diagram-based presentation environment: sequential appearance, animated explanations, click triggers, reusable teaching examples, export of static and dynamic content.

Not a mandate to replace PowerPoint; aim for strengths in technical/scientific explanation.

### 3.6 Live Monitoring and Process Visualisation

Future possibility for external runtime data: sensors, device/FPGA/embedded state, network activity, industrial process indicators, live overlays.

The engine provides graphics; hosts provide acquisition and interpretation.

---

## 4. Long-term conceptual architecture

Preserve clear separation (aligned with the ADRs):

| Layer | Responsibility |
| --- | --- |
| **1. Semantics** | What objects and connections mean (HDL nets, FSM edges, general relationships, pure graphics) |
| **2. Canonical geometry** | Persistent space (positions, sizes, polylines, anchors, labels) |
| **3. Routing / edit policy** | How connections are created and edited (orthogonal, free, …) — not an unconditional document invariant |
| **4. Persistent visual styling** | Appearance; must not redefine connectivity or HDL direction |
| **5. Optional animation / runtime** | Temporary time- or data-driven presentation overrides |

Application-specific semantics should not unnecessarily constrain the generic engine. Details and non-goals: companion ADRs.

---

## 5. Animation architecture principles

Future optional animation may use:

- **Timeline-driven** — teaching, presentations, documentation.
- **Data-driven** — HDL sim, FSM execution, sensors, live events.

Shared principles: one canonical document; one document history; no history spam or full-document clones during playback; shared clock; dirty updates only; edit vs playback separation; zero cost when inactive. Animation *definitions* may later persist; *playback state* stays temporary. See [adr-diagram-animation-runtime.md](adr-diagram-animation-runtime.md).

---

## 6. Future semantic extensibility

The generic engine should remain compatible with categories such as logical wires, general connectors, graphical polylines, shapes/annotations, and dynamic visualisation objects — sharing geometry, style, render, and interaction without identical semantics.

**Do not** refactor the existing object model merely to anticipate these categories.

---

## 7. Educational and open-source strategy

A major long-term objective is freely available engineering and educational software: no student licence treadmill, local execution, reproducible examples, transparent formats, extensibility, possible community contributions, independence from discontinued proprietary teaching tools.

Vision includes a reusable, freely licensed Diagram-Lab engine and specialised applications on top.

Permissive licences (e.g. MIT, BSD-3-Clause, Apache 2.0) **may** be considered. **No final licence decision** is made here.

Before any public distribution, review: ownership/IP, institutional obligations, dependency licences, legacy HDL-Designer import/examples, proprietary toolchain compatibility, attribution/distribution rules. Free licensing of Diagram-Lab does not free external proprietary tools.

---

## 8. Conceptual future development roadmap (non-binding)

Orientation only — **not** approved milestones, **not** a renumbering of the D-series:

| Stage | Strategic direction |
| --- | --- |
| F0 | Stable and performant Diagram-Lab foundation |
| F1 | Reusable diagram editing library |
| F2 | General geometry and routing capabilities |
| F3 | Persistent visual styling |
| F4 | General diagram objects and connectors |
| F5 | Optional runtime visualisation interface |
| F6 | Basic animation playback |
| F7 | Property tracks, keyframes and motion paths |
| F8 | Interactive animation authoring and timeline UI |
| F9 | Simulation and external data binding |
| F10 | Specialised educational and technical applications |
| F11 | Open-source distribution and ecosystem development |

Stages may overlap, reorder, shrink, or never happen. They must not replace D-series or Studio milestones.

---

## 9. Development philosophy

- **YAGNI** — no speculative features before need.  
- **Separation of concerns** — semantics / geometry / routing / style / runtime.  
- **Composition over inheritance** — small reusable pieces, not speculative hierarchies.  
- **Single source of truth** — one canonical document, one shared history.  
- **Progressive extensibility** — interfaces when requirements justify them; no speculative plugin framework.  
- **Application independence** — keep HDL-specific behaviour out of generic editor core where practical.  
- **Backward compatibility** — preserve existing documents and behaviour wherever practical.  
- **Measure before optimising** — reproducible measurements (D5d).  
- **Optional complexity** — hosts load only what they need (e.g. static HDL without animation).

---

## 10. Explicit non-goals

This vision does **not** authorise: animation/style/new object types/new routing/schema changes/renderer refactor/plugin infrastructure/simulation integration/new dependencies/general-purpose editor implementation/licence changes/public repo publication/performance optimisations/roadmap reordering/commit or push.

Do not add empty interfaces, placeholder classes, or unused abstractions merely to anticipate the future.

---

## 11. Relationship to the current roadmap

Current priorities remain unchanged:

- Finish approved wire-editing work (including remaining S-gates as freigegeben).  
- Preserve architectural invariants (shared history, gesture preview from baseline, sheet net-name identity, toolbar as chrome).  
- Run the D5d performance campaign when released.  
- Continue Diagram-Lab D-series and HDL-Maker Studio per their own roadmaps.  
- Prepare reusable Vue library per D5f when due.

Future specialisations must not delay these activities.

---

## 12. Guiding statement

Diagram-Lab should grow into a reliable, reusable and potentially freely licensed foundation for technical diagram editing, interactive education, simulation visualisation and specialised graphical applications.

Its long-term potential should be preserved through sound architectural decisions, not through premature implementation.

**Build what is needed today. Preserve the possibilities of tomorrow.**
