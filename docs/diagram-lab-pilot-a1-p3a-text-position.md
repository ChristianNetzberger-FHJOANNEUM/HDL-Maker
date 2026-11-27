# P3a — Block display text positioning

**Status:** **Accepted** by user (27 Nov 2026) — free mouse repositioning of display text confirmed on A1 (no port-name overlap).  
**Depends on:** P2 accepted; P3 function confirmed.  
**Related:** [diagram-lab-pilot-a1-p2-display-text.md](diagram-lab-pilot-a1-p2-display-text.md), [diagram-lab-pilot-a1-p3-block-appearance.md](diagram-lab-pilot-a1-p3-block-appearance.md), [diagram-lab-pilot-a1-presentation-findings.md](diagram-lab-pilot-a1-presentation-findings.md), [diagram-lab-pilot-a1-p4-grid-snap.md](diagram-lab-pilot-a1-p4-grid-snap.md).

---

## 1. P3 acceptance note

User confirmed **P3 block appearance works** (fill / border / text colour / transparent / reset). The full 14-point checklist was not re-signed item-by-item; any unverified rows remain open if regressions appear. P3a follows from A1 presentation feedback: geometric centre is not always the best caption position.

---

## 2. Summary

Independently movable **P2 display text** as a minimal extension. Automatic horizontal and vertical centring remains the default.

| Field | Default | Effect |
| --- | --- | --- |
| `Block.displayTextOffset?: { x, y }` | omitted ≡ `(0, 0)` | Offset of the multiline caption from the **block centre**, in diagram units |

Missing offsets resolve to zero. Setting `(0, 0)` or `null` via `setDisplayTextOffset` deletes the field (lean JSON; legacy docs unchanged).

No new text engine, no standalone text objects, no rich text / rotation / fonts / multiple captions.

---

## 3. Geometry behaviour

- **Block move** — text moves with the block (offset is centre-relative).
- **Block resize** — new centre is used; **stored offset is preserved** (not clamped or rewritten).
- **Text drag** — does not change block geometry, ports, wires, stubs, or connectivity.
- **Multiline** — whole group moves as one unit; line spacing and centre alignment inside the group are unchanged.
- **Boundary** — text may leave the block box; overflow is visible. Offset is never silently altered on resize.
- **Symbol labels** — internal symbol text shapes are untouched.
- **Snap** — text offset is **not** grid-snapped (integer diagram units only) so presentation can be adjusted finely. Block/port/wire snap policy is unchanged.

---

## 4. Interaction

- Select a block → display text shows a subtle dashed outline (drag target).
- Drag the caption with the mouse (`nodrag nopan` + stopPropagation) so Vue Flow does not start a block drag.
- Wire-label gesture pattern reused: `begin` → `preview` from baseline → one `commit` (or Escape cancel).
- Properties: **Text offset X/Y** number inputs + **Reset text position**.
- No separate text-editing mode.

---

## 5. History and persistence

| Concern | Behaviour |
| --- | --- |
| Gesture preview | From gesture baseline |
| Effective drag | One history entry |
| Unchanged position | No history entry (`serialize` equality) |
| Escape / blur / cancel | Restores original offset |
| Undo / Redo | Restores offset |
| Save / load | Preserves `displayTextOffset` |
| Duplicate / paste / Shift+Drag | Copies relative offset; copies are independently editable |
| Reset text position | One atomic history entry; clears field |
| P1 / P2 / P3 | All preserved |

---

## 6. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/core/document.ts` | `displayTextOffset?: Point` |
| `diagram-lab/src/core/edit.ts` | `setDisplayTextOffset` |
| `diagram-lab/src/view/BlockNode.vue` | Centre + offset render; selected drag hit |
| `diagram-lab/src/view/DiagramStage.vue` | Gesture, props, Reset / offset UI |
| `diagram-lab/src/style.css` | `.block-display` / `.movable` |
| `diagram-lab/src/core/selfcheck.ts` | P3a cases |
| Docs | This file; pilots; handoff; P3 acceptance note |

---

## 7. Automated

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | **Pass** |
| `npm run selfcheck` | **Pass** (incl. P3a cases) |

---

## 8. Manual acceptance (A1)

Use the existing A1 pilot diagram.

1. Default centred text when no offset is set.  
2. Select a block → drag display text horizontally and vertically.  
3. Multiline caption moves as one group.  
4. Move the block → text follows; resize → offset preserved relative to new centre.  
5. Escape during text drag → original position.  
6. Undo / Redo text position.  
7. Save / load keeps offset.  
8. Duplicate / paste → copy keeps offset and can be edited alone.  
9. **Reset text position** → automatic centre; one undo step.  
10. Try at more than one zoom level.  
11. Regression: block drag, port drag, resize handles, wire / label drag still work.  
12. P1 visibility, P2 text content, P3 colours unchanged.

---

## 9. Scope / limitations

- P3a only. No P4 grid/snap separation.  
- No standalone text objects, rich text, rotation, fonts, or multiple display texts.  
- Text may sit outside the block; no soft “keep inside” clamp.  
- Offset inputs are integer-friendly; drag rounds to whole diagram units.  
- S5b and D5d gates preserved. No roadmap change. No commit/push in this slice.

---

## 10. Acceptance notes

| Area | Status |
| --- | --- |
| Mouse drag repositioning (user / A1 screenshot) | **Confirmed** — captions clear of port names |
| Coloured blocks + text composition (visual) | **Confirmed** alongside P3 |
| Persistence / duplication / Escape cancel / Undo–Redo | Automated selfchecks cover these; **not re-signed** in the latest manual pass — treat as open if regressions appear |
| Full 12-point checklist item-by-item | Not exhaustively re-run after the visual confirmation |

P4 released next (independent grid visibility vs snap).
