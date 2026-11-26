# S5a — Port-originated stub drawing

**Status:** Implemented — **double-click Port→Free stub accepted** by user (26 Nov 2026). Remaining S5a checklist items may still be confirmed; S5b not started.  
**Depends on:** D5c.5 stub finish; S4 still pending full acceptance (resize accepted).  
**Not in this slice:** S5b endpoint drag, S1/S2, D5c.7, performance work.

## 1. Root cause (W1)

Port→Free finish was already intended in D5c.5 (`finishFree` on LMB double-click / Enter). Two defects blocked it:

1. **`PointerEvent.detail` is always `0` on `pointerdown`** (Chromium/Edge). The stage only listened to `pointerdown` and required `event.detail >= 2`, so double-click **never** finished the stub — each click only added a bend (status stayed “Bend added…”).
2. Even with a working click count, the companion first click of a double-click would extend the draft before finish, risking extra knicks / near-zero terminal legs.

Free→Port was unaffected (single click on a port commits). Enter still worked as a workaround.

## 2. Fix

| Piece | Change |
| --- | --- |
| `isDoublePress` (interactionPolicy) | Client-space time/distance double-press (do not use `PointerEvent.detail`) |
| DiagramStage wire `pointerdown` | Second free press within 500 ms / 8 px → `finishWireStubAt` |
| `@dblclick` on world SVG | Backup finish if timing missed |
| `WireDraft.pointsBeforeFreeBend` | Checkpoint before each free bend; discarded on double-press finish |
| `finishFree(..., { fromBeforeLastFreeBend: true })` | Routes once from the checkpoint to the finish point |
| Enter | Unchanged — finishes from current `points` |
| Free→Port / Port→Port / Port→Junction | Unchanged |

One double-click → one `commitWire` → one history entry. Escape still drops the draft with no write.

## 3. Behaviour matrix

| Zeichenoperation | Ergebnis |
| --- | --- |
| Port → Port | Normale Verbindung |
| Port → freie Fläche, Doppelklick | Stub (Port→Free), ohne Begleit-Knick |
| Freie Fläche → Port | Stub (Free→Port), bisheriger Ablauf |
| Port → Junction | Verbindung zu bestehendem Netz |
| Esc während Zeichnen | Vollständiger Abbruch |

## 4. Verify

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```

Selfcheck covers: straight Port→Free, multi-bend Port→Free, Free→Port, double-click checkpoint, no degenerate terminals, Escape, Undo/Redo, D5c.5 naming/join, save/load, subsequent stub move/resize/copy.

## 5. Manual acceptance

1. Wire tool → click a **port** → move → **double-click** empty space → one Port→Free stub, no tiny terminal knick.  
2. Port → click one bend → double-click free → stub keeps the intentional corner.  
3. Free space → port still creates Free→Port.  
4. Port→Port and Port→Junction unchanged.  
5. Esc mid-draw writes nothing; Undo/Redo of a finished stub works.  
6. Named port (`clk`) stub joins existing `clk` net.

## 6. Next

**S5a.1** incremental drawing undo follows (`d5d0a-s5a1-wire-drawing-undo.md`). **S5b** only after explicit release. S4 Port Drag confirmation remains open.
