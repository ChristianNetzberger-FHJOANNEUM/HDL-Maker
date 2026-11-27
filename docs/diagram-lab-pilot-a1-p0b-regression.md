# P0b — Acceptance and interaction regression record

**Date:** 26–27 Nov 2026  
**Related:** [diagram-lab-pilot-a1-grid-stacking-findings.md](diagram-lab-pilot-a1-grid-stacking-findings.md)

## Visual acceptance (user)

| Criterion | Result |
| --- | --- |
| Block borders not interrupted by grid | **Accepted** |
| Instance names fully visible | **Accepted** |
| Port names fully visible | **Accepted** |
| Transparent interiors still show grid | **Accepted** |
| Wire presentation unchanged | **Accepted** |
| P0 free-end tips / no always-on bend circles | **Accepted** |

## Automated

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | Pass (after P0b) |
| `npm run selfcheck` | Pass (after P0b) |

## Interaction regression

Live pan/zoom/drag/snap after P0b were **not** separately confirmed by the user at acceptance time. They are **not** marked passed.

| Criterion | Status | Notes |
| --- | --- | --- |
| Pan / zoom synchronisation | **Open** | Both SVGs share `worldStyle` from one `viewport` ref (structure only). |
| Block / wire / free-end gestures | **Open** | P0b did not change gesture code paths (structure only). |
| Snap behaviour | **Open** | Still coupled to Snap toggle until P4. |

Report any live interaction defects against the original nine-point P0b checklist; do not treat structural notes as completed acceptance.
