# A2-P5a — Text typography (implementation)

**Status:** **Closed / accepted** (28 Nov 2026).  
**Scope:** Horizontal alignment and font size for block display text and wire custom display labels (Plain, LaTeX, Markdown).  
**Out of scope:** P5b–P5d, SymbolLabel formatted text, line/paragraph spacing, font families, wrap-to-block.

---

## 1. Model

Optional persisted fields (diagram units; zoom-independent):

| Field | Block | Wire label |
| --- | --- | --- |
| `textAlign` | `'left' \| 'center' \| 'right'` | same |
| `fontSize` | `number` (diagram em) | existing `fontSize` reused |

**Backward compatibility:** omitted fields reproduce prior appearance:

- Block plain text → effective **center** (legacy CSS centring replaced by layout at default em **12**).
- Block LaTeX / Markdown → effective **left**.
- Wire custom labels → effective **left**; default em **13** when `fontSize` unset.
- Inherited net-name labels unchanged (SVG `<text>` + `text-anchor` when not on custom SVG path).

Canonical storage: alignments equal to the format default are **not** serialized (`delete` on set). Explicit **left** on plain blocks is stored when it differs from the plain default **center**.

---

## 2. Layout

- Line alignment via `lineAlignOffset(W, wᵢ, align)` inside `formattedTextRender` / `renderPlainDisplayText`; not CSS for Markdown.
- Layout cache key: `em|align|source`.
- Wire labels: `wireLabelAnchorDx(width, align)` shifts the SVG anchor at the placement point.
- LaTeX single expressions: MathJax retains internal AMS alignment; block/wire position unchanged except anchor shift on the outer box.
- A2-P4 baseline and paragraph/display-math spacing unchanged.

**Code:** `diagram-lab/src/core/textTypography.ts`, `formattedTextRender.ts`, `formattedTextParse.ts` (`parsePlainDisplayText`).

---

## 3. Inspector

**Typography** section on block (when display text non-empty) and wire custom display:

- Alignment select
- Font size (8–48)
- **Reset typography** — clears `fontSize` / `textAlign` only; source, format, colour, visibility, position unchanged.

Previews use the same em + align as the canvas.

---

## 4. Editing

- `setBlockTypography` / `resetBlockTypography` (`edit.ts`)
- `setLabelTypography` / `resetLabelTypography` (`nets.ts`)
- History: one transaction per inspector commit; no-op when unchanged.
- Copy/paste fragment and duplicate block propagate typography fields.

---

## 5. Verification

| Check | Result |
| --- | --- |
| `npm run selfcheck` | **Green** (incl. `A2-P5a:*` checks) |
| `npm run check` | **Green** |
| Browser SVG visual | **Accepted** (manual) |

### Manual acceptance (suggested)

1. Open BPSK / Channel Parameters sheet — **no** visual change before editing typography.
2. Block Markdown: center + em 16 → preview and canvas match; undo/redo.
3. Wire custom Markdown: right align + size change; save/load.
4. Plain block multiline: left vs center line positions inside caption.
5. Reset typography restores defaults without clearing text.
6. Format switch plain ↔ Markdown keeps size/align when set.

---

## 6. Gates (unchanged)

- **A2-P5b** port direction  
- **A2-P5c** wire arrowheads  
- **A2-P5d** generic circle  
- **A2-P5 (legacy)** SymbolLabel formatted text  
- **S5b**, **D5d**, **D5e**, **D5f**

---

## 7. Handoff

**Next after acceptance:** [A2-P5b port direction](diagram-lab-pilot-a2-p5-roadmap.md#2-a2-p5b--port-direction-semantics).  
Optional regression artifact: save BPSK sheet JSON under `docs/examples/` when available.