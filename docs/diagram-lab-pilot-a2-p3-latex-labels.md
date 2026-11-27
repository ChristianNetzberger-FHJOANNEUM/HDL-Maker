# A2-P3 — Scientific LaTeX labels (MathJax SVG)

**Status:** **Closed / accepted** (27 Nov 2026) — manual checklist **14/14** (user acceptance).  
**Baseline:** A2-P2 closed; [A2-P3a](diagram-lab-pilot-a2-p3a-block-latex.md) block LaTeX **closed** (aggregate regression). **A2-P4** — [spec](diagram-lab-pilot-a2-p4-markdown-math.md); implementation gated on architecture review.  
**Related:** [a2-p2](diagram-lab-pilot-a2-p2-display-labels.md), [scientific investigation](diagram-lab-pilot-a2-scientific-presentation-investigation.md), [a2-findings](diagram-lab-pilot-a2-findings.md), [pilots](diagram-lab-application-pilots.md).

---

## 1. Objective

Enable scientific mathematical notation on **individual wire display labels** via LaTeX source and MathJax SVG rendering, while preserving the separation between logical net identity (`Net.name`) and graphical presentation (`Label.displayText`).

---

## 2. Dependency and licensing decision

| Item | Choice |
| --- | --- |
| Library | **`mathjax-full@3.2.2`** (npm; Apache-2.0) |
| Output | SVG (`fontCache: 'none'`) |
| Alternative considered | KaTeX — faster, but no native SVG output; extra work for D5e self-contained export |
| MathJax 4 / `@mathjax/src` | Deferred; v3 modular API is stable for offline Vite bundling |
| CDN / remote fonts | **None** — all typesetting is local from `node_modules` |
| Bundle | Lazy dynamic `import()` → separate Vite chunk `mathjax-*.js` (~1.6 MB / ~568 KB gzip). Plain-text diagrams never load it. |

**Integration notes**

- Programmatic path uses `liteAdaptor` + restricted TeX packages (`base`, `ams`) with side-effect configuration imports (no `MathJax.init()` node/fs loader).
- Compatible with Vue 3, Vite 8, TypeScript, and the portable lab build.
- No second math library.

**No blockers** found for offline operation, licensing, or Vue/Vite integration.

---

## 3. Persistent model

On existing name-role `Label` (no new label type):

```ts
displayText?: string           // A2-P2 — custom glyph source
textFormat?: 'plain' | 'latex' // A2-P3 — omitted ≡ plain
```

| Situation | Drawn representation |
| --- | --- |
| Inherited net name | Always **Plain Text** (`Net.name`) |
| Custom + omitted / `plain` | Literal `displayText` |
| Custom + `latex` | MathJax SVG from `displayText` (no `$` delimiters) |

**Persisted:** source text + format only.  
**Not persisted:** generated SVG, cache entries, async tokens, engine state.

`Use net name` deletes `displayText` and `textFormat`. Format changes preserve source text. Note labels are unchanged.

---

## 4. Rendering architecture

```text
Label.displayText + textFormat
        │
        ▼
  labelText / labelTextFormat   (model — nets.ts)
        │
        ├── plain ──► existing <text> fast path
        │
        └── latex ─► mathRender.renderMath()  (lazy MathJax)
                         │
                         ▼
                   cached SVG geometry
                         │
                         ▼
                   DiagramStage <g v-html> placement
```

Service file: `diagram-lab/src/core/mathRender.ts`.

Separation:

| Concern | Owner |
| --- | --- |
| Source + format | Document model |
| Typesetting | `mathRender` |
| SVG geometry / dimensions | Runtime result (+ bounded cache) |
| Canvas placement / selection / drag | Existing stage + label anchors |
| Net identity / wire geometry | **Not** referenced by the service |

Suitable for later reuse by block display text, port labels, free text, and symbol artwork — **not implemented in P3**.

---

## 5. Offline operation

- Dependency is vendored via npm; production build embeds the MathJax chunk.
- Restricted TeX config: no HTML output, no URL/href helpers, no dynamic package loading, no remote font fetch (`fontCache: 'none'` embeds paths).
- Preview and stage rendering work with the network disabled after assets are on disk.

---

## 6. SVG integration

- Inline MathJax `<svg>` under the existing overlay SVG (no second diagram renderer).
- Baseline: MathJax `vertical-align` → pixel ascent; group translated to label point with `y = −ascent` on the SVG.
- Size: `em` = label `fontSize` or stage default (13 px); scales with zoom via the parent SVG transform.
- Anchoring / P5a offsets / selection / drag unchanged; hit target grows with formula bounds.
- `currentColor` / CSS `.label.math` for light appearance (same ink as plain labels).
- `pointer-events: none` on math SVG; hit circle remains the interaction target.
- `fontCache: 'none'` avoids shared glyph `<defs>` collisions; `rewriteSvgIds` remains as a defensive helper for future cache modes / D5e export.
- Full D5e SVG exporter is **not** implemented; generated markup is suitable as a future self-contained fragment.

---

## 7. Cache and performance

| Event | Typeset? |
| --- | --- |
| New / changed LaTeX source or `em` | Yes |
| Identical formula + config | Cache hit |
| Block / port / wire / label move | No |
| Pan / zoom | No |
| Plain Text labels | No (MathJax not loaded) |
| Hide label | Consumer dropped; no typeset |

