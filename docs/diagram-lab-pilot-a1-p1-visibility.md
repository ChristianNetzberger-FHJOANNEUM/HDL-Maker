# P1 — Persistent label visibility

**Status:** **Fully accepted** by user (27 Nov 2026) — 9/9 manual criteria.  
**Depends on:** P0 / P0b accepted (visual).  
**Related:** [diagram-lab-pilot-a1-presentation-findings.md](diagram-lab-pilot-a1-presentation-findings.md), [diagram-lab-pilot-a1-p1-fix-undo.md](diagram-lab-pilot-a1-p1-fix-undo.md), [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md).

---

## 1. Summary

P1 adds optional, persistent presentation flags so redundant names can be hidden without changing HDL/logical identity, geometry, or connectivity.

| Control | Scope | Default |
| --- | --- | --- |
| Show instance name | Block instance | Visible (attribute omitted) |
| Show port names | Block instance (all ports) | Visible |
| Show wire label | Labels on the **selected segment** | Visible |

Hiding a segment’s labels does **not** hide labels on other segments of the same named net.

---

## 2. Document model

```ts
Block.showName?: boolean        // false = hide glyph; omit/true = show
Block.showPortNames?: boolean   // false = hide pin text; marks stay
Label.visible?: boolean         // false = skip paint; omit/true = show
```

**Default resolution:** `value !== false` → drawn. Missing attributes keep pre-P1 appearance (no migration).

Showing again **deletes** the flag (lean JSON). Logical `Block.name`, `Port.name` / ids, `Net.name`, anchors, and geometry are untouched.

API: `setBlockFields(..., { showName?, showPortNames? })`, `setSegmentLabelsVisible(doc, segmentId, visible) → boolean`.

---

## 3. UI

| Selection | Control |
| --- | --- |
| One block | Checkboxes **Show instance name**, **Show port names** (Name field always available) |
| One wire/segment | Checkbox **Show wire label** (Net name field always available) |

No need to pick an invisible label to restore it. No separate presentation editor.

No-op when the checkbox already matches the stored state (no history entry). Segments with no labels ignore the toggle.

---

## 4. History / copy / persistence

- Visibility edits use shared `EditSession.execute` (one undo step when something changes).
- `duplicateBlocks` / `captureFragment` / `pasteFragment` spread block fields; `copySegmentLabels` copies `visible`.
- Save/load via normal `serialize` / `parseDocument` (optional fields).

---

## 5. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/core/document.ts` | Optional `showName`, `showPortNames`, `Label.visible` |
| `diagram-lab/src/core/edit.ts` | Visibility in `setBlockFields`; `setSegmentLabelsVisible`; label copy |
| `diagram-lab/src/view/BlockNode.vue` | Honor show flags; keydown on group |
| `diagram-lab/src/view/SymbolFace.vue` | `showPortNames` |
| `diagram-lab/src/view/DiagramStage.vue` | Props, segment-scoped label paint/UI |
| `diagram-lab/src/style.css` | `.props label.check` |
| `diagram-lab/src/core/selfcheck.ts` | P1 coverage incl. same-net independence |

---

## 6. Verification (automated)

| Check | Result |
| --- | --- |
| `npm run check` (`vue-tsc`) | **Pass** (27 Nov 2026) |
| `npm run selfcheck` | **Pass** — default/absent flags, hide/show, logical names, connectivity, save/load, duplicate, undo, independent segments on one named net |

---

## 7. Manual acceptance (A1)

1. Hide / restore first block **Show instance name**.  
2. Hide / restore its **Show port names**.  
3. Confirm a second block is unaffected.  
4. Select one wire; hide **Show wire label**.  
5. Confirm another label on the **same named net** (other segment) stays visible.  
6. Hidden ports still selectable / wireable / draggable.  
7. Undo / redo.  
8. Save and reload.  
9. Duplicate a block with hidden names (+ stubs if present).  
10. Open an older document — default appearance unchanged.

---

## 8. Known limitations

- No per-port visibility override (block-level only).  
- Segment toggle affects **all** labels on that segment (not a separate label picker).  
- No P2 display text, P3 colours, P4 grid/snap split.  
- Multi-select bulk presentation deferred (mixed selection still gated).

---

## 9. Stop

Await user acceptance before P2.
