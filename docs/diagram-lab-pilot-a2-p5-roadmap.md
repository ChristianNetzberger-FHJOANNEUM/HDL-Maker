# A2-P5 roadmap — BPSK follow-on packages (specification)

**Status:** **P5d accepted 14/14** (28 Nov 2026). **[P5e architecture approved](diagram-lab-multi-object-property-editing.md)** (impl **locked**). **Current:** BPSK demonstrator 2 → **D5d** → P5e impl after freigabe.  
**Trigger:** [BPSK demonstrator accepted](diagram-lab-pilot-a2-bpsk-demonstrator.md).  
**Recommended order:** **P5a → P5b → Unique Net Naming → P5c → S5b.2 → P5d** — **P5d closed**.

---

## 1. A2-P5a — Text typography

**Implementation:** [diagram-lab-pilot-a2-p5a-text-typography.md](diagram-lab-pilot-a2-p5a-text-typography.md) — alignment + `fontSize`/`textAlign` on blocks and wire custom labels; layout-level line align; inspector Typography section.

**Goal (spec):** format-independent text **properties** (not Markdown syntax):

| Property | Values | Scope |
| --- | --- | --- |
| Alignment | left, centre, right | Each line inside the text group |
| Font size | Diagram units (`em` for layout + math) | Block `displayText` + wire display labels |
| Line spacing | Relative factor | Later / low-cost stretch goal |
| Paragraph spacing | Relative gap | Later |

**Distinction (already shipped):**

- **Group position:** `displayTextOffset` on blocks (drag whole caption vs block centre) — [P3a](diagram-lab-pilot-a2-p3a-block-latex.md).  
- **Line alignment inside group:** **missing** — layout always lays out from `x = 0` left edge in `formattedTextRender.buildLayout`.

**Format parity:** plain multiline, LaTeX (`mathRender` `em`), Markdown (`formattedTextRender` `em`) must share the same persisted fields and inspector controls.

**Scaling rule:** size is document-space; zoom is view-only (same contract as today’s wire `fontSize` for labels when set).

**Architecture note:** extend layout pass with `maxLineWidth` + alignment offset per line; centre/right shift prose and math fragments together. No HTML/CSS in Markdown. D5e-friendly SVG unchanged in spirit.

**Effort (relative):** low–medium.

---

## 2. A2-P5b — Port direction semantics

**Implementation:** [diagram-lab-pilot-a2-p5b-port-direction.md](diagram-lab-pilot-a2-p5b-port-direction.md).

**Goal:** optional metadata for teaching / HDL / Python signals **without** changing net algebra.

Proposed model (conceptual; align with `Port` / `SymbolPort` on implementation):

```ts
direction?: 'unspecified' | 'in' | 'out' | 'inout'  // default omitted ≡ unspecified
```

| Value | Meaning |
| --- | --- |
| `unspecified` | General connector — no flow arrow semantics |
| `in` | Signal enters block |
| `out` | Signal leaves block |
| `inout` | Bidirectional |

**Rules:**

- Direction ⊥ geometric side (input may be on the right).  
- Persist on symbol definition + optional instance override pattern (follow `guideU` / `placed` precedent).  
- Legacy diagrams: absent ⇒ `unspecified`.  
- **Not** HDL `port` mode — visual/annotation layer only (see [ADR geometry §1](adr-diagram-geometry-routing-style.md)).

**Bus width:** document only — `busWidth?: number | string` later for HDL `DATA_WIDTH`-style parameters; no numeric-only lock-in in P5b.

**Effort:** low–medium.

---

## 3. A2-P5c — Wire arrowheads

**Implementation:** [diagram-lab-pilot-a2-p5c-wire-arrowheads.md](diagram-lab-pilot-a2-p5c-wire-arrowheads.md).

**Goal:** show signal flow where topology + port direction are unambiguous.

**Separate layers:**

| Layer | Responsibility |
| --- | --- |
| Port semantics | P5b `direction` |
| Net topology | Existing `netId`, segments, port attachment |
| Presentation | Markers on segments |

**Modes (conceptual):**

| Mode | Behaviour |
| --- | --- |
| `none` | Today’s appearance |
| `auto` | Arrow at each **input** port on a net when exactly one driver port is identifiable |
| `start` / `end` / `both` | Manual overrides per segment or net policy (TBD in spec detail) |

**Constraints:**

