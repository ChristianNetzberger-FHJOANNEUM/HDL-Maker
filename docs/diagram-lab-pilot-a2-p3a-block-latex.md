# A2-P3a — LaTeX on block display text

**Status:** **Closed / accepted** (27 Nov 2026) — manual review via **aggregate regression** (see §8). Fix1 applied before final review.  
**Baseline:** [A2-P3](diagram-lab-pilot-a2-p3-latex-labels.md) wire LaTeX closed. **A2-P4** — [p4](diagram-lab-pilot-a2-p4-markdown-math.md) **closed**.  
**Multiline LaTeX:** Use AMS environments (`gathered`, `aligned`, …); **do not** convert textarea newlines to `\\`.  
**Related:** A1-P2/P3/P3a block text, [A2-P3](diagram-lab-pilot-a2-p3-latex-labels.md), [pilots](diagram-lab-application-pilots.md).

---

## 1. Objective

Extend the **centred block display caption** (A1-P2) with optional LaTeX via the existing `mathRender` service (A2-P3). Logical block `name`, ports, nets, and symbol definitions are unchanged.

---

## 2. Persistent model

On `Block` (alongside existing P2/P3a fields):

```ts
displayText?: string
textFormat?: 'plain' | 'latex' // A2-P3a — omitted ≡ plain
displayTextOffset?: Point      // P3a — unchanged
style?: BlockStyle             // text colour — unchanged
```

| Mode | Rendering |
| --- | --- |
| Omitted / `plain` | Multiline `<span>` lines (existing P2) |
| `latex` + `displayText` | MathJax SVG (`em` = 12 px, matches `.block-display`) |

**Persisted:** source + format only. **Not persisted:** SVG, cache, async tokens.

Clearing `displayText` deletes `textFormat`. Plain format deletes `textFormat` but keeps source.

---

## 3. Architecture

Same service and **shared LRU cache** as wire labels (`diagram-lab/src/core/mathRender.ts`).

```text
Block.displayText + textFormat
        │
        ├── plain ──► BlockNode multiline text (P2)
        │
        └── latex ─► renderMath() ──► mathByBlock (runtime) ──► BlockNode v-html
```

Helpers: `blockTextFormat`, `setBlockTextFormat` in `edit.ts`.

---

## 4. UI

Block inspector (when one block selected):

1. **Text format:** Plain Text | LaTeX  
2. **Display text** (textarea; single-expression LaTeX)  
3. **Preview** (LaTeX, non-blocking errors)  
4. Offset, reset position, show/hide, appearance — unchanged from P3a

---

## 5. Layout

- Group at block centre + `displayTextOffset` (P3a).  
- LaTeX SVG centred in the flex group using measured width/height.  
- `style.text` colour applied via `displayStyle` on the group (`currentColor` on SVG).  
- No automatic block resize.

---

## 6. Scope limits

- Wire labels: already LaTeX (P3).  
- Block name, port names, symbol labels: plain only.  
- No Markdown (A2-P4).  
- No new dependencies or second renderer.

---

## 7. Automated verification

```text
npm run selfcheck   # A2-P3a persistence, format, undo, duplicate, shared cache
npm run check
```

---

## 8. Manual acceptance (A2-P3a)

**Aggregate regression — accepted 27 Nov 2026** (user review after [Fix1](diagram-lab-pilot-a2-p3-latex-labels.md#14-defect-fix-a2-p3p3a-fix1)):

- Simple and complex formulas; nested fractions and radicals; underlines/overlines restored.  
- AMS: `gathered`, `aligned`, `cases`, `pmatrix`; representative BPSK BER expression.  
- Block and wire consumers; inspector preview; pan/zoom/drag behaviour; plain multiline regression.  
- Automated: `npm run selfcheck` (incl. A2-P3a + Fix1), `npm run check`.

**Not recorded:** per-item 0/10 checklist ticks — the checklist below remains a **reference** for spot checks, not a claim of individual sign-off.

1. Plain multiline block text unchanged (regression)  
2. LaTeX: subscripts, Greek, fraction on a block  
3. Plain ↔ LaTeX preserves source  
4. Invalid LaTeX → fix → preview  
5. Text colour from block appearance applies to formula  
6. Free position + reset (P3a) with LaTeX visible  
7. Pan / zoom with formula on block  
8. Move block — formula follows offset  
9. Undo/redo format + text  
10. Save/load; duplicate block with LaTeX  

---

## 9. Shared rendering fix (A2-P3/P3a-Fix1)

Block and wire labels share `mathRender.ts`. A root-cause fix for missing fraction/radical bars and underline/overline defects applies to **both** consumers — see [A2-P3 §14](diagram-lab-pilot-a2-p3-latex-labels.md).

---

## 10. Changed files

| Path | Change |
| --- | --- |
| `diagram-lab/src/core/document.ts` | `Block.textFormat` |
| `diagram-lab/src/core/edit.ts` | `blockTextFormat`, `setBlockTextFormat` |
| `diagram-lab/src/view/DiagramStage.vue` | `mathByBlock`, inspector, previews |
| `diagram-lab/src/view/BlockNode.vue` | LaTeX branch |
| `diagram-lab/src/style.css` | `.block-display-math` |
| `diagram-lab/src/core/selfcheck.ts` | A2-P3a cases |
| `docs/diagram-lab-pilot-a2-p3a-block-latex.md` | this file |

S5b / D5d independent. No commit/push unless requested.