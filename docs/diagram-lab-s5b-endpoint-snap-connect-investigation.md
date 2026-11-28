# S5b — Free endpoint snap & connect (read-only investigation)

**Status:** Investigation **accepted** (28 Nov 2026); **M1 closed** (no auto cross-net merge). **S5b.2 freigabe** — see [implementation spec](d5d0a-s5b2-endpoint-snap-connect.md). **Code gated** until P5c + P5c-DEL manual acceptance.  
**User finding:** During P5c manual acceptance — extending a **Port↔Free** stub by dragging its free tip onto an **unwired port** should complete a **Port↔Port** connection on the **same segment**, without drawing a second wire (HDL Designer–class behaviour; comparable to Altium / draw.io endpoint snapping).

**Related:** [S5b stable free-end drag](d5d0a-s5b-stub-endpoint-drag.md) (accepted), [S5b RCA](d5d0a-s5b-endpoint-drag-investigation.md), [Unique Net Naming](diagram-lab-unique-net-naming.md), [P5c-DEL investigation](diagram-lab-p5c-wire-deletion-investigation.md) (fix landed; DEL manual pending).

**Gates preserved:** P5c semantics, P5c-DEL, and **P5d Generic Circle** remain gated on their existing acceptance; this doc does not change code.

---

## 1. Executive summary

| Area | Finding |
| --- | --- |
| **S5b.1 (move free tip)** | **Shipped & accepted** — `placeFreeEnd` + `freeEndDrag` gesture; geometry-only; net id/name/segment id preserved. |
| **S5b.2 (snap free tip → port)** | **Not implemented** — free-end drag **never** calls `snapTarget`; release always leaves `kind: 'free'`. |
| **Canonical bind API** | **`reconnectEnd`** in `nets.ts` already performs logical **Free → Port** (or junction/segment) binding with `probeWire` net rules — **not wired to UI**, **no selfcheck**. |
| **Wire-tool parity** | **`wireHoverFromWorld` + `snapTarget`** already separate **port snap** from **grid snap** while drawing; pattern is reusable for select-tool free-end drag. |
| **Implementation size** | **Small–medium UI glue** + one composed core helper; **not** a second `commitWire` path. |

