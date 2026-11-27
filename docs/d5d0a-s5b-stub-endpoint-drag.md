# S5b — Stable free-endpoint drag

**Status:** **Accepted** by user (26 Nov 2026 — free-endpoint drag works).  
**Released:** 26 Nov 2026 (after S5a / S5a.1 and pilot-prep acceptance).  
**RCA:** [d5d0a-s5b-endpoint-drag-investigation.md](d5d0a-s5b-endpoint-drag-investigation.md).

## Behaviour

Dragging a free wire tip (Port↔Free or Free↔Port):

- Tip follows the pointer in diagram coordinates (grid snap when enabled).
- Only the **terminal orthogonal leg** is rebuilt from the adjacent hinge; earlier bends stay when compatible.
- Attached port / junction does not move; net id/name unchanged.
- Preview each frame from gesture baseline; one history entry on commit; Esc restores baseline.
- Free-end handles (`.free-end`) plus `snapTarget` / proximity on the wire hit stroke.

**Routing rule:** Keep all points except the free tip. From the hinge, `orthogonalTo(hinge, tip, prefer)` where `prefer` matches the previous terminal leg’s dominant axis. Not a general auto-router.

## Out of scope

Edge drag / vertex drag enhancements, free-angle routing, wire styles, vertex-handle presentation (“S5a.2” — not an open milestone; deferred).

## Verify

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```

## Manual acceptance

1. Σ or place a block → Port→Free stub → drag the open tip (handle or near tip on the wire): smooth follow, no jump at the port.  
2. Multi-bend stub: interior corner stays; only last leg adjusts.  
3. Free→Port stub: drag the free start tip; port stays.  
4. Zoom 50% / 100% / 200% and pan; tip still tracks. Snap on/off.  
5. Esc mid-drag restores; Undo/Redo after commit; save/reload.  
6. Labels on the stub remain attached.

## Next

User acceptance of S5b → close S4 Port Drag if still open → manual pilots A1→A2→B2→B3→B1 → D5d when released.
