# D5d.0-A — Functional correction: rigid block-attached stub translation

**Status:** Implemented for user acceptance.  
**Scope:** Block move (incl. multi-select + snap commit) only.

## Problem

`moveBlock` / `refreshSegment` pinned port endpoints while leaving free ends and intermediate points absolute. Correct for manual trunks; wrong for HDL-like Port↔Free stubs.

## Behaviour

When a block moves by Δx/Δy, every **Port↔Free** stub attached to that block (either orientation, any bend count) translates rigidly — all polyline points and the free endpoint. Segment-anchored labels follow. Net ids and names are unchanged. Spatially separate stubs that only share a net name do **not** move.

| Segment type | On block move |
| --- | --- |
| Port → Free / Free → Port | Rigid translate with the block |
| Port → Port / Port → Junction / Junction → * / Free → Free | Existing rubber-band |

Canonical path: `moveBlock` in `geometry.ts`. `snapBlocks` routes through `moveBlock` so the drag-commit snap delta also carries stubs.

## Resize / Port Drag inspection (out of this slice)

| Operation | Current behaviour | Analogous correction needed? |
| --- | --- | --- |
| **Block resize** (`setBlockFields` / `resizeBox`) | Ports move with the box; `refreshAll` rubber-bands free ends → stubs distort | **Yes** — later: translate (or re-pin rigidly) stubs by each attached port’s actual Δ, not a single block Δ when only one side grows |
| **Port drag** (`placePort`) | Port relocates; free end stays → stub stretches | **Yes** — later: rigid translate of the attached Port↔Free stub by the port’s Δ |

Not implemented here (per release scope).

## Preliminary performance observations (not quantified)

Recorded during D5d.0-A generator acceptance (stub / routed synthetic sheets), environment: local Diagram-Lab browser session.

| Size | Observation |
| --- | --- |
| ~50 blocks | Interactive block move still usable |
| >50 blocks | Block drag no longer sufficiently fluid |
| 1 000 blocks | Diagram did not load successfully |

Open questions for later D5d.0-B–D measurement (no optimisations in this slice): generation time vs validation vs DOM/SVG vs heap vs hard hang. Suggested future size matrix addition: **10 / 25 / 75** between the existing 50–100 steps.

## Verify

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```

## Manual acceptance

1. Σ → Topology C / 50 / Stubs → Generate.  
2. Drag one block: stubs + labels move with it; open ends do not stick.  
3. Drag two selected blocks: each stub follows its own block once.  
4. Esc mid-drag restores; Undo/Redo restore stub geometry.  
5. Port↔Port manual wire (Example sheet): trunk bend still stays put when a block moves sideways.
