# S5a.1 — Incremental wire drawing undo

**Status:** **Accepted** by user (26 Nov 2026 — Esc / Backspace step-undo confirmed).  
**Depends on:** S5a Port→Free double-click (accepted).  
**Not in this slice:** S5b endpoint drag, S1/S2, D5c.7, performance.

## Behaviour

While a wire draft is open (transient gesture state only):

| Input | Effect |
| --- | --- |
| Esc / Backspace / Ctrl+Z | Remove the last **drawing step** (one user click, including multi-edge orthogonal clicks) |
| Esc with only the start anchor left | Cancel the whole unfinished wire |
| Shift+Esc | Cancel the whole unfinished wire immediately |
| LMB / double-click / Enter | Unchanged (S5a) |

Outside an open draft, keyboard semantics are unchanged (global Ctrl+Z, Esc cancel for resize/port/move, etc.). Text inputs are not intercepted.

Status hint: `LMB: Add point | Double-click: Finish | Esc/Backspace: Undo point | Shift+Esc: Cancel`

## Architecture

- `WireDraft.fixedSteps` — point snapshots after each confirmed click; not written to the document.
- `undoWireStep` — pops one step; cancels when only the start remains.
- Completed wire → one `commitWire` → one global history entry (Variant A).
- No second document history; no draft junctions/nets leaked into the sheet.

## Verify

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```

## Manual acceptance

1. Wire tool → port → three bends → Esc → last bend gone; draft stays; preview from remaining tip.  
2. Esc again (and again) until start → one more Esc cancels.  
3. Backspace and Ctrl+Z while drafting match Esc step-undo.  
4. Shift+Esc cancels immediately with bends present.  
5. After step-undo, double-click free → stub; or click a port → connection.  
6. Finish a wire → one Undo removes the whole wire (global).  
7. Resize/port-drag Esc still cancels the whole gesture.  
8. Focus a name field → Esc/Backspace/Ctrl+Z do not steal text editing.
