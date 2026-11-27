# S5b — Free-endpoint drag (investigation)

**Status:** RCA complete; **implemented** — see [d5d0a-s5b-stub-endpoint-drag.md](d5d0a-s5b-stub-endpoint-drag.md).  
**Issue:** W2 — unstable / jumping geometry when dragging a stub’s free end.

## 1. Findings (distinct from W1)

There was **no first-class free-endpoint drag gesture** in the select tool. Free ends are hit-tested (`snapTarget` → `kind: 'end'`) but the SVG only offered:

- wire `.hit` → `onSpanDown` → `placeSpan` / `moveSpan` (orthogonal **span slide**)
- bend handles → `startBend`
- near-port handoff → port drag

### Failure modes

1. **Wrong edge on free-end grab** — `kind: 'end'` fell through to **edge 0** (port-adjacent leg).  
2. **Dogleg at the port on short stubs** — two-point stub + bound start inserted a dogleg.  
3. **Span slide ≠ 2D endpoint follow** — only one axis moved.  
4. **Not primarily a screen/world bug** — dominant defect was gesture/edge selection.

## 2. Implemented rule (S5b)

- Dedicated free-end drag; `placeFreeEnd` rebuilds only the terminal orthogonal leg from the hinge.  
- Preview from baseline; one history entry; Esc cancels.  
- Both Port→Free and Free→Port.

Details and acceptance: [d5d0a-s5b-stub-endpoint-drag.md](d5d0a-s5b-stub-endpoint-drag.md).
