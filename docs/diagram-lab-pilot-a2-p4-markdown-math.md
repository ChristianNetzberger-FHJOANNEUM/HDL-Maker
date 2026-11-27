# A2-P4 — Markdown + inline math

**Status:** **Implemented — A2-P4-Fix2 applied — manual retest pending** (27 Nov 2026).  
**Baseline:** [A2-P3](diagram-lab-pilot-a2-p3-latex-labels.md) + [A2-P3a](diagram-lab-pilot-a2-p3a-block-latex.md) closed; shared `mathRender.ts` + Fix1.  
**Related:** [scientific investigation](diagram-lab-pilot-a2-scientific-presentation-investigation.md) §5, [pilots](diagram-lab-application-pilots.md).  
**Gates:** S5b / D5d independent. D5e export not implemented in this package.

---

## 1. Objective

Add **`markdown`** as a third persisted text format for **wire display labels** and **block display text**, combining restricted prose styling with inline and display mathematics, while:

- Reusing **`mathRender`** (MathJax SVG) for all math — one cache, one security model.  
- Preferring **SVG-first layout** in the editor (align with D5e export goals).  
- Preserving **`plain`** and **`latex`** behaviour unchanged.

**Out of scope for P4 v1:** symbol-internal labels, free annotations, WYSIWYG rich-text editor, full CommonMark, HTML rendering in the canvas, D5e export, font-to-path conversion.

---

## 2. Consumer model

| Consumer | Persisted fields | P4 |
| --- | --- | --- |
| Wire name label | `displayText`, `textFormat?: plain \| latex \| markdown` | Markdown option + multiline textarea |
| Block caption | same | same |

```ts
textFormat?: 'plain' | 'latex' | 'markdown'  // omitted ≡ plain
```

- **Plain** and **LaTeX:** unchanged from P2/P3/P3a.  
- **Markdown:** source string only; layout + MathJax at runtime.

---

## 3. Supported subset (binding)

| Feature | Syntax |
| --- | --- |
| Line break | single newline outside math |
| Paragraph gap | blank line |
| Bold / italic / both | `**` / `*` / `***` |
| Inline code | `` ` `` — no math interpretation inside |
| Inline math | `$…$` |
| Display math | opening `$$` and closing `$$` each on its own line |
| Escaped `$` | `\$` |
| Malformed `$` | readable fallback + warning |
| HTML-like tags | literal text, no execution |

**Not in v1:** headings, lists, links, images, tables, `\(...\)` / `\[...\]`, autowrap, nested MD in math, executable HTML.

---

## 4. Architecture (approved)

**Approach B → SVG-first formatted text** (HTML hosts for block/wire chrome only):

```
Source (persisted)
  → formattedTextParse.ts (state-based tokenizer)
  → formattedTextRender.ts (layout + bbox, LRU by source+em)
  → mathRender.ts (unchanged, Fix1)
  → SVG <g class="formatted-text"> …
