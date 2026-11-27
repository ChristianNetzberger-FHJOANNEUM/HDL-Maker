# P2 — Centred multiline block display text

**Status:** **Accepted** by user (27 Nov 2026) — A1 screenshot (ADDER / REGISTER multiline captions).  
**Depends on:** P1 fully accepted.  
**Related:** [diagram-lab-pilot-a1-presentation-findings.md](diagram-lab-pilot-a1-presentation-findings.md), [diagram-lab-pilot-a1-p1-visibility.md](diagram-lab-pilot-a1-p1-visibility.md), [diagram-lab-pilot-a1-p3-block-appearance.md](diagram-lab-pilot-a1-p3-block-appearance.md).

---

## 1. Summary

Instance-level caption independent of the logical instance name. Centred in the block box, multiline (`\n`), persistent with shared history.

| Field | Default | Effect |
| --- | --- | --- |
| `Block.displayText?: string` | omitted | Centred caption; empty string clears the field |
| `Block.showDisplayText?: boolean` | omit = show when text set | `false` hides the caption without deleting text |

Logical `name`, symbol definition text, geometry, and connectivity are unchanged.

---

## 2. Rendering

- HTML overlay `.block-display` inside `BlockNode` (not a new text engine).
- Flex column, centre align; one span per line (`white-space: pre` per line).
- `pointer-events: none` — move, resize, ports, and selection unchanged.
- Follows block size automatically (resize / move keep the caption centred in the instance box).
- Symbol instance names remain above the body (P1); display text sits in the body.

**Note:** On plain blocks, if both instance name and display text are shown, they share the centre. Typical teaching use: hide instance name (P1), show display text (P2).

---

## 3. UI

Block Properties:

- **Display text** — multiline textarea; commits on `change` (blur after edit) → one history entry.
- **Show display text** — checkbox (P1-style; blur after toggle for Ctrl+Z).

Textarea remains a text-editing target (Ctrl+Z while typing does not steal document undo).

---

## 4. History / copy / persistence

Same infrastructure as P1: `setBlockFields` + `edits().execute` / project transactions. Duplicate/copy spreads block fields including `displayText` / `showDisplayText`.

---

## 5. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/core/document.ts` | `displayText`, `showDisplayText` |
| `diagram-lab/src/core/edit.ts` | `setBlockFields` support |
| `diagram-lab/src/view/BlockNode.vue` | Centred overlay |
| `diagram-lab/src/view/DiagramStage.vue` | Props + UI + commits |
| `diagram-lab/src/style.css` | `.block-display`, textarea |
| `diagram-lab/src/core/selfcheck.ts` | P2 cases |
| Docs | This file; pilots; handoff |

---

## 6. Automated

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | **Pass** |
| `npm run selfcheck` | **Pass** |

---

## 7. Manual acceptance (A1)

1. Select a block → enter `Register` + newline + `4 Bit` in **Display text** → blur → caption centred.  
2. Hide **Show instance name** → only display text remains in the body.  
3. Uncheck **Show display text** → caption hides; text still in Properties.  
4. Undo / Redo through show/hide and text edits.  
5. Move and resize the block → caption stays centred.  
6. Save / reload.  
7. Duplicate or Shift+Drag → copy keeps display text (independent of original after further edits).  
8. Open an older document → no display text (unchanged look).  
9. Confirm ports / wires / P0 / P0b / P1 still behave.

---

## 8. Known limitations

- No per-line font size / alignment knobs (later).  
- Overlap with visible instance name on plain centred blocks (hide name).  
- No P3 fill/border in this slice.

---

## 9. Acceptance

User accepted P2 on the A1 pilot. P3 released next.
