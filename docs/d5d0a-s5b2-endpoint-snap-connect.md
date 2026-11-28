# S5b.2 — Free endpoint snap & connect (operation A)

**Status:** **Closed — accepted** (28 Nov 2026). Manual **S1–S12: 12/12** passed. Implementation commit `ec66672`; acceptance close-out after verification. Checkpoint `b5297fc` (Unique Net Naming + P5c + DEL10).  
**Investigation:** [diagram-lab-s5b-endpoint-snap-connect-investigation.md](diagram-lab-s5b-endpoint-snap-connect-investigation.md) (**accepted**).  
**Prerequisite:** [S5b.1 free-end move](d5d0a-s5b-stub-endpoint-drag.md) (shipped; re-verify in S5b.2 acceptance).

---

## 1. Goal

Drag an existing **free** segment end onto a **block port** in Select mode → **same segment**, endpoint `free` → `port`, orthogonal preview, **no** second segment, **no** `commitWire` completion path.

Establishes interactive **logical** connectivity (not geometry-only stub extension).

---

## 2. Architecture — approved

### M1 — Cross-net (closed)

| Release target | Behaviour |
| --- | --- |
| Free canvas | Move free end only (`placeFreeEnd`) |
| Unconnected port | Snap & connect |
| Port on **same** canonical net | Connect if `probeWire` / topology allow |
| Port on **different** canonical net | **Reject** — existing explicit-merge message; **restore baseline** on release over rejected target (no phantom free tip on port) |
| Fixed port of this stub (self) | Reject invalid self-connection |
| Esc | Restore gesture baseline |

**No** automatic `mergeNets` during endpoint drag. **No** join-by-port-name.

**Future (not S5b.2):** explicit “Merge connected nets?” dialog (rename/merge flow) for cross-net drag — may affect many spatially separated stubs; deferred.

### Drag feedback (three states)

| State | UX |
| --- | --- |
| **A** — no port in range | Normal free-end move |
| **B** — eligible port | Snap tip to `portAnchor`; highlight; release → connect |
| **C** — cross-net port | Distinguishable reject highlight; release → baseline restore + message |

Reuse Wire Tool snap/hover patterns where they already exist (`snapTarget`, `wireHoverFromWorld` policy); exact colours TBD in implementation.

### Core reuse

| Piece | Use |
| --- | --- |
| `freeEndDrag` gesture | Extend preview/commit |
| `placeFreeEnd` | Geometry toward snap point |
| `snapTarget` / `portAnchor` | Port snap independent of grid |
| `reconnectEnd` | Logical bind after geometry |
| `probeWire` | Refuse cross-net / invalid topology |
| `refreshSegment` | Pin terminals after bind |
| EditSession baseline | Preview from baseline; one history entry on success only |

**New (minimal):** composed helper e.g. `connectFreeEndToPort` in `nets.ts` (placeFreeEnd + reconnectEnd + validation); selfcheck for `reconnectEnd` and integration.

### Binding semantics (unwired target port)

Preserve: **segment id**, **net id**, **net name**, labels (content, typography, offsets), segment **arrowhead** overrides. Recalculate automatic arrows per P5c after topology change.

---

## 3. Interaction rules

- Port snap **off** when grid snap is off (connectivity uses `snapTarget`, not `snapValue` on ports).
- Leaving a valid/rejected target resumes normal free movement.
- Successful release: commit logical bind inside `commitDocumentGesture`.
- Rejected or cancelled gesture: **no** history entry.
- Esc: existing cancel path restores baseline.

---

## 4. Out of scope (deferred — status unchanged)

| Item | Stage |
| --- | --- |
| Free end → free end | S5b.3 |
| Free end → segment / junction | S5b.4 |
| Detach bound end → free | S5b.5 |
| Cross-net merge confirmation dialog | Post–S5b.2 |
| Autorouter, free-angle routing | — |
| **P5d Generic Circle** | After **S5b.2 acceptance** |

---

## 5. Automated verification (`selfcheck`)

Add coverage for previously untested `reconnectEnd` and S5b.2 integration:

- Free → unconnected port (both orientations).
- Segment + net identity on unwired connect.
- Same-net target where valid.
- Cross-net rejection (no document change on failed commit path).
- Invalid self-connection.
- Label + arrowhead override preservation; automatic arrow recompute smoke.
- Undo/Redo one step; cancelled gesture baseline; save/load round-trip.

Run after implementation:

```bash
cd diagram-lab
npm run selfcheck
npm run check
```

---

## 6. Manual acceptance (browser) — **12/12 passed** (28 Nov 2026)

| ID | Case | Expected |
| --- | --- | --- |
| S1 | Straight stub → drag free end to port | Direct Port↔Port |
| S2 | Reversed orientation (free at start) | Direct connection |
| S3 | Multi-bend stub | Interior bends stable; terminal leg correct |
| S4 | Grid snap **off** | Port snap still works |
| S5 | Off-grid port position | Exact port anchor bind |
| S6 | Drag away from highlighted port | Free end follows pointer again |
| S7 | Target port on **other** net | Refused; baseline on release |
| S8 | Esc mid-drag | Original stub |
| S9 | Undo / Redo | Toggle connect vs stub |
| S10 | Unwired connect | Same segment id + net id |
| S11 | Label + arrows | Preserved / updated correctly |
| S12 | Save / Load | Logical bind persists |

Re-exercise **S5b.1** move stability (zoom, snap on/off) during S5b.2 pass.

---

## 7. Implementation gates

| Gate | Required before coding |
| --- | --- |
| P5c manual | **18/18 done** |
| P5c-DEL | DEL10 fix landed — **manual 10/10 + R1–R7** |
| Git checkpoint | User-requested after above (optional before S5b.2) |

**P5d** — **preparation approved** after S5b.2 **12/12** — [P5d prep](diagram-lab-pilot-a2-p5d-generic-circle.md) (documentation only until architecture sign-off).

---

## 8. Development order (user, 28 Nov 2026)

1. P5c-DEL manual acceptance  
2. P5c wire arrowheads — remaining A/E  
3. Git checkpoint (on request)  
4. **S5b.2** implement + manual 12/12  
5. **P5d** Generic Circle  
6. BPSK demonstrator refresh  

---

## 9. One-line summary

**Wire Tool–grade port snap on `freeEndDrag`, compose `placeFreeEnd` + `reconnectEnd`, conservative cross-net refuse (M1), three-state feedback — shipped and accepted (12/12).**

---

## 10. Close-out record

| Item | Result |
| --- | --- |
| Automated | `npm run selfcheck` + `npm run check` green at acceptance |
| Manual | S1–S12 all passed (straight/reverse/multi-bend, snap off, off-grid, reject, Esc, undo, identity, labels/arrows, save/load) |
| Implementation | `ec66672` — `probeConnectFreeEnd` / `connectFreeEnd`, `DiagramStage` free-end snap UI |
| Next | **A2-P5d** — [preparation doc](diagram-lab-pilot-a2-p5d-generic-circle.md); **no implementation** until architecture approval |