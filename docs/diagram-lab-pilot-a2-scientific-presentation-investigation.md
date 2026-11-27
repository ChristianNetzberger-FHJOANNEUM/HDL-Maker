# A2 — Symbol geometry and scientific text investigation

**Status:** Investigation only (27 Nov 2026) — **stop for review**. No implementation. No new dependencies.  
**Trigger:** Manual A2.1 BPSK + AWGN drawing — port–graphic gaps; inadequate math notation on labels/block text.  
**Related:** [a2-findings](diagram-lab-pilot-a2-findings.md), [a2-preparation](diagram-lab-pilot-a2-preparation.md), [p5a](diagram-lab-pilot-a1-p5a-label-position.md), [p2-display-text](diagram-lab-pilot-a1-p2-display-text.md), [geometry/style ADR](adr-diagram-geometry-routing-style.md), [D5e](diagram-editor-roadmap.md) (export specified, not started).

Work-package ids: **A2-P1 + A2-P2 closed**; **A2-P3 implemented — awaiting manual acceptance**; A2-P4 … A2-P5 remain gated until separately released.

---

## 1. Context

A2.1 shows that connectivity and library reuse already work, but **publication quality** for a scientific scriptum is limited by:

1. Visible gaps between library symbol artwork and port/wire anchors (Multiplier, Adder, Pictures Oscillator).  
2. Wire/block text that cannot express \(b_k\), \(\cos(\omega_0 t)\), \(\frac{E_b}{N_0}\), etc.

This document investigates minimal fixes and rendering options. It does **not** authorise a Symbol Designer, rich-text framework, schema changes, or dependency adds.

---

## 2. A2-P1 — Symbol geometry and port placement

### 2.1 Coordinate systems (verified)

| Space | Behaviour |
| --- | --- |
| Symbol definition | Local coords in `[0..width]×[0..height]` (`SymbolDefinition`) |
| Instance box | `Block.x/y/width/height` |
| Artwork draw | `fitSymbolShapes` scales shapes/labels from symbol box → instance box |
| Side-port anchor | `pinLocal(width, height, side, t)` → **on the instance rectangle border** |
| Free-port anchor | `pinPoint` with fractional `x`,`y` → **any point inside** the instance box |

Key code: `geometry.ts` (`pinLocal`, `pinPoint`, `portAnchor`, `fitSymbolShapes`); `SymbolFace.vue` draws shapes then pins at computed `(cx,cy)`.

### 2.2 Root cause of the visible gaps

**Not** a missing general geometry engine. **Catalog artwork is inset** inside the symbol box, while **side ports sit on the box edge**.

Concrete builtins (88×64 unless noted):

| Symbol | Visible body | Side ports |
| --- | --- | --- |
| Multiplier / Adder | Ellipse `(16,8)–(72,56)` | Left/right at **x = 0 / 88** |
| Gain | Triangle starting at **x = 8** | Left at **x = 0** |
| Default `rect()` helper | Inset 10 px all sides | On outer box |
| Pictures Oscillator | Image slot letterboxed in **160×108** (`lockAspect`) | On outer box (`out` right, `gnd` bottom) |

Wires terminate at port anchors → optical gap to the ellipse/image. Resize scales both artwork and border anchors proportionally; the **relative** gap remains.

**Port-drag (`placed`):** repositions the instance port along a **box side** (`pinLocal` with `placed`); it does not snap to the ellipse contour and does not edit symbol artwork.

### 2.3 Are ports locked to rectangular boxes?

| Mode | Restriction |
| --- | --- |
| `side` + `t` | Yes — always the axis-aligned instance border |
| Free pin (`x`,`y` fractions) | No — any point in the local box (already implemented) |
| Contour intersection / automatic “on path” | **Not implemented** (and out of scope) |

A future Symbol Designer can already place free pins anywhere in local coordinates; side pins remain the convenient “IEC-style on box” model.

### 2.4 Can connection leads be drawn today?

**Yes.** `line` (and other) shapes are part of the symbol definition — not nets.

Existing example: XOR includes vertical-ish lead lines near the left (`catalog.ts`). That is **Variant B**.

### 2.5 Variant A vs B

| Variant | Idea | Fit for current model |
| --- | --- | --- |
| **A** | Port on visible contour | Move artwork flush to box edge, **or** use free pins on the contour, **or** enlarge ellipse to touch borders |
| **B** | Port outside contour + graphic leads | Add `line` shapes from border to body (XOR pattern); keep side pins |

