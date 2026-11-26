# D5b.4 — Interactive gesture transaction robustness

D5b.3 is fully accepted by the user (tests A–C). This note records D5b.4: reliable begin/preview/commit/cancel for existing document gestures on the shared `TransactionManager`. User acceptance of D5b.4 was **partial** (29/37; failures C3 and E3). Correction phase **D5b.4a** is documented in [d5b4a-gesture-robustness-fixes.md](d5b4a-gesture-robustness-fixes.md). D5b.5–D5b.6 stay locked until D5b.4a is accepted.

## 1. Status

| Item | Status |
| --- | --- |
| D5b.3 | Accepted by the user |
| D5b.4 | Partial acceptance (29/37); see user matrix in D5b.4a doc |
| D5b.4a | Implemented; waiting for user re-acceptance |
| D5b.5–D5b.6 | Locked |

No new undo architecture. No dual history. Snapshot strategy unchanged. No new editor features.

## 2. Cutover context

D5b.3 already routes project-mode `edits().begin/preview/commit/cancel` through the manager. D5b.4 hardens the **UI lifecycle** around those calls: Escape, blur, visibility, pointercancel, lostpointercapture, Undo/Redo/Save/navigation races, and idempotent close.

## 3. Gesture inventory

| Gesture | Entry | Events | Begin | Preview | Commit | Cancel | Capture | Objects | Risks | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Block drag | `onDragStart/Drag/Stop` (Vue Flow) | node-drag-* | `beginDocumentGesture` | `moveBlock` per move | snap + commit | Escape/blur/undo/nav/save; cancelled flag on stop | Vue Flow internal | block x/y, wire geometry | Late drag-stop after cancel | selfcheck + browser (Escape/undo patterns) |
| Block resize | `onResizeStart/Move/End/Cancel` + `BlockNode` handles | pointer* on handle + window | begin | `resizeBox` / `setBlockFields` | commit if size changed | Escape, pointercancel, lostcapture, blur, undo | Handle `setPointerCapture` + window listeners | width/height/x/y, wire ends | Double end from handle + window | browser Escape/blur; selfcheck |
| Port drag | `onPortDown/Move/End/Cancel` | pointer* | begin | `placePort` | commit if side/t changed | same interrupt table | optional capture + window | port side/t/placed, wire anchors | Side change mid-gesture | selfcheck topology cancel |
| Bend drag | `startBend` + stage pointer move/up | pointer* on bend | begin | `placeSpan` | commit | Escape/blur/cancel/lostcapture | element capture | segment points | Late lostcapture | selfcheck latch |
| Span drag | `onSpanDown` | pointer* on hit polyline | begin | `placeSpan` | snap + commit | same | element capture | segment points | — | selfcheck |
| Junction drag | `onJunctionDown` | pointer* | begin | `moveJunction` | commit | same | element capture | junction x/y | — | selfcheck |
| Wire tool draft | `wireDraft` UI only | clicks | n/a (not TM gesture) | preview polyline | `acceptWire` → `execute` | Escape clears draft | — | nets on accept only | Draft must not persist | Escape path |
| Freehand stroke | `drawing` then `execute` | pointer | n/a until up | UI points | `addStroke` execute | pointercancel clears drawing | capture on down | strokes | — | cancel path |
| Symbol editor gestures | SymbolEditor events | — | `edits().begin` | preview | commit | cancel / abandon | — | symbol shapes | unchanged | existing |
| Marquee | selection only | — | none | none | none | — | — | selection | not a document gesture | — |

No new gestures were added.

## 4. Lifecycle

```
IDLE → BEGIN → ACTIVE/PREVIEW → COMMIT | CANCEL → IDLE
```

Helpers in `DiagramStage.vue`:

