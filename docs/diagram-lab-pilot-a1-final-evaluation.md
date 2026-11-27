# Application Pilot A1 — Final evaluation

**Status:** **Formally closed** (27 Nov 2026).  
**Overall assessment:** Diagram-Lab is suitable for creating and editing technical block diagrams, subject to the documented remaining limitations.  
**Related:** [presentation findings](diagram-lab-pilot-a1-presentation-findings.md), [application pilots](diagram-lab-application-pilots.md), [p5a](diagram-lab-pilot-a1-p5a-label-position.md), [p5b-fix](diagram-lab-pilot-a1-p5b-remove-label.md), [D5d handoff](status-handoff-2026-11-26-d5d.md).

**Do not start A2** until a separate release. No further A1 features.

---

## 1. Original A1 objectives

Pilot A1 asked whether Diagram-Lab can produce a teaching-quality **synchronous 4-bit counter** block diagram (clk, en, rst, Q) using today’s editor — without inventing HDL or new product surfaces.

Goals:

1. Reproduce the counter connectivity and layout with stubs, junctions, named nets.  
2. Identify presentation and usability gaps from real drawing work.  
3. Drive minimal, reusable editor slices (P0–P5) rather than speculative features.  
4. Keep S5b / D5d gates independent.

---

## 2. Successful reproduction

The synchronous counter diagram was reproduced with existing Lab capabilities (blocks/symbols, ports, orthogonal wires, stubs, junctions, named nets). Connectivity was judged adequate early; presentation quality became the main workstream ([findings](diagram-lab-pilot-a1-presentation-findings.md)).

After P0–P5b the same drawing class supports:

- Clean selected-only edit chrome  
- Hideable instance / port / wire labels  
- Multiline display text with free position  
- Per-instance colours  
- Independent grid / snap / spacing preferences  
- Free 2D wire-label placement, Add / Remove / Show name labels  

---

## 3. Improvements P0–P5b (all functionally confirmed)

| Milestone | Function | Status |
| --- | --- | --- |
| P0 | Unobtrusive vertex / free-end chrome | Confirmed |
| P0b | Correct grid stacking | Confirmed |
| P1 | Visibility of instance / port / wire labels | Confirmed |
| P2 | Multiline block display text | Confirmed |
| P3 | Individual block colours | Confirmed |
| P3a | Free block-text positioning | Confirmed |
| P4 | Independent grid / snap control | Confirmed |
| P4a | Consistent wire snapping | Confirmed |
| P4b | Global editor preferences | Confirmed |
| P5a | Free wire-label positioning | Confirmed |
| P5b | Add / Remove name label (+ Show distinct from Remove) | Confirmed |

Twelve extension steps functionally confirmed. No further A1 feature freigabe.

---

## 4. P5 acceptance history (not rewritten)

### 4.1 Original P5 report (before Remove fix)

| Metric | Count |
| --- | --- |
| Passed | **7** |
| Failed | **1** |
| Not testable (by user) | **1** |

| Case | Original result |
| --- | --- |
| 1 – Block and stub movement | **PASS** |
| 2 – Resize and port drag | **PASS** |
| 3 – Duplicate with labels | **PASS** |
| 4 – Add, remove, hide label | **FAIL** |
| 5 – Net-name propagation | **PASS** |
| 6 – Undo/Redo | **PASS\*** |
| 7 – Escape / cancellation | **PASS** |
| 8 – Save/load | **PASS** |
| 9 – Legacy compatibility | **NOT TESTABLE** (by user) |

\*Remove-specific Undo/Redo pending because Remove was unavailable.

### 4.2 Retest after P5b-Fix

User confirms **Remove name label** works. Last reported P5b functional defect resolved.

| Item | Status after retest |
| --- | --- |
| Case 4 Add / Remove / Hide | **PASS** (retest) |
| Case 6 Remove Undo/Redo | Covered by retest intent + automated suite |
| Case 9 Legacy 1D offsets | **Automated** (not manually reconstructed) |
| P5a | Functionally **accepted** |
| P5b | Functionally **accepted** |

Original FAIL row remains on record above; retest is additive.

---

## 5. Final functional acceptance

| Track | Status |
| --- | --- |
| P0–P4b | Accepted / function confirmed |
| P5a | Accepted |
| P5b | Accepted (after Remove fix + user confirmation) |
| **A1 pilot** | **Formally closed** |

---

## 6. Automated regression (final verification)

