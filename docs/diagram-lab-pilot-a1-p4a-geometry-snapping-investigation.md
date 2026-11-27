# P4a investigation — Consistent geometry snapping

**Status:** Investigation **accepted**; P4 **accepted**; P4a **implemented** — see [p4a-geometry-snapping](diagram-lab-pilot-a1-p4a-geometry-snapping.md).  
**Trigger:** User observation after P4 — block snap works; wires appear not to honour the grid.  
**Depends on:** P4 grid/snap split ([p4-grid-snap](diagram-lab-pilot-a1-p4-grid-snap.md)) **accepted**; S5b accepted ([s5b stub endpoint](d5d0a-s5b-stub-endpoint-drag.md)).  
**Related:** User policy table (blocks/ports/wires/junctions snap; port-bound ends, labels, display text do not).

---

## 1. Naming caution

| Name | Meaning |
| --- | --- |
| **Grid snap** (`snapValue` / `snapOn`) | Round coordinates to `GRID` (20) when the editor preference is on |
| **`snapTarget` (nets.ts)** | Connectivity hit-test (port / junction / free end / segment / free). **Not** grid rounding |

These are independent. P4a must not conflate them.

---

## 2. Canonical snap implementation

Central helpers live in `diagram-lab/src/core/edit.ts`:

| API | Role |
| --- | --- |
| `GRID = 20` | Spacing |
| `snapValue(value, enabled)` | Round one axis (or pass-through when disabled) |
| `borderPlacement` / `nearestBlockBorder` | Port place/preview; pointer snapped then projected to side/`t` |
| `resizeBox(..., snap)` | Moving resize edge snapped |
| `addBlock` / `placeTemplate` / `snapBlocks` | Block origins |

Call sites pass the UI `snapOn` flag (or `true` inside a finalize that already gated on `snapOn`). There is **no** second snap algorithm. Wire geometry helpers (`orthogonalTo`, `placeSpan`, `placeFreeEnd`, `moveJunction`, `commitWire`, `wireClick`) do **not** call `snapValue` themselves — snapping is applied (or not) in `DiagramStage` before/after those calls.

**Routing mode vs snap:** Orthogonal routing (`orthogonalTo` / wire draft elbow) is independent of grid snap today and should stay so. Free-angle routing (future) can reuse the same `snapValue` on free points without a separate algorithm.

---

## 3. Inventory — who snaps today?

| Operation | Grid snap when `snapOn`? | Where | Notes |
| --- | --- | --- | --- |
| Block place (template / slot) | **Yes** | `placeTemplate` / `addBlock` / `nextSymbolSlot` | |
| Block drag (Vue Flow) | **Yes** (on commit) | `onDragStop` → `snapBlocks` | Live drag may be continuous; finalize snaps origins |
| Block nudge (arrows) | **Yes** | `onNudge` → `snapValue` | |
| Block resize | **Yes** | `resizeBox(..., snapOn)` | |
| Port add / move | **Yes** (pointer) | `borderPlacement` / `nearestBlockBorder` | Resulting `t` can still yield **off-grid** world anchors if block size/origin imply it |
| Properties X/Y/W/H number inputs | **No** | Raw numbers | Bypass snap toggle |
| Free wire endpoint drag (S5b) | **Yes** | Preview + commit finalize via `snapValue` + `placeFreeEnd` | Already matches intended policy |
| Span (edge) drag | **Partial** | Live: continuous; **commit finalize** snaps one axis | Off-grid during drag; snaps when released if `snapOn` |
| Bend (vertex) drag | **No** | Preview via `placeSpan`; commit with **no** snap finalize | Primary gap vs span |
| Junction drag | **No** | `moveJunction` with raw delta | Clear gap |
| Wire tool — free click / bends | **No** | `clientToWorld` → `snapTarget` → `wireClick` / `orthogonalTo` | Free `hit.point` is unsnapped |
| Wire tool — finish stub (`finishFree` / Enter / double-click) | **No** | Free tip = raw world | Tip can sit off-grid |
| Wire tool — connect to port/junction/wire | **N/A (correct)** | Hit uses exact anchor / projected point | Connectivity overrides grid |
| Wire labels | **No** | `placeLabelAt(world)` | Intentional (policy) |
| Display text (P3a) | **No** | Integer units, not `GRID` | Intentional |
| Freehand stroke / Convert→wire | **No** | Raw stroke → `orthogonalize` | Orthogonal only; not grid-quantized |
| Duplicate / paste offset | Uses `GRID` as step | Always `GRID` multiples | Independent of `snapOn` toggle |
| Toggle Snap on | **Does not** rewrite existing geometry | — | Matches policy (no retroactive snap) |

