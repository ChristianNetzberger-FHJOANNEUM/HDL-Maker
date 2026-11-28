# DEL10 — Canonical net connectivity after segment deletion

**Status:** **Closed / accepted** (28 Nov 2026). Manual **R1–R7** and DEL **10/10** passed.  
**Related:** [P5c-DEL](diagram-lab-p5c-wire-deletion-investigation.md), [Unique Net Naming](diagram-lab-unique-net-naming.md), [P5c canonical semantics](diagram-lab-pilot-a2-p5c-wire-arrowheads.md).

**Gates:** **S5b.2** and **P5d** remain blocked until DEL10 is **fixed and accepted** (user, 28 Nov 2026).

---

## 1. Manual acceptance (updated 28 Nov 2026)

| Suite | Result |
| --- | --- |
| **P5c Wire Arrowheads** | **18/18 passed** (incl. former A/E matrix) |
| **P5c-DEL (first pass)** | **9/10** — DEL10 failed (selection fix accepted) |
| **DEL10 fix** | Implemented; **browser R1–R7 pending** |

| DEL | Result | Notes |
| --- | --- | --- |
| DEL1–DEL7 | Pass | Stale selection fix verified |
| DEL8 | **Pass** | Connected port cannot be deleted; protection message as designed |
| DEL9 | Pass | Undo/Redo |
| **DEL10** | **Fail** | See §2 |

The original **selection / delete dispatch** defect is **resolved**.

---

## 2. Confirmed DEL10 reproduction

**Setup:** Three independent stubs (1× out, 2× in), three initial `netId`s, then **explicit rename** so all share display name **CLK** and one **canonical `netId`** (operation C — shared-by-intent).

**Action:** Delete one input stub (segment delete).

| Artifact | Expected | Observed |
| --- | --- | --- |
| Deleted input stub | Removed | **OK** |
| Output stub name | CLK | **CLK** |
| Remaining input stub name | CLK | **CLK_1** |
| Shared `netId` for surviving stubs | **Unchanged** | **Split** — survivor likely new `netId` |
| Automatic arrows | Consistent with **canonical** net | Still **look** correct (P5c analyses full `netId`; not proof of shared id) |

**Confirmed:** Remaining fragment receives a **new net id** and **`allocateUniqueNetName`** suffix (`CLK_1`). User sees rename; id change is the mechanism behind it.

---

## 3. Root cause

### 3.1 Call chain

```363:370:diagram-lab/src/core/nets.ts
/** Remove one segment, then give each remaining piece of that net its own id. The piece with the smallest segment id keeps the old id. */
export function deleteSegment(doc: DiagramDocument, segmentId: string): string[] {
  ...
  return reassignComponents(doc, netId)
}
```

Every segment delete **unconditionally** runs geometric component reassignment on the stub’s former `netId`.

### 3.2 `reassignComponents` logic

```373:404:diagram-lab/src/core/nets.ts
export function reassignComponents(doc: DiagramDocument, netId: string): string[] {
  const owned = doc.segments.filter((segment) => segment.netId === netId)
  const components = componentsOf(owned)
  if (components.length <= 1) {
    pruneTopology(doc)
    return []
  }
  ...
  for (const component of ranked.slice(1)) {
    const id = createId('net')
    doc.nets.push({ id, name: allocateUniqueNetName(doc, net?.name ?? 'net') })
    ...
    segment.netId = id
  }
```

If **more than one geometric component** remains, all but the lexicographically smallest segment id keep the original `netId`; **every other component gets a new `netId` and a suffixed name**.

### 3.3 `componentsOf` = geometry only

```838:869:diagram-lab/src/core/nets.ts
function componentsOf(segments: Segment[]): string[][] {
  ...
      if (sharesNode(segments[left], segments[right])) join(...)
}
function sharesNode(a: Segment, b: Segment): boolean {
  ...
}
function nodeKey(end: Endpoint): string | null {
  if (end.kind === 'port') return `port:${end.portId}`
  if (end.kind === 'junction') return `junction:${end.junctionId}`
  return null  // free ends do NOT merge groups
}
```

