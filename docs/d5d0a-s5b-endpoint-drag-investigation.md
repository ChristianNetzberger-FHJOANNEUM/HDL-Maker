# S5b — Free-endpoint drag (investigation only; not implemented)

**Status:** Root-cause analysis recorded. **Do not implement** until S5a is accepted and S5b is explicitly released.  
**Issue:** W2 — unstable / jumping geometry when dragging a stub’s free end.

## 1. Findings (distinct from W1)

There is **no first-class free-endpoint drag gesture** in the select tool. Free ends are hit-tested (`snapTarget` → `kind: 'end'`) but the SVG only offers:

- wire `.hit` → `onSpanDown` → `placeSpan` / `moveSpan` (orthogonal **span slide**)
- bend handles → `startBend`
- near-port handoff → port drag

### Failure modes

1. **Wrong edge on free-end grab**  
   `onSpanDown` sets  
   `edge = hit.kind === 'segment' && hit.segmentId === segmentId ? hit.edge : 0`.  
   A hit of kind `'end'` therefore falls through to **edge 0**. On a Port→Free stub that is the **port-adjacent** leg, not the free tip.

2. **Dogleg at the port on short stubs**  
   For a two-point stub, edge 0 is also the terminal edge. `moveSpan` treats a bound start specially and **inserts a dogleg** at the port while shifting the free end — perceived as an uncontrolled jump.

3. **Span slide ≠ 2D endpoint follow**  
   Even when the last edge is selected correctly, `placeSpan` moves only the perpendicular coordinate of that span. The pointer’s other axis is ignored; bends further upstream can be rewritten by `simplifyOrthogonal`.

4. **Not primarily a screen/world bug**  
   `clientToWorld` uses viewport pan/zoom consistently with other gestures. Zoom/pan remain to be re-verified under S5b acceptance, but the dominant defect is **gesture/edge selection and span semantics**, not a mixed coordinate system.

## 2. Proposed S5b rule (for implementation after release)

- Hit a free endpoint (`kind: 'end'`) → dedicated endpoint drag owned until up/Esc.  
- Preview each frame from the **gesture baseline** + current world pointer (grid snap when enabled).  
- Adjust only the **terminal leg** (and the free endpoint record); preserve earlier manual bends when compatible with existing orthogonal rules.  
- One completed drag → one history entry; Esc restores baseline.  
- Support Port→Free and Free→Port; do not move the attached port; do not change net identity.

If orthogonality vs. preserving every bend conflicts, document the chosen rule in the S5b implementation note before changing behaviour.

## 3. Out of scope until release

No code changes for S5b in the S5a slice. No general auto-router. No automatic stub rotation.
