# D5b.5b — Wire draft survives pan (MMB / Space)

D5b.5a is accepted. This slice lets the user pan while a wire ghost draft is open. Full D5b.5 toolbar polish and D5b.6 stay locked. CL/EDU remain planning-only.

## 1. Status

| Item | Status |
| --- | --- |
| D5b.5a | Accepted by the user |
| D5b.5b | Accepted by the user |
| D5b.5 / D5b.6 | Locked |

## 2. Cause

With Wire / Port / Freehand active, `.world.drawing` sets `pointer-events: auto` over Vue Flow. Middle-click never reached `pan-on-drag`, so users could not pan during an open wire draft. LMB Space-pan had the same overlay problem in wire mode.

## 3. Behaviour

| Input during open wire draft | Result |
| --- | --- |
| Middle-click + drag | Viewport pan; draft stays; ghost follows in world space |
| Middle-click release | Draft still active |
| Space hold + LMB drag | Viewport pan; draft stays; no elbow change |
| Space tap (no pan) | Elbow toggle (previous Space behaviour, on keyup) |
| LMB on valid target | Commit as before |
| Escape / tool toggle away from Wire | Cancel draft (unchanged) |

Pan is viewport-only. It does not create a history entry and does not call `TransactionManager`.

## 4. Implementation

- Local `viewPan` on the world SVG for MMB and Space+LMB (`shouldBeginViewPan`).
- `FlowBridge.setViewport` keeps Vue Flow nodes in sync with the SVG world transform.
- `lastPointerClient` + `refreshWireHoverFromClient` after pan / viewport change so the ghost stays under the cursor in world coordinates.
- `lostpointercapture` after view-pan does **not** clear the wire draft.
- Tool toggle away from Wire still clears the draft (`chooseEditorTool`).

## 5. Files

| File | Role |
| --- | --- |
| `diagram-lab/src/view/DiagramStage.vue` | View-pan over draft; Space elbow-on-keyup |
| `diagram-lab/src/view/FlowBridge.vue` | `setViewport` expose |
| `diagram-lab/src/view/interactionPolicy.ts` | `shouldBeginViewPan`, `spaceReleaseAction` |
| `diagram-lab/src/core/selfcheck.ts` | D5b.5b policy checks |

## 6. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 7. User acceptance

Accepted by the user (26 Nov 2026): open wire draft + MMB pan works; draft remains; ghost stays live; commit after pan succeeds.

## 8. Re-acceptance checklist (historical)

8/8 (user-confirmed)

1. Open wire draft + MMB pan → draft remains; ghost live; then commit.
2. After pan: invalid target / Escape → cancel; no stuck draft.
3. Several pan gestures during one draft.
4. Space tap → elbow; Space+drag → pan without elbow flip.
5. Select / Marquee / MMB pan without draft unchanged (D5b.5a).
6. Wire sticky / toggle → Select unchanged.
7. D5b.4a smoke: wired port, Escape, resize focus-loss, undo-during-gesture.
8. Selfcheck + vue-tsc green.

## 9. Boundaries

No D5b.5 toolbar redesign. No D5b.6. No CL/EDU. No commit / push / ZIP from this phase.