Independent **Port↔Free** stubs on the same `netId` are **always** multiple geometric components. They never share port/junction nodes.

### 3.4 Intentional vs accidental split

| Concept | Representation today |
| --- | --- |
| **Logical / canonical** | Shared `netId` + display name (e.g. via `renameNet` join, `mergeNetsByName`, paste `ensureNetByName`) |
| **Geometric / electrical** | `componentsOf` or `connectedSegmentGroups` — ports/junctions only |

`connectedSegmentGroups` in `wireArrowheads.ts` already documents: *“rename-merge can share an id across disjoint pieces.”* P5c **automatic arrows** use **full `netId`** analysis — arrows can stay visually plausible after DEL10 even though **canonical identity was broken**.

There is **no persisted flag** for “intentionally disjoint fragments.” Intent is **inferred** from users joining ids/names without geometric links.

### 3.5 Relation to Unique Net Naming

| Question | Answer |
| --- | --- |
| Predates Unique Net Naming? | **Geometric split-after-delete is older** (D5c bridge test in selfcheck `netFixture`). |
| Exacerbated by Unique Net Naming? | **Naming policy is more visible** (`CLK_1` via `allocateUniqueNetName`); split behavior unchanged. |
| Unique Net Naming “bug”? | **No** — join/split policies collide at **`reassignComponents`**, which always treats >1 component as “must split ids.” |

---

## 4. Architectural distinction (required fix semantics)

| Case | Before delete | After delete | Correct behaviour |
| --- | --- | --- | --- |
| **DEL10** — N disjoint stubs, one `netId` | N geometric components | N−1 components | **Keep one `netId` and CLK** on all survivors |
| **Bridge cut** — one linked graph | 1 component | 2+ components | **Split** ids (today’s selfcheck `seg_link`) |
| Delete only stub of 2-stub shared net | 2 components | 1 component | **No split** (today **OK** — `components.length <= 1`) |
|删除 middle of a chain (1 component) | 1 | 2+ | **Split** |
| 50 CLK stubs, delete one block’s stub | 50 components, 1 net | 49 components | **Must not** renumber the other 49 (simulation clock) |

**Principle:** Deleting a segment may change **geometry**, but must not **automatically dissolve** a pre-existing **multi-fragment canonical net** unless the delete **introduces a new geometric fracture within a previously connected component**.

**Not acceptable:** Only suppressing rename while still reassigning `netId`s (user requirement: fix **canonical net management**, not cosmetic naming).

---

## 5. Implemented policy (28 Nov 2026)

### Rule (verified in code)

```text
shouldSplit = beforeComponents.length === 1 && afterComponents.length > 1
```

| Case | Before | After delete | Split? |
| --- | --- | --- | --- |
| **A** — delete one of N disjoint stubs (same `netId`) | N ≥ 2 components | N−1 | **No** |
| **B** — delete bridge in single connected graph | 1 | > 1 | **Yes** (`seg_link` selfcheck) |
| **C** — remote stub + connected graph; delete internal bridge | ≥ 2 | > before | **No** — conservative; all keep canonical `netId` |

Fall **C** matches user freigabe: when reassignment is ambiguous, **do not** assign remote fragments to new nets. Model needs **no schema change** — `beforeOwned` snapshot on `deleteSegment` / `deleteBlocks` suffices.

### API touch surface

| Symbol | Change |
| --- | --- |
| `deleteSegment` | Pass pre-delete snapshot or compute split policy inside `reassignComponents` |
| `reassignComponents` | Conditional split vs `pruneTopology` only |
| `deleteBlocks` | Same policy when removing attached segments (§6) |
| `allocateUniqueNetName` on split | Unchanged — only when split is justified |

No schema change required if rule is purely procedural.

### Limitation (documented)