**Recommendation:** Prefer **definition/catalog corrections** (A and/or B per symbol family) for a quick visual fix. For **movable** instance ports without orphan leads, prefer the later **port-guide / derived-lead** model — [adr-symbol-geometry-and-port-guides.md](adr-symbol-geometry-and-port-guides.md). Do **not** add automatic contour-intersection.

### 2.6 Minimal correction proposals (when released)

1. **Signal Processing Multiplier/Adder:** either expand ellipse to touch left/right (and adjust `t`), or add short horizontal `line` leads from x=0/width to the ellipse.  
2. **Pictures Oscillator:** add lead lines and/or tighten image layout; reconsider pin set for mixer use (`out` only vs `gnd`).  
3. **Comms test library** (`lib_communication_systems.json`): apply the same lead/flush pattern so A2.2 drawings match teaching quality.  
4. Document a Symbol Designer checklist: “ports vs visible bounds” preview.

No schema change required for A/B via artwork + existing free/side pins.

---

## 3. A2-P2 — Logical net name vs visual display label

### 3.1 Current inventory

| Concept | Today |
| --- | --- |
| Net identity | `Net.id` + `Net.name` (D5c.5 by-name join) |
| Segment name label | `Label` with `role` omitted/`name`; `labelText()` → **always `net.name`** |
| Note label | `role: 'note'` → shows `Label.text` |
| Visibility | `Label.visible` (P1); absent / hidden / visible |
| Position | Segment anchor + `offset` / P5a `shift` |
| Block analogy | `Block.name` vs `Block.displayText` (P2) |

There is **no** independent “display string” for name-role wire labels today. Renaming the net changes every name-label glyph via `labelText`.

### 3.2 Proposed principles (design only — no schema yet)

| Requirement | Approach |
| --- | --- |
| Keep canonical IDs/names | Unchanged `Net` |
| HDL / future Python ids | Logical name stays identifier-safe (`bk`, `carrier`) |
| Visual math | Optional per-label override, e.g. `Label.displayText?: string` **or** reuse `text` when a flag `useDisplayText` is set |
| Default | No override → keep showing `net.name` |
| Multi-segment | Each label may override independently |
| P5a/P5b | Position, hide/remove, copy, history unchanged |
| Rename Net | Does **not** clear overrides; still updates labels that have no override |

Closest A1 precedent: **P2 display text** vs instance name.

**Do not** store LaTeX in `Net.name`. That would break by-name connectivity and HDL/Python identifiers.

### 3.3 Interaction sketch

```text
Net.name = "carrier"          // logical
Label (name role) display  →  "\cos(\omega_0 t)"   // optional visual
Label absent override      →  "carrier"
```

Properties (future): Net name field + “Label display (optional)” + Show/Remove/Reset position (P5b).

---

## 4. A2-P3 — Mathematical text rendering

### 4.1 Required expression set (acceptance examples)

`b_k`, `a_k`, `\cos(\omega_0 t)`, `e^{j\omega_0 t}`, `\frac{E_b}{N_0}`, `\sigma_n^2`, `H(z)=\frac{1}{1-az^{-1}}`, `\sum_{k=0}^{N-1}x_k`.

### 4.2 MathJax vs KaTeX (investigation; no install)

| Criterion | KaTeX | MathJax |
| --- | --- | --- |
| Licence | MIT | Apache-2.0 |
| Speed | Very fast (sync HTML) | Adequate; heavier |
| TeX coverage | Large subset | Very large |
| Native **SVG** output | **No** (HTML/MathML) | **Yes** (`output/svg`) |
| Offline / bundle | Yes (+ CSS/fonts for HTML) | Yes (SVG more self-contained) |
| Vue | Wrap DOM/HTML or component | Wrap SVG node or string |
| D5e portable SVG export | HTML/`foreignObject` fragile | **SVG fragments nest cleanly** |
| Lab asset import policy | N/A | Note: imported **images** already refuse `foreignObject`/scripts (`diagram-editor-roadmap`) — prefer real SVG paths, not FO |

**Recommendation:** Prefer **MathJax SVG** (or equivalent TeX→SVG pipeline) for Lab overlays **and** D5e, despite KaTeX’s speed advantage for pure web pages. Re-evaluate bundle size at implementation freigabe. **Do not add the dependency in this investigation.**

### 4.3 Integration sketch (future)