Run (27 Nov 2026, closure):

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts    # selfcheck ok
npx vue-tsc --noEmit             # exit 0
```

**No blocking failures.** Documented automated coverage for P5b / legacy:

| Concern | Verification |
| --- | --- |
| Remove visible and hidden labels | Selfcheck P5b-Fix |
| Remove last visual label of a named net | Selfcheck — net name + connectivity preserved |
| Canonical net identity / name / connectivity | Selfcheck |
| Independent labels on different segments of one net | Selfcheck |
| Undo/Redo of remove (exact position + visibility) | Selfcheck |
| Save/load of absent / visible / hidden | Selfcheck |
| Legacy one-dimensional `offset` (no `shift`) | Selfcheck fixture `p5_legacy_labels` + round-trip |

### Evidence classes

| Class | Examples |
| --- | --- |
| **Confirmed by user** | P0–P5b functional use on A1 counter; Remove retest |
| **Confirmed by automation** | Full selfcheck suite; vue-tsc; P5a/P5b/legacy fixtures |
| **Remaining unverified / open (non-blocking for A1)** | Exhaustive manual legacy-document gallery; S4 Port Drag final user confirmation; live P0b interaction edge cases if any; full Undo matrix beyond suite |

---

## 7. Known limitations (not A1 blockers)

| Limitation | Notes |
| --- | --- |
| Orthogonal routing only | Free-angle wires deferred (B1-relevant) |
| No wire dash / colour / arrows | Style ADR; future |
| No bus-width marks | Graphical vs HDL-semantic — both deferred |
| No general annotation objects | Outside P5 scope |
| No SVG export in Lab | D5e |
| Symbol Designer / Library Manager | Existing palette + user JSON library only |
| Large-sheet performance | D5d independent campaign |
| S1/S2 mixed selection / wire marquee | Deferred |
| D5c.7 wire-only copy | Deferred |
| Non-rigid remapping of free label `shift` | May need manual nudge after large edits |

---

## 8. Deferred features (future; preserve classification)

| Feature | Classification |
| --- | --- |
| Graphical bus-width annotations | Future presentation / annotation |
| HDL-specific semantic bus widths | HDL / type-check — not Lab A1 |
| Configurable wire styles | ADR style layer |
| Arrowheads / endpoint markers | Style / markers |
| Free-angle routing | Geometry / routing campaign |
| General graphical annotations | Annotation framework (not started) |
| SVG export | **D5e** |
| Advanced symbol library management | CL / Library Manager — separate freigabe |

---

## 9. Architectural lessons

1. **Semantics ≠ presentation ≠ editor view state** — visibility, display text, colours, and chrome must not mutate nets.  
2. **Application pilots beat speculative specs** — A1 produced reusable editor capabilities from a real drawing.  
3. **Optional fields + dual-path drawing** preserve legacy documents (P1 flags, P5a `shift`).  
4. **Segment-scoped name labels** keep D5c.5 net identity while allowing multiple visual marks.  
5. **Hide ≠ Remove** — position retention vs instance deletion must stay distinct in UI and model.  
6. **Baseline-derived gestures + serialize-equal history** avoid drift and empty undo entries.  
7. Keep **D5d performance** and **S-series stub geometry** as separate gates from presentation polish.

---

## 10. Reusability beyond A1

Implemented slices apply to other diagram applications (A2 signal-flow, B2 teaching blocks, B3 flowcharts):

- Instance presentation (text, colour, visibility)  
- Editor preferences (grid/snap/spacing)  
- Wire-label placement and per-segment label lifecycle  
- Stub-aware editing already accepted (S3–S5b)

Domain-specific gaps (extra symbols, free angles, markers) belong to later pilots, not A1 reopen.

---

## 11. Overall pilot assessment

**Diagram-Lab is suitable for creating and editing technical block diagrams**, with the limitations in §7–§8. A1 fulfilled its purpose: a concrete drawing task drove generally useful editor functions instead of purely theoretical requirements.

**A2** (digital communication / baseband system — symbol library focus) requires a **separate release**. Do not implement new symbols or Library Manager from this closure.

---

## 12. Closure checklist

| Item | Done |
| --- | --- |
| User confirms Remove works | Yes |
| Original FAIL preserved in history | Yes |
| P5a + P5b functionally accepted | Yes |
| Final selfcheck + vue-tsc green | Yes |
| Pilots + handoff + P5 docs updated | Yes |
| No commit / push from this closure | Yes |
| A2 not started | Yes |
