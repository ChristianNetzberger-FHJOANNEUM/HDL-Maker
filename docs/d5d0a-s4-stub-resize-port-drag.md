# S4 — Stub follow on Resize / Port Drag

**Status:** Implemented — **Block Resize accepted** by user (26 Nov 2026: stubs + labels follow correctly). Port Drag still pending explicit confirmation.  
**Depends on:** Stub-move + S3 accepted.  
**Not in this slice:** S1/S2, D5c.7, performance work.

## Behaviour

For every port whose world position changes, attached Port↔Free stubs translate by that port’s actual Δ:

\[
q_i' = q_i + (p_{\mathrm{new}} - p_{\mathrm{old}})
\]

| Operation | Effect |
| --- | --- |
| **Block resize** (`setBlockFields` geometry) | Each stub follows **its** port Δ (e.g. east grow moves right stubs; left stubs stay if Δ=0) |
| **Port drag** (`placePort`) | Only stubs of the moved port translate |
| Block move | Unchanged semantically; now uses the **same** per-port Δ helper |

Preserved: stub length/shape, free ends, labels (segment anchors), net ids/names. Unrelated same-name stubs stay put. Port↔Port / junction segments keep existing rubber-band `refreshAll`.

### Port side changes

`placePort` may change `side`. S4 **only translates** by the port’s position Δ — it does **not** rotate or re-route the stub to face the new side. If a stub looks inverted after a side change, that is a known residual; report in acceptance rather than adding auto-routing here.

## Architecture

Shared Core helpers in `geometry.ts`:

- `capturePortAnchors` / `portAnchorDeltas`
- `translateAttachedStubsByPortDeltas` / `isPortAttachedStub` / `translateSegmentGeometry`

Used by `moveBlock`, `setBlockFields`, and `placePort`. One history entry per completed gesture; preview from baseline.

## Verify

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```

## Manual acceptance

1. Σ → C/50/Stubs → Generate.  
2. Resize a block from the **east** handle: right stubs move with the edge; left stubs stay.  
3. Resize **height**: side-port stubs shift by height·t.  
4. Drag one port: only that port’s stubs move; neighbours stay.  
5. Esc mid-resize / mid-port-drag restores; Undo/Redo OK.  
6. Port↔Port trunk still rubber-bands (bend not rigidly dragged with block width alone in the expected way).  
7. Optional: drag a port to another **side** — note stub orientation (no auto-rotate).

## Next

Complete Port Drag confirmation for full S4 close. Then S5a acceptance → S5b (after release) → D5d.0 performance. S1/S2 remain deferred.