- `beginDocumentGesture()` — resets `GestureCloseLatch`, calls `edits().begin()`
- `commitDocumentGesture(finalize?)` — first close wins; records ≤1 history entry
- `cancelActiveDocumentGesture(message?)` — restores baseline; clears UI drag state
- `gestureLatch` (`gestureGuard.ts`) — blocks duplicate commit/cancel from late pointer events

Policy table (pure, tested): `diagram-lab/src/view/gestureGuard.ts`.

`transaction.ts` stays free of DOM / pointer APIs.

## 5. Interrupt semantics (binding)

| Event | Action |
| --- | --- |
| Normal pointerup | Commit |
| Escape | Cancel |
| pointercancel | Cancel |
| Unexpected lostpointercapture | Cancel (ignored when latch already closing after commit) |
| Pointer leaves editor with capture | Continue |
| Window blur / document hidden | Cancel |
| Hierarchy navigation | Cancel, then navigate (history-neutral) |
| Undo | Cancel only — no history undo step |
| Redo | Refuse — gesture and redo stack unchanged |
| Save | Cancel, then save committed state only |
| New / Load project | Cancel before replace (`releaseGesture` / `openInstalled`) |
| Concurrent command (`execute` / `applyProject`) | Cancel, then one new transaction |

## 6. Dirty state

- Live preview mutates the project → `isDirty` may become true during the gesture.
- Cancel restores the baseline fingerprint → previous dirty/clean state returns.
- Save cancels first so a preview is never marked saved.
- No-op commit (return to baseline content) adds no history entry and does not clear redo.

## 7. Automatic tests

`selfcheck.ts` D5b.4 block:

- Interrupt policy + latch idempotency
- Many previews → one commit
- Cancel keeps redo
- No-op return to baseline
- Commit drops redo
- Double commit/cancel
- Late preview refused
- UI-style undo = cancel without consuming history
- Manager redo refuses while gesturing
- Save-cancel restores clean
- Edit after abort
- Wired move cancel restores full project JSON

Regression:

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 8. Browser checks (`http://localhost:5174/`)

Executed:

| Check | Result |
| --- | --- |
| New project + place Generic block | OK |
| Resize preview then Escape | Width restored; status `Resize cancelled.` |
| Property resize + Undo/Redo | History steps work |
| Undo during active resize | Status `Gesture cancelled.`; size restored; history not consumed |
| Blur during active resize | Status `Gesture cancelled.` |

Not exhaustively exercised in this pass (document explicitly):

- Long Vue Flow block drag with one Undo step (automation limited; path shares the same begin/commit/cancel helpers)
- Port drag to another side / wired port / Boundary port & Boundary resize under pointer automation
- Pointer-up outside the editor with capture (window listeners + capture designed for it; not separately timed in browser)
- Full hierarchy Undo/Redo after gesture cancel (covered by D5b.3 acceptance + selfcheck)

## 9. Performance

Preview still mutates in place (Variant A). No per-move `serializeProject` except the baseline at `begin` and compare at `commit`. No systematic optimisation (D5d). No anomalous full restores observed beyond cancel/commit.

## 10. Remaining risks

1. Vue Flow drag-stop after Escape relies on the cancelled flag / latch — keep watching for edge cases.
2. Property-panel width/height are separate `execute` transactions (not one gesture) — intentional; not a drag.
3. Toolbar/shortcut polish remains D5b.5.
4. Deep pointer-up-outside and multi-block drag acceptance still valuable in D5b.6.
5. **Superseded by D5b.4a:** C3 (wired port vs wire hit overlay) and E3 (resize commit racing ahead of blur) — see [d5b4a-gesture-robustness-fixes.md](d5b4a-gesture-robustness-fixes.md).

## 11. Boundaries

No schema / libs / EditableDiagram / Vue Flow upgrade / HDL / router / commit / push / ZIP.

## 12. Follow-up

D5b.4a corrects C3 and E3, documents shortcuts and D4=N/A, and secures F1/F2/F5/F6/G5 at the integration-test level. Re-acceptance checklist is in the D5b.4a note.
