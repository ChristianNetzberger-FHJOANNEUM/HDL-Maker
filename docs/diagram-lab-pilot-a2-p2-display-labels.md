# A2-P2 — Independent wire display labels

**Status:** **Closed / accepted** (27 Nov 2026). A2-P1 closed. **A2-P3** LaTeX implemented — [p3](diagram-lab-pilot-a2-p3-latex-labels.md) (manual accept open). A2-P4 (Markdown) remains gated until P3 acceptance.  
**Related:** [a2-p1](diagram-lab-pilot-a2-p1-symbol-connections.md), [scientific presentation investigation](diagram-lab-pilot-a2-scientific-presentation-investigation.md), [a2-findings](diagram-lab-pilot-a2-findings.md), A1 P5a/P5b label docs.

---

## 1. Objective

Separate **logical net name** (`Net.name`) from the **glyph drawn** by an individual wire name-label, so scientific diagrams can show `cos(ω₀t)` while connectivity and future HDL/Python ids keep `carrier_signal`.

---

## 2. Model change

On existing `Label` (no second label type):

```ts
displayText?: string  // A2-P2 — optional per-label override for name-role labels
```

| Situation | Drawn text (`labelText`) |
| --- | --- |
| Name label, `displayText` omitted | Current `Net.name` |
| Name label, `displayText` set (non-empty) | Trimmed custom string |
| Note label (`role: 'note'`) | Unchanged — still `Label.text` |

**Empty-string behaviour:** `setLabelDisplayText(doc, id, '')` or whitespace **deletes** `displayText` (inherit net name). Empty custom glyphs are not stored; use **Show label** off to hide.

**Independent:** `visible`, position (`offset` / P5a `shift`), Add/Remove label, Reset position.

No LaTeX/Markdown format field in this package.

---

## 3. Display resolution

`labelText(doc, label)` in `nets.ts`:

1. Note or non-segment → `label.text`  
2. Else if trimmed `displayText` non-empty → that string  
3. Else → `Net.name` for the anchored segment  

API: `setLabelDisplayText(doc, labelId, value | null)` — only name-role labels; does not rename nets.

---

## 4. Properties UI

Wire inspector (when a segment with a name label is selected):

- Logical **Name** (existing rename / by-name join)  
- **Display** select: Use net name | Custom display label  
- **Display text** input when custom (Unicode; commit on `change`, one history entry)  
- Show label / Remove name label / Reset label position (unchanged)  
- Add name label when absent  

Switching to **Use net name** clears `displayText` without removing the label or resetting position.

---

## 5. Logical independence

| Action | Effect on nets / connectivity |
| --- | --- |
| Edit `displayText` | None |
| Rename `Net.name` | Inheriting labels update; custom `displayText` **unchanged** |
| Multiple labels on one net | May each have different `displayText` |
| Remove label | Removes label object only |
| By-name merge / join | Unchanged rules; glyphs follow `labelText` after |

---

## 6. Persistence and editing

Preserved across block move/resize, port drag, wire/stub edit, label drag, reset position, hide/show, copy/paste (`captureFragment` / `pasteFragment` / `copySegmentLabels`), Shift+Drag paths that copy labels, save/load.

No silent migration: documents without `displayText` render exactly as before.

---

## 7. History

Shared document history. Display-text commits use `edits().execute` on input `change` / mode select — **at most one entry per completed edit**, not per keystroke. Undo/Redo restores create / edit / clear / remove+restore with text, position, and visibility.

---

## 8. Preparation for A2-P3

Resolution stays in `labelText`; rendering remains plain SVG `<text>`. A future renderer may branch on format (plain / LaTeX / Markdown) without changing net identity. **No** MathJax/KaTeX/Markdown/HTML in P2.

---

## 9. Automated verification

- `npm run selfcheck` — A2-P2 block: default inherit, Unicode, independent labels, rename mix, clear/empty, visibility, reset position, history, paste, persistence, legacy omit  
- `npm run check` (`vue-tsc --noEmit`)

---

## 10. Manual acceptance — **passed**

| # | Test | Status |
| --- | --- | --- |
| 1 | Custom display label | **Passed** |
| 2 | Unicode (`cos(ω₀t)`, …) | **Passed** |
| 3 | Logical net name unchanged | **Passed** |
| 4 | Rename net with mixed custom + inherited labels | **Passed** |
| 5 | Different labels on same net (2 segments, 1 net id) | **Passed** |
| 6 | Use Net Name | **Passed** |
| 7–9 | Move/reset, hide/show, remove/add | Prior P5a/P1/P5b + no regression reported |
| 10 | Undo/Redo | **Passed** |
| 11 | Copy/Paste | **Passed** |
| 12 | Save/Load (reload) | **Passed** |

**Automated:** `npm run selfcheck` ok; `npm run check` ok.

---

## 11. Limitations

- Plain text / Unicode only (no formula layout).  
- No block/port display-text changes in this package.  
- Note-role labels unchanged.  
- P5b still expects typically one name label per segment; multi-label nets use multiple segments.

---

## 12. Changed files

- `diagram-lab/src/core/document.ts` — `Label.displayText`  
- `diagram-lab/src/core/nets.ts` — `labelText`, `setLabelDisplayText`  
- `diagram-lab/src/core/edit.ts` — copy/paste label fields  
- `diagram-lab/src/view/DiagramStage.vue` — wire properties UI  
- `diagram-lab/src/core/selfcheck.ts` — A2-P2 tests  
- Docs: this file; A2 findings; pilots; handoff  

---

## 13. Closure

**A2-P2 closed.** Next separate freigabe: **A2-P3** LaTeX (MathJax-class SVG, offline). A2-P4 Markdown remains gated. Preserve S5b / D5d. No commit/push from this close-out.
