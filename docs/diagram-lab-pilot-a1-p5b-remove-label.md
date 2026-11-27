# P5b-Fix — Remove name label

**Status:** **Accepted** (27 Nov 2026) — user confirms Remove name label works; A1 formally closed.  
**Depends on:** P5a functionally accepted; P5 acceptance report (27 Nov 2026).  
**Related:** [p5a-label-position](diagram-lab-pilot-a1-p5a-label-position.md), [p5 investigation](diagram-lab-pilot-a1-p5-wire-label-investigation.md), [final evaluation](diagram-lab-pilot-a1-final-evaluation.md).

---

## 1. Acceptance context

P5a free positioning: **functionally accepted**.

Original case 4 (Add / Remove / Hide): **FAIL** — remove action missing or undiscoverable.

| Root cause | Finding |
| --- | --- |
| Canonical remove API | **Missing** — labels were only dropped with segment delete |
| Hide vs remove | Hide existed (`setSegmentLabelsVisible` / P1); conflated with remove in the UI story |
| Properties panel | Only **Add label** + **Show wire label** + Reset; no Remove |

---

## 2. Correction

Added `removeSegmentNameLabels(doc, segmentId)` in `nets.ts`.

Wire Properties (selected segment):

| Segment state | Controls |
| --- | --- |
| No name label | **Add name label** |
| Has name label (visible or hidden) | **Show label**, **Remove name label**, **Reset label position** |

Three distinct states:

| State | Instance | Visible |
| --- | --- | --- |
| No label | No | — |
| Visible | Yes | Yes |
| Hidden | Yes | No |

Remove deletes the visual name-label instance(s) on **that segment only**. It does not delete the segment, rename/remove the net, change geometry, or touch other segments’ labels. D5c.5 identity unchanged. Re-add uses the canonical net name and default placement (`offset = 14`).

---

## 3. History and persistence

- One history entry per effective Add / Remove (session serialize equality).
- Undo of Remove restores exact prior position and visibility.
- Hide/Show preserve position.
- Save/load preserves absent / visible / hidden.
- P5a `shift` positioning unchanged.

---

## 4. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/core/nets.ts` | `removeSegmentNameLabels`, `isNameLabel` |
| `diagram-lab/src/view/DiagramStage.vue` | Properties Add / Show / Remove / Reset UX |
| `diagram-lab/src/core/selfcheck.ts` | P5b-Fix + legacy 1D fixture |
| Docs | This file; P5a status; final evaluation; pilots; handoff |

---

## 5. Automated verification

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```

Coverage: add/remove; remove while hidden; last label of a named net; independent labels on two segments of one net; net id/name/connectivity preserved; undo/redo position+visibility; save/load of three states; **legacy pre-P5 JSON fixture** (offset only, no `shift`) exact placement + round-trip.

---

## 6. Manual retest

**Passed** (user confirmation, 27 Nov 2026): Remove name label works; last reported P5b defect resolved. Original case-4 FAIL remains recorded in [final evaluation](diagram-lab-pilot-a1-final-evaluation.md); retest is additive.

---

## 7. Closure

P5a + P5b functionally accepted. A1 formally closed — see [final evaluation](diagram-lab-pilot-a1-final-evaluation.md). No further A1 features. A2 requires a separate release.