**User observation confirmed:** blocks (and free-end drag / span *commit*) honour snap; **wire creation bends, stub finish, bend drag, and junction move** largely bypass grid snap. That produces off-grid polylines even when blocks sit on the grid.

---

## 4. Orthogonal routing and off-grid ports

- Port-bound endpoints always use `portAnchor` / resolved hit points. They must **not** be independently grid-snapped (policy + current design).
- If a port world position is off-grid (e.g. `t` mid-edge on an odd-sized symbol, or unsnapped property edits), the first/last orthogonal leg will leave that exact point. Intermediate free vertices **can** still sit on-grid.
- `orthogonalTo(from, to, prefer)` builds H/V elbows to `to` without rounding. Snapping the **free** target (or free bend) before calling it is enough for on-grid interiors; no new router required.
- Connecting two off-grid ports with snap on intermediate clicks yields: exact ports + snapped bends + orthogonal legs — expected and desirable.

---

## 5. S5b and future edge/vertex drag

| Topic | Finding |
| --- | --- |
| S5b free-end drag | **Already snaps** when `snapOn`. Accepted. P4a must **not** rework hit priority, terminal-leg rebuild, or gesture latch — only reuse the same `snapValue` pattern elsewhere. |
| S5b gate | Preserve; P4a is presentation/editing consistency, not a stub-drag fix. |
| Future edge / vertex drag | Not released. When added, apply the same rule: snap free coordinates under `snapOn`; never snap port-bound ends separately. Span already has a commit-snap pattern to copy. |
| D5d | Independent; no large-diagram work in P4a. |

---

## 6. Accepted P4a scope (conditional freigabe)

**Goal:** Extend existing `snapValue` / `GRID=20` to remaining wire ops. No second algorithm, no schema change.

### Priority of geometric constraints (binding)

1. Explicit port / junction (or other connection) hit.  
2. Existing geometric and orthogonal routing constraints.  
3. Grid snap of **freely positioned** coordinates only.

Do not independently round every wire coordinate when a port is off-grid — that risks diagonals or broken attachment. Connectivity always wins over the grid.

### In scope

| Operation | P4a action |
| --- | --- |
| Wire drawing — intermediate free bends | Snap free points after hit-test |
| Stub finish (`finishFree`) | Snap free tip |
| Bend drag | Snap (prefer **preview**, not only commit) |
| Junction drag | Snap (prefer **preview**) |
| Block / port / free-end / span | **Unchanged** |

### Gesture preview preference

Prefer snapping **during gesture preview** so release does not jump. Evaluate with existing begin/preview/commit infrastructure (free-end already does this). If a given gesture needs broader rework for live snap, document the limitation rather than expanding P4a — do **not** generalise all gestures. Span and free-end implementations stay as-is (explicit exclusions).

### Explicitly out of scope

- Wire labels; P3a display text.  
- **Freehand → Convert** (deferred deliberately; auto-quantising sketches may be undesirable).  
- Free-end drag / span drag code paths (preserve).  
- Retroactive snap on toggle; automatic geometry normalisation.  
- Per-object snap toggles; magnetic snap; alignment guides; configurable `GRID`.  
- New router / routing-mode changes; S5b hit-stack rewrite; schema; D5d; roadmap.

### Suggested call-site pattern (conceptual)

```text
world = clientToWorld(event)           // unsnapped
hit = snapTarget(doc, world)         // connectivity first
if hit.kind === 'free' && snapOn:
  hit.point = { x: snapValue(...), y: snapValue(...) }
wireClick(draft, hit) / finishFree(..., hit.point)
```

Reuse `snapValue` only — no new snap subsystem.

---

## 7. Complexity / risk

| Item | Risk |
| --- | --- |
| Free-point snap after hit-test | Low — localized UI change |
| Bend commit snap | Low — copy span finalize |
| Junction snap | Low |
| Live span/bend snap vs off-grid port hinges | Medium UX — snapped span can leave short non-grid stub legs into ports; acceptable per policy |
| Accidental S5b regression | Avoid by not touching free-end hit routing |
| Double-snap / preview vs commit drift | Keep one rule: snap whenever writing free geometry under `snapOn` |

---

## 8. Recommended sequence

| Step | Status |
| --- | --- |
| P4 — Grid vs snap controls | **Accepted** |
| **P4a — Consistent geometry snapping** | **Implemented** — await acceptance ([release](diagram-lab-pilot-a1-p4a-geometry-snapping.md)) |
| A1 final pilot evaluation | After P4a accept |
| A2 communication system pilot | After A1 close-out |

---

## 9. Stop

Superseded by the P4a release note.
