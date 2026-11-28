# P5c acceptance finding — wire deletion and selection

**Status:** **Closed / accepted** (28 Nov 2026). **P5c-DEL 10/10** (first pass 9/10; DEL10 fixed; [regression R1–R7](diagram-lab-del10-fix-acceptance.md) passed).  
**Related:** [P5c wire arrowheads](diagram-lab-pilot-a2-p5c-wire-arrowheads.md), [Unique Net Naming](diagram-lab-unique-net-naming.md), [D5d selection investigation](d5d0a-selection-stub-copy-investigation.md).

---

## 1. User acceptance snapshot

| Area | Result |
| --- | --- |
| **P5c wire arrowheads (full matrix)** | **18/18 passed** |
| **P5c-DEL** | **10/10 accepted** (1st pass 9/10; DEL10 + R1–R7) |
| Stale selection on delete | **Fixed** (DEL2/DEL3 class) |
| B1 single-port stub arrows | **Accepted** |

P5c arrow package **closed**. P5c-DEL **blocked on DEL10** fix + re-test.

---

## 2. Single-port stub automatic arrows (verification)

Observed behaviour matches **`analyzeNet`** on the **canonical `netId`** (`wireArrowheads.ts`):

| Canonical ports on `netId` | Automatic arrows |
| --- | --- |
| Exactly **1× out**, **0× in** (typical output stub) | Arrow **away** from port at free end (`stubReceivers`) |
| **0× out**, **1× in** (typical input stub) | Arrow **toward** input port |
| Any **unspecified** or **inout** on the net | **None** (whole net) |
| **1× out**, **≥1× in** | Arrows at each **in** port (+ stub rules where applicable) |
| **>1× out** | **None** on all segments of that `netId` |

Eligibility uses **distinct port ids** (`Set` in `collectPortsOnNet`), not repeated segment endpoints.

This is **not** a geometric-component override; independent stubs on **different** net ids are separate analyses. **B1** is **intentionally** allowed by the accepted stub rules, not a regression of the canonical ambiguity fix.

Documented in [P5c §2 stub table](diagram-lab-pilot-a2-p5c-wire-arrowheads.md).

---

## 3. Confirmed root cause — delete vs visible selection

### Symptom

Wire polyline shows **selected** (blue, `selectedSegment`), free-end handle visible, Properties show **Wire** inspector — but **Delete** runs **port delete** and emits the wired-port protection string.

### Mechanism

`DiagramStage.vue` keeps **parallel** selection refs:

| Ref | Set by |
| --- | --- |
| `selected` | Block(s) |
| `selectedPort` | `onPortDown`, port placement, … |
| `selectedSegment` | `onSpanDown`, span/bend/free-end drag, … |
| `selectedStroke` | Ink |

**Wire select (`onSpanDown`)** sets `selectedSegment` and clears `selected` blocks, but **does not clear `selectedPort`.**

**Port select (`onPortDown`)** sets `selectedPort` and clears blocks, but **does not clear `selectedSegment`.**

**Delete (`removeSelection`)** prioritises stale port:

```3053:3066:diagram-lab/src/view/DiagramStage.vue
function removeSelection(): void {
  if (selected.value.size === 0 && selectedPort.value) {
    deleteActivePort()
    return
  }
  const ids = [...selected.value]
  const strokeId = selectedStroke.value
  const segmentId = ids.length === 0 ? selectedSegment.value : null
  ...
}
```

If `selectedPort` is still set from an earlier click (common flow: **port → draw stub → click wire body → Delete**), **`deleteActivePort()` runs first**; wired port → status `This port has a wire…` and **no** `deleteSegment`.

Keyboard **Delete/Backspace** and toolbar **Delete** both call `removeSelection()` (`onKey` ~4805, button ~5033).

### Alignment with user hypothesis

Matches **DEL2** (port then wire, delete) and likely **DEL3** if the wire start port remained selected after `acceptWire` (finish stub does not clear `selectedPort`).

**DEL1** (clear background, wire, delete) likely **passes** because `onStagePointerUp` / escape paths clear both refs.

### P5c regression?

**No.** A2-P5c changes are limited to `wireArrowheads.ts` and marker SVG; **`removeSelection` / `onSpanDown` unchanged.** Pre-existing **selection orthogonality** defect; arrowheads made stub testing more visible.

### Secondary hit-target notes (not primary delete bug)

- `onSpanDown`: click on wire **near** a port within `portNearWorld` radius → **`onPortDown`** instead of wire select (D5b.4a hand-off).
- Free-end circles use `startFreeEnd` path; mid-span select uses span drag path — both set `selectedSegment` without clearing port.

SVG **arrow markers** are `pointer-events` on the parent polyline hit target; markers are not a separate delete target.

---

## 4. Expected behaviour (product)

| Visible primary selection | Delete action |
| --- | --- |
| **Wire** (`selectedSegment`, Wire inspector) | `deleteSegment` for that segment; existing net split rules |
| **Port** (port inspector, no wire focus) | Existing `classifyPortDelete` / wired protection |
| **Block(s)** | `deleteBlocks` as today |

Delete target must follow **what the UI presents**, not a stale parallel ref.

---

## 5. Implemented correction (28 Nov 2026)

**A — `removeSelection` priority:** blocks → stroke → segment → port (`else if` so one target per action; segment no longer loses to stale `selectedPort`).

**B — mutual exclusion:** `focusPortSelection` / `focusSegmentSelection` on port down, span / stub / bend / label select, ink stroke select; block click and blank-canvas marquee clear port + segment + stroke.

**C — after `acceptWire`:** focus the new segment (DEL3).

Pure helper: `resolveDeleteSelectionTarget` in `diagram-lab/src/core/selectionDelete.ts` (selfcheck **DEL-R1–R3**).

### Regression tests (proposed selfcheck or UI harness)

| ID | Scenario | Expect |
| --- | --- | --- |
| DEL-R1 | `selectedPort` + `selectedSegment` → `removeSelection` | `deleteSegment` called, not port message |
| DEL-R2 | Port only → Delete on wired port | Protection message, no segment delete |
| DEL-R3 | Segment only → Delete | Segment removed |

Unit-style: export a tiny `resolveDeleteTarget(selected…)` pure function, or document-stage integration test if harness exists.

### Out of scope (this fix)

- S1/S2 cumulative mixed selection redesign
- Hit-radius / port-vs-wire click arbitration changes
- D5c.7 copy modes
- Merge confirmation dialog

---

## 6. User delete matrix (manual — 9/10 as of 28 Nov 2026)

| Test | Purpose |
| --- | --- |
| DEL1 | Blank canvas click → select wire → Delete |
| DEL2 | Port → wire → Delete (**former repro**) |
| DEL3 | Finish stub → immediate Delete |
| DEL4 | Toolbar Delete (if enabled) |
| DEL5 | Wire without automatic arrows |
| DEL6 | Wire with automatic arrows |
| DEL7 | Stub drawn in reverse direction |
| DEL8 | Connected port — wired-port protection |
| DEL9 | Undo/Redo after successful delete |
| DEL10 (1st) | Delete one same-net CLK stub | **Fail** pre-fix — [DEL10](diagram-lab-del10-net-split-investigation.md); **re-test after fix** |
| DEL8 | Connected port delete protection | **Pass** |

---

## 7. Gates

- **No shared git checkpoint** until **DEL10** fixed and **DEL 10/10**.
- **S5b.2 / P5d** gated on DEL10 resolution (user).

---