- LRU cache limit: **64** entries (`MATH_RENDER_CACHE_LIMIT`).
- Stats: `getMathRenderStats()` → `typesetCount`, `cacheHits`, `cacheSize`, `engineLoads`.
- Per-label generation tokens (`beginMathRequest` / `isMathRequestCurrent`) discard stale async results after rapid edits or label deletion.
- Cache / typesetting never create history entries or dirty the document.

---

## 8. Security restrictions

- TeX packages: **`base`, `ams` only**.
- `maxMacros: 1000`, `maxBuffer: 5 KiB`.
- No user HTML/JS execution; SVG paths only from MathJax.
- Invalid input → non-blocking error string; source kept for correction; stage shows italic fallback text until fixed.

---

## 9. Properties UI

Wire inspector (custom display label):

1. Display: Use net name | Custom display label  
2. **Text format:** Plain Text | LaTeX  
3. Display text (source)  
4. **Preview** (LaTeX) with non-blocking error line  
5. Show / Remove / Reset position (unchanged)

---

## 10. D5e export implications

- Export should typeset from persisted LaTeX (or reuse the same service) and embed self-contained SVG with unique IDs.
- Prefer `fontCache: 'none'` or per-formula ID prefixes (`rewriteSvgIds`).
- Do not store runtime SVG in the JSON document.

---

## 11. Future reuse

Dashed consumers (not in P3): block display text, port names, free annotations, symbol artwork. Keep calling `renderMath` only.

---

## 12. Automated verification

```text
npm run selfcheck   # includes A2-P3 model, persistence, history, math service cases
npm run check
npm run build       # confirms mathjax code-split chunk
```

Covered: format semantics, Use-net-name clear, undo/redo, save/load (incl. backslashes), copy/paste fragment, scientific formulas (subscripts, Greek, fractions, roots, sums, integrals, BPSK \(P_b\), matrices), invalid LaTeX, cache hits, SVG id rewrite, plain fast path.

---

## 13. Manual acceptance checklist (A2-P3)

**14/14** — user acceptance 27 Nov 2026. Automated evidence: `npm run selfcheck` (A2-P3 cases) + `npm run check`.

1. Greek + indices  
2. Fractions + roots  
3. Sums + integrals  
4. Matrix  
5. Plain ↔ LaTeX switch (source preserved)  
6. Invalid formula → correct  
7. Several formulas on one logical net  
8. Free position + reset  
9. Pan / zoom  
10. Move block with attached formula  
11. Undo/redo text + format  
12. Copy/Paste + Shift+Drag  
13. Save/Load  
14. Offline after load  

---

## 14. Defect fix (A2-P3/P3a-Fix1)

**Symptom:** Missing fraction / radical bars; wrong underline/overline placement in block and wire LaTeX.

**Cause:** `finalizeSvg()` in `mathRender.ts` removed **all** `width` / `height` attributes in the MathJax string, not only on the root `<svg>`. Inner `<rect>` rule geometry (mfrac, msqrt) and nested `<svg>` elements (munder/mover) lost dimensions.

**Fix:** Strip `width` / `height` / root `style` only on the **outer** `<svg>` tag; preserve inner geometry.

**Regression:** `npm run selfcheck` cases `A2-P3-Fix1:*`.

Manual re-test after fix: `\frac{1}{2}`, `\sqrt{x^2+y^2}`, `\underline{x+y}`, `\overline{AB}`, nested fractions.

---

## 15. Known limitations

- Block LaTeX: [A2-P3a](diagram-lab-pilot-a2-p3a-block-latex.md). Port/symbol LaTeX not in scope.  
- **Multiline LaTeX:** use AMS (`gathered`, `aligned`, …); Enter in the textarea is not a layout break.  
- Markdown: [A2-P4 spec](diagram-lab-pilot-a2-p4-markdown-math.md) — not implemented.  
- No auto-detection of LaTeX in plain text.  
- MathJax chunk is large; first LaTeX use pays load cost once.  
- Complex macros outside `base`/`ams` are unsupported by design.  
- Full sheet SVG export (D5e) not implemented.

---

## 16. Changed files / dependency

| Path | Change |
| --- | --- |
| `diagram-lab/package.json` / lock | `mathjax-full@3.2.2` |
| `diagram-lab/src/core/mathRender.ts` | **New** math service |
| `diagram-lab/src/core/document.ts` | `Label.textFormat` |
| `diagram-lab/src/core/nets.ts` | format helpers |
| `diagram-lab/src/core/edit.ts` | copy/paste `textFormat` |
| `diagram-lab/src/core/selfcheck.ts` | A2-P3 checks |
| `diagram-lab/src/view/DiagramStage.vue` | UI + SVG integration |
| `diagram-lab/src/style.css` | math label / preview styles |
| `diagram-lab/vite.config.ts` | mathjax chunk / optimizeDeps |
| `docs/diagram-lab-pilot-a2-p3-latex-labels.md` | this file |

**Non-goals respected:** no Markdown, no D5d optimisation, no D5e exporter, no Symbol Designer, no commit/push, S5b/D5d/HDL-Maker Studio gates preserved.