**Recommendation:** **S5b.2** after P5c-DEL manual sign-off; **P5d** after S5b.2 acceptance — [ordered spec](d5d0a-s5b2-endpoint-snap-connect.md#8-development-order-user-28-nov-2026).

---

## 2. Current behaviour vs target (operation A)

### Target interaction (user)

1. Select tool → grab **free end** (handle or tip hit).
2. Drag toward target port; **highlight** eligible port within snap reach.
3. **Preview** adjusted orthogonal geometry (existing stub leg rules).
4. **Release** on port → **same `segmentId`**, endpoint `free` → `port`, stub net identity unchanged for unwired target port.
5. **Esc** → baseline restore (existing gesture).
6. Port snap **independent of grid snap** (off-grid / P5d circle ports).

### Observed today

```4040:4047:diagram-lab/src/view/DiagramStage.vue
  if (freeEndDrag) {
    const dragState = freeEndDrag
    const at = {
      x: snapValue(point.x, activeSnapEnabled(), activeSnapSpacing()),
      y: snapValue(point.y, activeSnapEnabled(), activeSnapSpacing()),
    }
    edits().preview((draft) => placeFreeEnd(draft, dragState.segmentId, dragState.which, at))
```

```4101:4123:diagram-lab/src/view/DiagramStage.vue
  if (freeEndDrag) {
    ...
    commitDocumentGesture((draft) => {
      if (!activeSnapEnabled()) return
      ...
      placeFreeEnd(draft, dragState.segmentId, dragState.which, { ... grid snap only ... })
    })
    status.value = 'Free end moved.'
```

- Pointer position → **grid snap only** → `placeFreeEnd`.
- **No** `snapTarget`, **no** port highlight, **no** endpoint kind change.
- User must use **Wire tool** and draw an **additional** segment/port hit chain to reach Port↔Port.

### Comparison: wire tool (reference pattern)

```1587:1591:diagram-lab/src/view/DiagramStage.vue
function wireHoverFromWorld(world: Point): Point {
  const hit = snapTarget(doc.value, world)
  if (hit.kind === 'free' || hit.kind === 'ambiguous') return gridSnapPoint(world)
  return { ...hit.point }
}
```

Connectivity hits (port, junction, segment, end) keep **exact anchor**; only free space uses grid. **Same split should apply to free-end drag preview.**

---

## 3. Code inventory — affected and reusable pieces

### 3.1 Gesture & history (reuse as-is)

| Piece | Role |
| --- | --- |
| `startFreeEnd` | Clears block selection; `focusSegmentSelection`; begins `EditSession` gesture. |
| `freeEndDrag` | Pointer capture on free-end handle. |
| `edits().preview` / `commitDocumentGesture` | Baseline snapshot; one history entry on commit; Esc via `cancelActiveDocumentGesture`. |
| P5c-DEL `focusSegmentSelection` | Orthogonal selection with port — unchanged requirement for S5b.2. |

### 3.2 Geometry (reuse / compose)

| Function | File | Role for S5b.2 |
| --- | --- | --- |
| **`placeFreeEnd`** | `nets.ts` | Rebuild **terminal orthogonal leg** toward target point; keeps segment id + net id; documented S5b rule. |
| **`refreshSegment`** | `geometry.ts` | After logical bind, **pins** first/last polyline vertex to port anchor; may insert **one elbow** via `pinTerminal` if needed. |
| **`snapTarget`** | `nets.ts` | Ranked hits: port (0) &lt; junction (1) &lt; free end (2) &lt; segment (3); `SNAP = 14` world units. |
| **`portNearWorld`** | `DiagramStage.vue` | Zoom-scaled port pick (used for wire/port handoff on `onSpanDown`); **different** tolerance model than `snapTarget`. |
| **`portAnchor`** | `geometry.ts` | Authoritative port coordinates (guided ellipse-ready). |

**Note:** For port connect, preview should call `placeFreeEnd(..., portAnchor)` **before** binding so the last leg aims at the port; `reconnectEnd` alone only flips metadata then `refreshSegment` pins terminals — it does **not** run the S5b terminal-leg rebuild.

### 3.3 Logical connection (reuse — extend lightly)

```655:672:diagram-lab/src/core/nets.ts
export function reconnectEnd(doc: DiagramDocument, segmentId: string, which: 'start' | 'end', hit: SnapHit): WireResult {
  ...
  const probe = probeWire(doc, which === 'start' ? hit : otherHit, which === 'end' ? hit : otherHit)
  if (!probe.ok) return probe
  if (probe.netId && probe.netId !== segment.netId && netsTouching(doc, hit).length > 0) {
    return { ok: false, reason: 'Two nets meet. Merge them explicitly.', netIds: [segment.netId, probe.netId] }
  }
  const resolved = resolveHit(doc, hit)
  ...
  if (which === 'start') segment.start = resolved.endpoint
  else segment.end = resolved.endpoint
  refreshSegment(doc, segment)
  return { ok: true, netId: segment.netId, segmentId, createdNet: false }
}
```

| Property | On unwired target port |
| --- | --- |
| `segmentId` | Unchanged |
| `netId` / net name | Unchanged (stub net) |
| Labels on segment | Unchanged (no reanchor unless point count changes) |
| `arrowheads` segment override | Preserved on segment object |
| Automatic arrows | Recomputed from canonical net analysis after commit (P5c) |

**Call sites:** **none** outside `nets.ts`. **No selfcheck** today — highest-risk gap for S5b.2.

**Not used for S5b.2:** `commitWire` (creates **new** segment except `extendSegment` wire-tool branch). Operation A must **not** call `commitWire` for port landing.

### 3.4 Hit test constants

| Mechanism | Tolerance | Grid-dependent? |
| --- | --- | --- |
| `snapTarget` / `SNAP` | 14 px world | No |
| `portNearWorld` | `max(12, 16/zoom)` | Yes (screen-consistent) |
| `freeEndNear` on wire body | `max(10, 14/zoom)` | Yes |

**Open UX decision:** Use **`snapTarget`** (wire-tool consistent) vs **zoom-scaled `portNearWorld`** for free-end drag. Recommendation: **`snapTarget` for snap + optional zoom-scaled highlight ring** so off-grid ports work with grid off.

### 3.5 Visual feedback (gap)

- Wire drawing: rubber band snaps to port position; **no dedicated “hot port” chrome** beyond preview polyline endpoint.
- Port placement tool: `portPreview` circle on block edge only.
- **S5b.2 needs:** transient `connectSnapPortId` (or reuse wire draft hover) — highlight target port during free-end drag.

---

## 4. Semantic behaviour matrix

Rules below assume **`reconnectEnd` + prior `placeFreeEnd` to port anchor** on success path.

| Release target | Expected product behaviour | Engine today |
| --- | --- | --- |
| Free canvas | Stub stays **Port↔Free**; tip at release point (grid snap optional on free only) | **Works** (`placeFreeEnd` only) |
| **Unwired port** | **Port↔Port** on same segment; **same net id/name**; labels/arrows on segment preserved | **`reconnectEnd` supports** (probe single net) |
| Port already on **same net** (another segment) | Geometric tie-in; still one net id on stub segment | **`probeWire` ok** if both ends resolve to nets `{stubNet}` or shared topology — typical fan-in case ok |
| Port on **different net** | User asked: **explicit merge** per existing rules | **`probeWire` refuses** *“Two nets meet. Merge them explicitly.”* — **no auto-merge** |
| Same port as fixed end of stub | Invalid (zero-length / nonsense) | **`probeWire`**: *“That wire has no length.”* if hits coincide |
| Junction / segment body | Future **S5b.4** (C) | **`resolveHit`** can create junction / split — **out of scope A**; should **not** fire accidentally during A |
| Ambiguous overlap | Refuse | **`probeWire`** ambiguous |
| Esc mid-drag | Baseline restored | **Works** (S5b selfcheck) |

### Unique Net Naming alignment

- **No** `createIndependentNet` on successful stub extension to unwired port.
- **No** join-by-port-name on connect (distinct from legacy `commitWire` draw path — stubs already have a net).
- Cross-net: either require **`mergeNets(keep, drop)`** before/at connect (like inspector **Merge** / `mergeFrom` flow on `onSpanDown`) or keep refuse + user merge — see §6.

### Wired-port protection

Connecting **onto** a port that already has wires is **allowed** electrically (fan-in); `classifyPortDelete` protection is unrelated. Refusal cases are **net-id conflicts**, not “port already wired”.

---

## 5. Geometry & interaction details

### Both orientations

Selfcheck covers **Port→Free** (`which: 'end'`) and **Free→Port** (`which: 'start'`). S5b.2 must pass **`reconnectEnd` for both**.

### Multi-bend stubs

`placeFreeEnd` retains interior hinges; only terminal leg changes — verified in S5b selfcheck. Port snap preview should use **same** function toward `portAnchor`, not full reroute.

### `refreshSegment` after bind

Manual segments: pin start/end vertices to port anchors; optional elbow insert at port — same as after block move / port drag. **No autorouter.**

### Off-grid / P5d ports

`portAnchor` is world truth; `snapTarget` uses geometric distance — **grid off** must still snap release to port when within `SNAP`. Preview target = **`hit.point` from port hit**, not `snapValue(...)`.

### Commit ordering (proposed minimal core)

```text
connectFreeEnd(doc, segmentId, which, worldPoint):
  hit = snapTarget(doc, worldPoint)  // or stricter port-only filter for release
  if hit.kind !== 'port': return placeFreeEnd only (existing S5b.1)
  if hit.portId === fixedPortOnOtherEnd(segment): refuse
  placeFreeEnd(doc, segmentId, which, hit.point)
  return reconnectEnd(doc, segmentId, which, hit)
```

Optional façade in `nets.ts` keeps `DiagramStage.vue` thin and enables selfcheck.

---

## 6. Decisions

### M1 — Cross-net (**closed 28 Nov 2026**)

**Conservative:** refuse connection; show existing explicit-merge message; **restore gesture baseline** on release over rejected port (no unbound tip left on port). Matches current `reconnectEnd` / `probeWire`. **No** automatic net merge during drag.

**Future:** optional “Merge connected nets?” confirm dialog (rename/merge UX) — **not** S5b.2; note impact on spatially separated stubs on both nets.

| ID | Decision |
| --- | --- |
| **M2** | Default **(a)** fixed `SNAP` for connect; revisit if manual zoom tests fail — implementer may align with `wireHoverFromWorld`. |
| **M3** | Reject self-connection to the stub’s fixed port. |
| **M4** | **A-only:** free-end drag does not create junction/split from segment hits. |
| **M5** | Defer to implementation selfcheck if interface-port edge cases appear. |

---

## 7. Approved implementation (S5b.2) — not started in repo

**Scope:** Operation **A** only.

1. **`connectFreeEndToTarget`** (new, `nets.ts`) — compose `placeFreeEnd` + `reconnectEnd`; return `WireResult` + status string.
2. **`DiagramStage.vue` — `freeEndDrag` move:**  
   - `hit = snapTarget(world)`; if `port`, preview `placeFreeEnd` to `hit.point`, set highlight ref; else grid-snap free + clear highlight (mirror `wireHoverFromWorld` policy).
3. **`onPointerUp`:** if highlight port valid → `connectFreeEndToTarget` inside `commitDocumentGesture`; else current grid-only `placeFreeEnd` commit.
4. **UI:** port highlight (circle at `portAnchor`) during drag; status on refuse.
5. **Selfcheck:** unwired port connect preserves `segmentId`/`netId`/label id; wired same-net fan-in; refuse cross-net; both orientations; undo/redo one step.

**Explicitly out of scope:** B free–free, C segment/junction, D detach, new dependencies, wire-tool changes.

**Estimated touch surface:** `nets.ts` (+40–80 LOC), `DiagramStage.vue` (+60–100 LOC), `selfcheck.ts` (+1 block), short acceptance doc update.

---

## 8. Staged release map (proposed numbering)

| Stage | Feature | Builds on |
| --- | --- | --- |
| **S5b.1** | Stable free-end move | ✅ Accepted |
| **S5b.2** | **Free end → port snap & connect (A)** | This investigation |
| **S5b.3** | Free end → free end (B) | `reconnectEnd` + probe; may need merge policy |
| **S5b.4** | Free end → segment / junction (C) | `resolveHit` junction/split paths |
| **S5b.5** | Detach bound end → free (D) | New inverse of `reconnectEnd` |
| **S5c** | Span slide (existing) | Already in editor |
| **S5d** | Bend vertex move | `startBend` / `placeSpan` family |

Defer **S5c/S5d** renumbering in operational roadmap until user confirms; this table is **architectural** only.

---

## 9. Verification plan

### Automated (`selfcheck`)

| ID | Scenario |
| --- | --- |
| **SC-A1** | Port→Free stub → `connectFreeEndToTarget` unwired port → `end.kind === 'port'`, same `segmentId`/`netId`, label retained |
| **SC-A2** | Free→Port orientation (start free) |
| **SC-A3** | Multi-bend stub — interior point unchanged within epsilon |
| **SC-A4** | Cross-net port → `ok: false`, geometry baseline if cancel semantics tested via session |
| **SC-A5** | `reconnectEnd` direct unit cases (port / refuse ambiguous) |
| **SC-A6** | Undo/redo single history entry |

### Manual (browser)

| ID | Steps |
| --- | --- |
| **M-A1** | Output stub → drag free end to input port (screenshot scenario) |
| **M-A2** | Grid snap **off**, off-grid port (prepare for P5d) |
| **M-A3** | Zoom 50% / 200% — snap still lands |
| **M-A4** | Esc cancels; no phantom bind |
| **M-A5** | Undo/Redo; save/load |
| **M-A6** | Automatic arrows refresh (P5c) |
| **M-A7** | Cross-net — **refuse** + baseline restore (**M1**) |

Distinguish: **selfcheck** = core semantics; **manual** = highlight, tolerance feel, inspector.

---

## 10. Relationship to deferred / adjacent work

| Item | Relation |
| --- | --- |
| **S5b RCA / stub drag** | Root cause was wrong gesture (span slide); fixed. Snap-connect is **additive**, not a regression fix. |
| **D5b.4a port vs wire hit** | `portNearWorld` handoff on wire body — separate from free-end handle path; watch double-grab near port. |
| **Unique Net Naming** | Reinforces **keep stub net** on extend; no silent name join. |
| **P5c arrowheads** | Automatic analysis per `netId` after topology change — no code change expected in `wireArrowheads.ts`. |
| **P5c-DEL** | Selection mutual exclusion unaffected; free-end drag already uses `focusSegmentSelection`. |
| **P5d Generic Circle** | Port snap must use **`portAnchor`**, not block-grid — called out in §5. |
| **P5d gate** | User intent: consider **S5b.2 before P5d** after P5c-DEL manual pass — product priority, not blocked by code. |

---

## 11. Gates & next step

| Gate | Status |
| --- | --- |
| P5c | **18/18 accepted** |
| P5c-DEL | **9/10** — **DEL10** — [investigation](diagram-lab-del10-net-split-investigation.md) |
| S5b.2 code | **Blocked** until DEL10 fix + **DEL 10/10** |
| Git checkpoint | After DEL 10/10 (user request) |
| P5d | **Preparation approved** — [p5d prep](diagram-lab-pilot-a2-p5d-generic-circle.md); implementation after architecture sign-off |

**Next:** S5b.2 **12/12 closed** — P5d architecture review → implement generic circle per prep doc (no silent changes to Adder/Multiplier/Oscillator).

---

## 12. One-line summary

**S5b.1 moves free tips only; logical port connect is one unused `reconnectEnd` away — S5b.2 is mainly wire-tool-grade `snapTarget` during `freeEndDrag`, composed geometry+bind helper, port highlight, selfcheck, and a clear cross-net merge policy.**