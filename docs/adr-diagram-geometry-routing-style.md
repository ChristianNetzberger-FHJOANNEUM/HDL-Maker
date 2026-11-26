# ADR — Extensible diagram geometry, routing, and visual styling

**Status:** Accepted as architecture guidance (26 Nov 2026). **Not** an implementation release.  
**Context:** Diagram-Lab is evolving toward a reusable diagram engine (roadmap **D5f**). HDL-Maker Studio is a specialised host of that engine, not the sole target. Long-term product vision: [diagram-lab-strategic-vision.md](diagram-lab-strategic-vision.md).  
**Scope of this ADR:** Principles and deferred decisions only. No schema, renderer, or UI changes.

---

## 1. Decision

Keep concerns independent for connection-like objects:

| Layer | Responsibility | Today (Lab) |
| --- | --- | --- |
| **1. Semantics** | Connectivity / meaning | `netId`, `Endpoint` (port / free / junction), `Junction`, sheet name identity (D5c.5) |
| **2. Geometry** | Where it runs | `Segment.points` (orthogonal polyline / waypoints) |
| **3. Routing / edit policy** | How geometry may change | `routed: 'manual' \| 'auto'`; span/bend gestures; future free vs orthogonal drawing |
| **4. Visual style** | How it is drawn | CSS classes (`.wire`, `.wire.selected`, `.preview`); no persisted per-wire style yet |
| **5. Animation / dynamics** | Optional runtime overrides | **Not present** — see [adr-diagram-animation-runtime.md](adr-diagram-animation-runtime.md) |

**Rules:**

- Changing style must not change connectivity or canonical geometry.
- Changing routing defaults must not silently reshape existing wires.
- Selection, hover, and active-gesture appearance stay **transient UI state**, not document style.
- Visual arrowheads / markers must **not** imply HDL signal direction or net semantics.
- Animation playback must not mutate the canonical document or spam history (details in the animation ADR).

---

## 2. Current baseline (read-only inspection)

| Area | Observation | Conflict risk for future style |
| --- | --- | --- |
| `Segment` | `id`, `netId`, `points`, `start`, `end`, `routed` only | Low — room for optional `style` / `routingMode` later |
| `Label.fontSize?` | Optional drawing size already exists | Precedent for optional visual fields without forcing every object to carry them |
| `Stroke` | Freehand already has `color` + `size` | Different object type; do not conflate with net wires |
| Document | `extensions` + top-level `extra` preserved on round-trip | Possible parking for **diagram defaults** before a typed field exists |
| Segment parse | `asSegment` normalises `routed`; unknown segment keys are **not** systematically preserved today | **Deferred:** if optional `style` is added, parse/serialize must keep unknown or known optional fields (same pattern as labels) |
| Renderer | SVG `<polyline class="wire">`; stroke via CSS; `vector-effect: non-scaling-stroke`; hit stroke separate (`.hit`, 12px) | Good fit for SVG `stroke*` / markers; keep hit geometry independent of dash/width |
| Selected wire | `.wire.selected` CSS only | Correct — must stay transient |
| Preview | Dashed `.preview` CSS | Transient; must not become persisted pattern |
| Semantics | One model: net-backed segments | Do **not** force flowcharts/UML into HDL nets; future connector / graphic polyline types may share geometry + style APIs |

No schema or renderer change is implied by this ADR.

---

## 3. Future visual styling (evaluate later; do not implement now)

Compatible with SVG without extra geometry:

- Stroke color, width, opacity  
- Patterns: solid / dashed / dotted / dash-dot (`stroke-dasharray`, linecap)  
- Line caps / joins  
- Start/end markers (arrow, open-arrow, diamond, circle) via shared `<defs>` markers  
- Optional rounded corners (higher cost; defer specifics)

**Preferred shape (conceptual only):** grouped optional object, not many unrelated top-level `Segment` fields:

```text
Segment.style?: { color?, width?, pattern?, opacity?, startMarker?, endMarker?, lineCap?, lineJoin? }
Segment.routingMode?: 'orthogonal' | 'free'   // drawing/edit policy — independent of style
```

Documents without `style` keep today’s appearance (application defaults).

**Style resolution (conceptual):**

```text
effectiveStyle = { ...applicationDefaults, ...diagramDefaults, ...segment.style }
```

- **Routing default:** applies to **new** drawing; does not rewrite existing polylines.  
- **Style default (diagram):** may affect all objects lacking overrides; persist in the document so open-on-another-machine looks the same.  
- Named style libraries: out of scope until needed.

Avoid: plugin style systems, arbitrary SVG attribute bags in the document, CSS-like inheritance languages.

---

## 4. Semantic extensibility (future; no refactor now)

| Category | Meaning | Shared infrastructure |
| --- | --- | --- |
| **Wire** | Logical net + ports/junctions (HDL) | Geometry, hit-test, gestures, style, history |
| **Connector** | Relationship between diagram objects | Same |
| **Graphic polyline** | Drawing only, no net | Same |

Do not collapse these into HDL net identity. Do not treat markers as directionality.

---

## 5. Performance principles (when styles ship)

- Shared SVG marker defs, not per-wire arrow geometry.  
- Resolve style once per paint path; avoid a Vue component per attribute.  
- Hit-testing independent of dash pattern and cosmetic width.  
- Edit handles only for selected / active objects.  
- Measure dash/marker cost at large wire counts under D5d harnesses — do not claim numbers now.

---

## 6. Relation to active work

| Track | Interaction with this ADR |
| --- | --- |
| **S5a / S5a.1** | Wire drawing / local step undo — geometry + gesture only; unaffected |
| **S5b** | Endpoint drag — routing/geometry layer; still gated; style remains independent |
| **D5d performance** | Proceed as planned; styles are not a reason to delay measurement |
| **Animation (optional)** | Fifth layer — runtime presentation only; [adr-diagram-animation-runtime.md](adr-diagram-animation-runtime.md) |
| **D5f** | Engine extraction should keep layers separable so hosts (HDL, general diagram, …) share renderer/gestures without sharing net semantics |

---

## 7. Explicitly deferred (until a dedicated release)

- Schema fields (`style`, `routingMode`, diagram style defaults)  
- Properties panel / style UI  
- Free routing mode implementation  
- New object types (connector, graphic polyline)  
- Marker defs, rounded corners, named styles  
- Parser changes to preserve unknown segment keys  
- Any optimisation work justified only by future styles  

---

## 8. Consequences

**Positive:** HDL work can continue without Visio-scale abstraction; the door stays open for general-diagram hosts and SVG-native cosmetics.  
**Negative:** Until parse/serialize policy for optional segment fields is decided, experimental style JSON in segments could be dropped on load — use `extensions` / document defaults only after an implementation slice defines the contract.  
**Neutral:** `routed: manual|auto` remains the only routing-related persisted flag; a future `routingMode` must be specified relative to it so they do not conflict.

---

## 9. References

- Roadmap D5f — Vue library / reusable surface (`docs/diagram-editor-roadmap.md`)  
- Sheet net identity — D5c.5  
- History Variant A — one shared history; gesture preview from baseline  
- User architecture note — 26 Nov 2026 (geometry vs style vs semantics)
