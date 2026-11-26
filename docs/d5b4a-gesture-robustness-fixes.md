# D5b.4a — Gesture robustness fixes and acceptance completion

D5b.4 received a practical user acceptance of **29 / 37** (2 fail, 1 not applicable, 5 open). D5b.4a corrected C3/E3 and related gaps and is **accepted by the user**. Follow-on interaction defaults are **D5b.5a**. Full D5b.5–D5b.6 stay locked until released. CL0–CL7 and EDU0–EDU6 remain strategic planning only.

## 1. Status

| Item | Status |
| --- | --- |
| D5b.4 | Partial acceptance — see §2 |
| D5b.4a | Accepted by the user |
| D5b.5a | Next interaction slice ([d5b5a-interaction-defaults.md](d5b5a-interaction-defaults.md)) |
| D5b.5–D5b.6 | Locked |

No new undo architecture. No dual history. Snapshot strategy unchanged. No new editor features. No schema / libs / EditableDiagram / Vue Flow upgrade.

## 2. Full user acceptance report (D5b.4) — unchanged

### Summary

| Result | Count |
| --- | --- |
| Passed | 29 |
| Failed | 2 |
| Not applicable | 1 |
| Open | 5 |
| **Total** | **37** |

| Group | Score |
| --- | --- |
| A – Block Drag | 5/5 |
| B – Block Resize | 5/5 |
| C – Port Drag | 5/6 |
| D – Wires | 3/4 |
| E – Browser edge cases | 4/5 |
| F – Undo/Redo during gestures | 2/6 |
| G – Save and hierarchy | 5/6 |

### Detailed results

#### A – Block Drag

- A1: Passed.
- A2: Passed.
- A3: Passed.
- A4: Passed.
- A5: Passed.

#### B – Block Resize

- B1: Passed.
- B2: Passed.
- B3: Passed.
- B4: Passed.
- B5: Passed.

#### C – Port Drag

- C1: Passed.
- C2: Passed.
- C3: **Failed.**
- C4: Passed.
- C5: Passed.
- C6: Passed.

#### D – Wires

- D1: Passed.
- D2: Passed.
- D3: Passed.
- D4: **Not applicable** (see §8).

#### E – Browser edge cases

- E1: Passed.
- E2: Passed.
- E3: **Failed.**
- E4: Passed.
- E5: Passed.

#### F – Undo/Redo during gestures

- F1: Open.
- F2: Open.
- F3: Passed.
- F4: Passed.
- F5: Open (UI-checkable without new shortcuts; see §9).
- F6: Open.

#### G – Save and hierarchy

- G1: Passed.
- G2: Passed.
- G3: Passed.
- G4: Passed.
- G5: Open.
- G6: Passed.

Positive observation from the user: normal drag/resize, hierarchy-wide history, dirty state, and Escape restore work. No fundamental TransactionManager redesign is required.

## 3. Cause C3 — wired port not draggable

### Proven cause

The SVG wire hit polyline (class `.hit`, `stroke-width: 12`, `pointer-events: stroke`) is painted in the world overlay **above** Vue Flow nodes. At a wired port endpoint the thick hit stroke receives `pointerdown` instead of the port / symbol pin control.

`elementsFromPoint` on the Example diagram confirmed:

- Exact pin centre → `sym-pin-hit` / `sym-pin-mark`.
- A few pixels toward the wire → `.hit` is topmost.

Unwired ports were unaffected because no `.hit` covers them. This predates D5b.4 (hit layer for wire selection); D5b.4 did not introduce it, but it blocked C3.

Not the primary cause: Vue Flow Handle connect mode, port-id rewrite, or routing algorithm.

### Fix

In `DiagramStage.vue` `onSpanDown`:

1. Convert the pointer to world coordinates.
2. If `portNearWorld` finds a port within a zoom-aware reach, **hand off** to `onPortDown` (same path as a direct port grab).
3. Otherwise keep existing span / wire selection behaviour.

Reach: `Math.max(12, 16 / zoom)` so the handoff stays usable when zoomed out.

### Guarantees kept

- Mid-span wire selection still works when the pointer is not near a port.
- Wire creation tool unchanged.
- Block drag / selection unchanged.
- No change to port id, `interfacePortId`, or net id.
- No routing algorithm change.

## 4. Cause E3 — resize survives focus loss

### Proven cause

On Alt-Tab / focus loss during resize, the browser often delivers **`pointerup` before `window` `blur`**. D5b.4’s `onResizeEnd` committed synchronously on `pointerup`. By the time `onWindowBlur` ran, the gesture was already committed (unintended commit — case 1 from the work order).

Escape cancel (B3) and block-drag focus loss (E2) worked because Escape never races with commit, and drag-stop timing / cancel paths already covered the drag case more reliably; resize end was the racing commit.

### Fix

1. `focusLossToken` incremented in `onWindowBlur` (also via `visibilitychange` → hidden and new `pagehide`).
2. `onResizeEnd`, `onDragStop`, and `onPortEnd` **defer commit by one `requestAnimationFrame`**.
3. Before commit: if the latch is closing, the token changed, `!document.hasFocus()`, or `visibilityState === 'hidden'` → **cancel** instead of commit.
4. Late end events after cancel remain no-ops via `GestureCloseLatch`.
5. **Regression fix:** `onResizeCancel` must ignore events once `resizeDrag` is already cleared. After a normal `pointerup`, `lostpointercapture` still emits `resizeCancel`; if that cancelled the still-open deferred gesture, every resize snapped back to the baseline. Mid-gesture cancel still works while `resizeDrag` is set.

State after focus loss: **cancel / restore baseline**; no open transaction; no history entry; redo stack preserved.