- Do **not** infer direction from wire draw order.  
- Ambiguous nets (multiple outputs, undirected topology): **no auto arrow** (fail silent).  
- Reuse [ADR §3 markers](adr-diagram-geometry-routing-style.md) (`startMarker` / `endMarker` on optional `Segment.style`) — shared `<defs>`, not HDL semantics.  
- Markers are presentation; must not mutate connectivity.

**Effort:** medium.

---

## 4. A2-P5d — Generic circle block

**Status:** **Accepted** 28 Nov 2026 — [spec / close-out](diagram-lab-pilot-a2-p5d-generic-circle.md) (14/14, F3 9/9).

**Goal:** reusable **circle** primitive with ports on circumference — Adder/Multiplier pattern generalised.

**Reuse (do not reimplement):**

- `SymbolGuide` ellipse (`geometry.pointOnEllipseGuide`, `projectOntoEllipseGuide`, `continuousGuideU`) — [A2-P1](diagram-lab-pilot-a2-p1-symbol-connections.md).  
- `SymbolPort.guideId`, `u`, `lead: 'radial'` + `leadGuideId`.  
- Instance `Port.guideU` override.

**Product shape:**

- Catalog template or builtin “Generic circle” with diameter + N ports at stored `u` (not only absolute `x,y`).  
- Resize block ⇒ scale guide radii ⇒ ports stay on outline (same as multiplier/adder).  
- Per-port drag along guide (instance `guideU` already exists).

**Future primitive family (documentary):** rectangle (generic block), circle, ellipse, rounded rect, diamond, triangle, polygon, image — P5d delivers **circle** only.

**Effort:** medium.

---

## 5. Code preflight (no parallel models)

Inspected 28 Nov 2026 — implementers must **extend** these surfaces, not duplicate:

| Topic | Already exists | Gap for P5a–P5d |
| --- | --- | --- |
| **Typography** | `Label.fontSize?` (wire labels → `mathRender` / `renderFormattedText` `em`); block captions use fixed `BLOCK_DISPLAY_MATH_EM = 12` in `DiagramStage.vue`; `displayTextOffset` on `Block` | No `textAlign`; no block-level `fontSize`; layout always left-aligned in `formattedTextRender.ts` |
| **Port record** | `Port` in `document.ts`: `side`, `t`, `placed`, `x/y`, `guideU`, `interfacePortId` (hierarchy binding) | No `direction`, no bus width |
| **Symbol port record** | `SymbolPort`: `guideId`, `u`, `lead`, `leadGuideId` | No `direction`; bus width N/A |
| **Ellipse geometry** | `SymbolGuide`, `pointOnEllipseGuide`, `radialLeadSegment`, catalog adder/multiplier | **P5d:** `sym_generic_circle` in General library; `resizeAspect` on definition |
| **Wire arrows** | ADR documents `Segment.style?` markers; renderer uses plain `.wire` polylines | No persisted markers; no auto-flow algorithm |
| **Formatted text service** | `formattedTextParse` + `formattedTextRender` + shared `mathRender` | P5a hooks layout; optional later P5 “extract” for `SymbolLabel` |

**Conflicts to avoid:**

- Do not use `interfacePortId` for signal direction.  
- Do not tie arrow semantics to VHDL net direction without a future HDL-specific layer.  
- Do not add a second ellipse math or a parallel MathJax path for alignment scaling.

---

## 5b. A2-P5e — Multi-object property editing

**Architecture:** [diagram-lab-multi-object-property-editing.md](diagram-lab-multi-object-property-editing.md) — **approved** 28 Nov 2026 (placeholder swatch, indeterminate checkboxes, typography gate). **Implementation not released.**

**Order:** BPSK 2 → D5d (incl. `setBlockStyle` / `refreshAll` hypothesis) → P5e implementation after explicit freigabe. **Not** D5e export.

---

## 6. Relation to legacy “A2-P5” label

[Scientific investigation §5.2](diagram-lab-pilot-a2-scientific-presentation-investigation.md) used **A2-P5** for “shared formatted-text component” (symbol-internal labels, annotations). That work is **still valid** but **not urgent** after P4:

| Id | Meaning |
| --- | --- |
| **A2-P5a–P5d** | BPSK-driven editor features (this file) |
| **A2-P5 (legacy)** | Extract formatted-text pipeline to symbol labels / free text — after P5a or in parallel if needed |

---

## 7. Gates and non-goals

- **S5b**, **D5d**, **D5e**, **D5f** stay independent.  
- No Symbol Designer, Library Manager, or full CommonMark in P5a–P5d.  
- No commit/push from this roadmap doc.

**Next:** **BPSK demonstrator 2** → **D5d** → **P5e** (after freigabe).