If a canonical net mixes **disjoint fragments** and one **connected** fragment that later **fractures internally**, survivors (including remote stubs) **all** retain the original `netId`. User may use explicit rename/merge/detach later. Per-fragment reassignment on fracture was **rejected** (ambiguous).

### Alternatives if rule proves ambiguous (deferred)

| Option | Tradeoff |
| --- | --- |
| Persist `net.multiFragment` flag | Explicit, migration burden |
| “Detach fragment” user command | Manual; poor for 50-stub CLK |
| Never split on delete | Breaks `seg_link` bridge test |

Recommendation: **procedural fracture detection** first.

---

## 6. Related operations (same defect risk?)

| Operation | Calls `reassignComponents`? | DEL10-like risk |
| --- | --- | --- |
| **`deleteSegment`** | **Yes** — always | **Yes** — confirmed |
| **`deleteBlocks`** (removes attached wires) | **Yes**, per affected net | **Yes** — deleting one CLK block could split siblings |
| **Branch delete** | Via `deleteSegment` | Same |
| **Junction delete** | No dedicated op; junction prune via topology | Low unless segment delete |
| **Delete last segment of net** | `components.length <= 1` → prune only | **No** split |

No implementation in this pass; **deleteBlocks** must ship with any DEL10 fix.

---

## 7. Regression cases (proposed selfcheck)

| ID | Scenario |
| --- | --- |
| **DEL10-R1** | Three disjoint stubs → same `netId`/CLK via `mergeNetsByName` or `renameNet`; delete one in stub → **2 survivors, same netId, name CLK** |
| **DEL10-R2** | Delete output stub — survivors keep CLK |
| **DEL10-R3** | Four stubs same net — delete one |
| **DEL10-R4** | **Preserve** `seg_link` bridge: delete middle → **split** new id |
| **DEL10-R5** | Labels / port bindings on survivors unchanged |
| **DEL10-R6** | EditSession undo/redo restores ids/names |
| **DEL10-R7** | Serialize/parse round-trip |
| **DEL10-R8** | `automaticNetStatus` / arrowheads match canonical net after fix |
| **DEL10-R9** | `deleteBlocks` one of three CLK blocks — other stubs keep net |

Distinguish **core selfcheck** vs browser DEL10 re-run.

---

## 8. DEL8 (closed)

**Result:** **Passed** — connected port deletion refused with *“This port has a wire. The port and the wire were kept.”*

**Interaction:** Select tool → pointer down on **port** (block port handle / port hit target), not wire body → Delete or inspector delete port. Port drag uses same down path; selection uses `focusPortSelection`. No doc change required beyond this record.

**Automation:** `selfcheck` — `classifyPortDelete` / `removeUnwiredPort` wired-port cases (~lines 1922–2037 region); stage `deleteActivePort` wired branch.

---

## 9. Gates & next steps

| Item | Status |
| --- | --- |
| DEL10 selfcheck | **DEL10-R1…R10** green |
| **Manual re-test** | **R1–R7** — 0/7 until signed off (below) |
| Git checkpoint | After DEL **10/10** + R1–R7 |
| S5b.2 | Gated on DEL acceptance |

### DEL10 fix — manual re-test (0/7)

| ID | Case |
| --- | --- |
| R1 | Three CLK stubs → delete one input |
| R2 | Three CLK stubs → delete output |
| R3 | Delete block with CLK stub |
| R4 | Bridge cut still splits |
| R5 | Undo/Redo net ids |
| R6 | Save/Load shared net |
| R7 | Automatic arrows after delete |

**First-pass DEL10 (pre-fix):** failed — `CLK_1` split. Record preserved above §2.

---

## 10. Gates & next steps (summary)

**Next:** Browser R1–R7 → DEL matrix **10/10** → checkpoint (on request) → S5b.2 code.

---

## 10. One-line summary

**`deleteSegment` always splits by `componentsOf` after delete, so intentionally shared disjoint `netId`s (CLK fan-out) lose canonical identity (`CLK_1`); fix by splitting only when a delete fractures a previously geometrically connected component, not when removing one of many pre-existing fragments.**