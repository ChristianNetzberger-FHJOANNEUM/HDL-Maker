# P1-Fix — Presentation attribute Undo/Redo

**Status:** **Accepted** with full P1 (27 Nov 2026).  
**Related:** [diagram-lab-pilot-a1-p1-visibility.md](diagram-lab-pilot-a1-p1-visibility.md)

---

## 1. User finding

Hiding instance / port names worked visually. **Ctrl+Z / Ctrl+Y after a visibility checkbox did not restore presentation.** P1 acceptance blocked.

---

## 2. Root cause (verified)

| Hypothesis | Result |
| --- | --- |
| Direct mutation bypassing history | **Rejected** — `commitBlockVisibility` / `commitSegmentLabelsVisible` use `edits().execute` → `EditSession` or project `TransactionManager.transact` |
| Snapshots omit presentation fields | **Rejected** — `serialize` / `serializeProject` keep `showName`, `showPortNames`, `Label.visible`; TM undo/redo restored them in a standalone probe |
| Stale renderer / props binding | **Rejected** as primary cause — document restore was correct when undo ran |
| **Keyboard focus / shortcut gate** | **Confirmed** |

`onKey` returned early via `typingTarget()` for **every** `INPUT`, including **checkboxes**. After a visibility click the orange focus stayed on the checkbox, so **Ctrl+Z never called document undo**.

Toolbar Undo did not go through `typingTarget` and already used the shared history (user was asked to compare; structural confirmation matches).

---

## 3. Correction

1. **`isTextEditingControl` / `isTextEditingTarget`** in `interactionPolicy.ts` — only text-like fields block document shortcuts; checkbox/radio/button do not.  
2. **`typingTarget`** in `DiagramStage.vue` delegates to that helper.  
3. **Blur** the checkbox after an effective visibility change so focus leaves the control.

No new history architecture. Persistent presentation vs transient chrome unchanged.

---

## 4. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/view/interactionPolicy.ts` | `isTextEditingControl`, `isTextEditingTarget` |
| `diagram-lab/src/view/DiagramStage.vue` | Use helper; blur after visibility commits |
| `diagram-lab/src/core/selfcheck.ts` | Undo/redo for all three attrs; project TM path; shortcut policy |
| Docs | This file; P1 visibility; handoff |

---

## 5. Automated results

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | **Pass** |
| `npm run selfcheck` | **Pass** (sheet + project TM undo/redo; checkbox shortcut policy) |

---

## 6. Manual acceptance

1. Select a block → uncheck **Show port names** → glyphs hide; checkbox updates.  
2. **Toolbar Undo** → ports visible; checkbox checked.  
3. **Toolbar Redo** → ports hidden again.  
4. Uncheck again → **Ctrl+Z** (focus may have left the checkbox) → ports visible.  
5. Repeat for **Show instance name** and **Show wire label**.  
6. Confirm Name text field still keeps Ctrl+Z for typing (document undo not stolen while editing the name string is acceptable / expected).  
7. Other blocks / other segments unchanged.

---

## 7. Acceptance progress

| Item | Status |
| --- | --- |
| Port names Undo/Redo | **Accepted** |
| Instance name Undo/Redo | **Accepted** |
| Wire label visibility + Undo/Redo | **Accepted** |
| Save/load, copy / Shift+Drag | **Accepted** |
| Full P1 (9/9) | **Accepted** |

P2 released after this acceptance.