## 5. Shared cancel paths

| Interrupt | Mechanism |
| --- | --- |
| Escape | `onKey` → `cancelActiveDocumentGesture` |
| Window blur | `onWindowBlur` + token bump |
| `visibilitychange` hidden | same as blur |
| `pagehide` | same as blur |
| `pointercancel` | resize / port cancel handlers |
| Unexpected `lostpointercapture` | BlockNode → `resizeCancel` (ignored when latch already closing after commit) |
| Unmount / navigation / save / undo | existing D5b.4 cancel-first paths |

`transaction.ts` remains free of DOM APIs.

## 6. Keyboard shortcuts (as implemented)

Scoped to `window` `keydown` in `DiagramStage.vue`. Ignored while typing in inputs (`typingTarget`).

| Shortcut | Action |
| --- | --- |
| Escape | Cancel draft / merge / active document gesture; else clear selection |
| Ctrl/Cmd+Z | Undo (during gesture: cancel only, no history step) |
| Ctrl/Cmd+Shift+Z | Redo |
| Ctrl/Cmd+Y | Redo |
| Ctrl/Cmd+S | Save (cancels active gesture first via `save()`) |
| Ctrl/Cmd+A | Select all blocks |
| Ctrl/Cmd+C / V / D | Copy / paste / duplicate |
| Delete / Backspace | Delete selection |

Browser default for Ctrl+S is prevented. Full toolbar shortcut polish remains D5b.5; these bindings already exist and are effective.

## 7. D4 — incompatible target ports

`probeWire` / `commitWire` refuse: ambiguous snap, zero length, and accidental join of two distinct nets (explicit merge required). There are **no port-type / direction compatibility rules**.

**D4 = not applicable.** No new connection rules were added.

## 8. Open tests F1, F2, F5, F6, G5

| Test | Technical status | User status |
| --- | --- | --- |
| F1 | Selfcheck: cancel-on-undo-during-gesture does not consume history | Still open for user re-check (shortcuts now documented) |
| F2 | Selfcheck: second undo walks history | Still open for user re-check |
| F5 | Selfcheck + browser toolbar: redo dropped after branching edit | Ready for user re-check with Undo/Redo buttons |
| F6 | Selfcheck: `tm.redo()` refused while gesturing | Still open for user re-check |
| G5 | Selfcheck: cancel then `markSaved` never saves preview; Ctrl+S / Save button cancel first | Still open for user re-check |

Do **not** mark F1/F2/F6/G5 as user-passed in this phase.

## 9. Automatic tests

`diagram-lab/src/core/selfcheck.ts` D5b.4a block:

- Wired port drag commit (one history entry), side change, net id + port id preserved
- Undo / redo of wired port drag
- Cancel of wired port drag keeps redo
- F1 / F2 / F5 / F6 / G5 at TransactionManager + DiagramStage policy level
- Resize cancel restores baseline; no open transaction

UI integration of C3/E3 is covered by browser checks below (not by an isolated latch-only test).

Regression:

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 10. Browser checks (`http://localhost:5174/`)

Cursor’s embedded browser often has `document.hasFocus() === false`, so deferred commits cancel unless focus is stubbed for the check. Results below note that.

### C3 (synthetic pointer on `.hit` near wired port; `hasFocus` stubbed true for commit)

| Step | Result |
| --- | --- |
| Example loaded; `elementsFromPoint` near p1 | `.hit` above pin |
| pointerdown on `.hit` near p1 → drag along right side | Status `Port moved.`; pin Y changed; side `right`, t→1 |
| Undo / Redo | Restored / reapplied |
| New drag + Escape | Status `Port move cancelled.`; position restored |

### E3 (synthetic resize; pointer-capture stubbed; blur + late pointerup)

| Step | Result |
| --- | --- |
| Resize preview grew (node bbox) | Yes |
| `window` blur during gesture | Status `Gesture cancelled.`; Width/Height restored |
| Late pointerup | No stuck size |
| New resize + commit | Succeeded (`260×160`) |

**Real OS Alt-Tab** is left for user re-acceptance (not fully automated here).

### F5 (property X change + Undo/Redo buttons)

| Step | Result |
| --- | --- |
| Edit → Undo → Redo enabled | Yes |
| New edit → Redo disabled | Yes (`f5pass`) |

## 11. Changed source files

| File | Role |
| --- | --- |
| `diagram-lab/src/view/DiagramStage.vue` | C3 handoff; E3 deferred commit + `focusLossToken`; `pagehide`; Ctrl+S |
| `diagram-lab/src/core/selfcheck.ts` | D5b.4a regression block |

## 12. Remaining risks

1. Very dense port clusters: handoff picks nearest port within reach — acceptable; watch edge cases.
2. Real OS focus-loss ordering may still vary by browser; token + hasFocus + visibility triple-check covers the known race.
3. Embedded / background tabs with `hasFocus() === false` will cancel deferred commits — intended for Alt-Tab; unusual for a focused editing session.
4. F1/F2/F6/G5 still need explicit user confirmation.

## 13. Re-acceptance checklist (D5b.4a)

0/9

1. Move a wired port along the same block side.
2. Move a wired port to another side.
3. Undo/Redo that wired port drag.
4. Abort a wired port drag with Escape.
5. Still select and create wires normally.
6. Abort resize on focus loss.
7. Resize again after focus returns.
8. F5 redo branching after a new gesture / edit.
9. Open keyboard tests (F1/F2/F6/G5) as far as shortcuts allow.

## 14. Boundaries

No D5b.5 toolbar redesign. No CL/EDU implementation. No commit / push / release ZIP from this phase.