```

Consumers share one pipeline: wire label on canvas, block caption (`BlockNode.vue`), inspector previews (`DiagramStage.vue`).

**Layers (performance):**

| Layer | Invalidate on |
| --- | --- |
| Parse | source change |
| Layout | source, em, font metrics layout props |
| Presentation | colour (`currentColor`), position, visibility — no re-layout on pan/zoom/drag |

Display math line height follows tallest/deepest element per row; prose and inline math share a baseline per line.

**D5e boundary:** layout is SVG-friendly; normal prose uses `<text>` (font-dependent); MathJax uses paths. Future export may offer editable vs publication modes — not built in P4.

---

## 5. Binding decisions (§14 review, 27 Nov 2026)

1. Single `\n` = line break; blank line = paragraph gap; LaTeX newline semantics unchanged inside math delimiters.  
2. `$…$` inline; `$$` display on dedicated lines only; other delimiters deferred.  
3. Hand subset parser — no new npm dependency; no fragile global regex chains.  
4. No automatic wrapping or block resize from text width.  
5. Wire + block in one package (parser → layout → both consumers → previews → persistence tests).

---

## 6. Implementation map

| Module | Role |
| --- | --- |
| `diagram-lab/src/core/formattedTextParse.ts` | Parse tree |
| `diagram-lab/src/core/formattedTextRender.ts` | Layout + SVG fragment + layout LRU |
| `diagram-lab/src/core/mathRender.ts` | Math only (shared) |
| `diagram-lab/src/core/document.ts`, `nets.ts`, `edit.ts` | `markdown` on model + fragment paste |
| `diagram-lab/src/view/DiagramStage.vue` | Async maps, wire/block draw, inspector |
| `diagram-lab/src/view/BlockNode.vue` | Centre-aligned formatted host |
| `diagram-lab/src/style.css` | `.formatted`, preview host |

---

## 7. Automated verification

`npm run selfcheck` — `A2-P4:*` parser/persistence plus **`A2-P4-Fix1:*` layout regression** (four minimal cases, AWGN sample, root `<svg>` wrapper, distinct text baselines, math glyph presence, bbox).

`npm run check` — `vue-tsc --noEmit`.

**Browser/DOM rendering:** not automated in this package; manual retest required after Fix1.

## 7.1 A2-P4-Fix1 (layout + invisible math)

**Root cause:** `renderFormattedText` emitted a bare `<g>` with SVG `<text>` / MathJax fragments. Block caption and inspector preview inject via HTML `v-html` on `<div>` — outside the SVG namespace, `y`/`transform` are ignored → lines concatenated, math invisible. Wire labels used an extra `translate(0,-ascent)` on top of what should match the LaTeX contract.

**Correction:** wrap layout in a self-contained root `<svg>` (same placement contract as `mathRender`, `y=-ascent`), fix multi-line vertical stepping in `buildLayout`, align wire/block/preview hosts with LaTeX (no double baseline shift), cache only successful layouts.

## 7.2 A2-P4-Fix2 (invisible math)

**Root cause:** `formattedTextRender` stripped the outer MathJax `<svg>` and re-inserted the inner markup with `scale(1,-1)`. That diverged from the working LaTeX path (`mathRender` full `<svg>` with `y=-ascent`) and left inline/display glyphs effectively off-screen / not painted in nested SVG hosts.

**Correction:** embed each math segment as a **full** MathJax `<svg>` at `translate(x, baselineY)` with `rewriteSvgIds` only — same composition contract as A2-P3 wire labels. Prose layout from Fix1 unchanged.

**Browser verification:** not automated in CI; developer structural checks only (`selfcheck` nested `<svg>`, fraction `<rect>`, no `scale(1,-1)`). **Manual browser retest required.**

---

## 8. Manual acceptance checklist

Aggregate pass acceptable (as P3a). Suggested scenarios from freigabe §6:

- [ ] **AWGN channel** — bold title, inline Gaussian, italic footnote (block markdown).  
- [ ] **BPSK detector** — `cases` in display or inline math as authored.  
- [ ] **Low-pass** — display `$$` + inline cutoff on following lines.  
- [ ] **BER** — `erfc` display equation + italic caption.  
- [ ] Same source on wire label (position, offset, colour).  
- [ ] Inspector preview matches canvas (baseline/ascent).  
- [ ] Undo, duplicate, fragment paste with `textFormat: markdown`.  
- [ ] Plain + LaTeX regression unchanged; Fix1 fractions/sqrt/underline still correct inside `$…$`.  
- [ ] Zoom/pan/drag without visible re-typeset flicker.

**Progress:** 0 / 9 (pending user sign-off).

---

## 9. Package status

| Package | State |
| --- | --- |
| A2-P3 / A2-P3a | Closed |
| A2-P4 | **Implemented — awaiting manual acceptance** |
| A2-P5 | Gated on P4 acceptance |
| D5e | Export boundary only; not in P4 |

No commit/push from this close-out unless separately requested.

---

## 10. Handoff

Next after acceptance: complete BPSK pilot (A2) with scientific block captions; defer extra Markdown features until real pilot feedback. Object Snap / S5b / D5d remain independent.