- Plain SVG `<text>` path unchanged (fast).  
- Optional format `latex` → typeset **once** when source changes → cache SVG (or path group) keyed by source + style.  
- Place cached graphic at label/block anchor; pan/zoom/drag only transforms — **no re-typeset**.  
- Invalid TeX → show source + error affordance; never execute content.  
- Lazy-load math module so HDL-only sheets pay nothing.

### 4.4 D5f

A reusable Vue surface should consume the **same** cached SVG/plain renderer API; hosts must not each embed a different math stack.

---

## 5. A2-P4 — Markdown and mixed math

### 5.1 Proposed text formats (long-term)

| Format | Use |
| --- | --- |
| `plain` | Default; current behaviour |
| `latex` | Whole string is math (wire display, equation captions) |
| `markdown` | Restricted: bold, italic, breaks, inline code, `$...$` / `$$...$$` math |

### 5.2 Shared formatted-text component (A2-P5 perspective)

One renderer eventually serves:

- Wire display labels  
- Block `displayText`  
- Symbol-internal labels/texts  
- Future standalone text / annotations  

**Security:** no arbitrary HTML from documents; no script; sanitize markdown; math goes through the TeX→SVG path only.

**Do not** build a full rich-text editor in the first slice.

---

## 6. Performance (constraints for later design)

| Rule | Rationale |
| --- | --- |
| Typeset on source change only | D5d: drag/pan/zoom must stay cheap |
| Cache by source (+ font size / display mode) | Reuse identical formulas on a sheet |
| Plain-text fast path | Majority of HDL labels |
| Lazy-load math | Optional dependency |
| Export embeds generated SVG | No CDN at view time for D5e artefacts |

No speculative optimisation now; D5d remains independent.

---

## 7. Staged implementation proposal (for separate freigabe)

| Order | Package | Content | Priority |
| --- | --- | --- | --- |
| 1 | **A2-P1** | Guides + catalog geometry | **Closed** |
| 2 | **A2-P2** | Optional wire **display** string ≠ `Net.name` | **Closed** — [p2](diagram-lab-pilot-a2-p2-display-labels.md) |
| 3 | **A2-P3** | LaTeX via TeX→SVG (MathJax SVG), cache, lazy load | **Implemented** — [p3](diagram-lab-pilot-a2-p3-latex-labels.md); manual accept open |
| 4 | **A2-P4** | Restricted Markdown + inline math | Medium |
| 5 | **A2-P5** | Shared formatted-text architecture | Architecture |

Suggested acceptance tests (when released):

- P1: Multiplier/Adder/OSC wires meet visible body or explicit leads at 100% and after resize.  
- P2: Rename net updates non-override labels only; override survives; by-name join unchanged.  
- P3: All example formulas render; pan/zoom/drag without re-typeset; offline; invalid TeX safe.  
- P4: Bold/italic/breaks + inline math; plain default round-trip.  
- Export smoke (when D5e exists): formulas visible in exported SVG without network.

---

## 8. Open architectural questions

1. Side-pin semantics forever on the AABB, with free pins for contour work — or a future “attach to shape” mode?  
2. Display override on `Label` vs a parallel structure?  
3. MathJax v3/v4 bundle size vs a thinner TeX→SVG service for export-only?  
4. Should block `displayText` gain formats in the same milestone as wire labels?  
5. Baseline font metrics so formula baselines align with plain SVG text?  
6. How do symbol-definition texts (`SymbolLabel`) opt into LaTeX without breaking catalog plain strings?

---

## 9. Findings classification (from this investigation)

| Observation | Class |
| --- | --- |
| Port gaps on Multiplier/Adder/OSC | **Essential missing capability** of *catalog artwork* (model already allows fix via leads / flush / free pins) — not a Lab geometry bug |
| No math on labels | **Essential** for scientific/education diagrams |
| No net display ≠ name | **Essential** for HDL/Python + teaching notation |
| Restricted Markdown | **Useful convenience** |
| Shared formatted-text engine | **Future architecture** |
| Auto contour snap | **Deferred** (avoid) |
| Math dependency choice | **Architecture** — lean SVG for D5e |

---

## 10. Scope honoured

Read-only investigation and documentation. No source, catalog, schema, dependency, Symbol Designer, Library Manager, simulator, roadmap renumbering, staging, commit, or push.

Preserve A2 execution, S5b, and D5d gates.

---

## 11. Stop

Await review and **separate** implementation freigabe (recommended order P1 → P2 → P3 → P4). Continue A2.2/A2.3 library lifecycle with current symbols; record visual gaps as known limitations until P1 ships.
