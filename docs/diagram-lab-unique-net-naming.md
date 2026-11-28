# Unique Net Naming — Implementation

**Status:** **Closed / accepted** (28 Nov 2026) — manual **12/12**; joint checkpoint with P5c + DEL10.  
**Principle:** **Unique by Default, Shared by Intent.**  
**Related:** [investigation](diagram-lab-unique-net-naming-investigation.md), [D5c.5](d5c5-connection-by-name.md), [A2-P5c](diagram-lab-pilot-a2-p5c-wire-arrowheads.md).

---

## 1. Three net operations

| Operation | API / trigger | Result |
| --- | --- | --- |
| **A — Independent create** | `commitWire` when no geometric net yet; `createIndependentNet` | New `netId`, `allocateUniqueNetName` |
| **B — Extend existing** | Snap to port/junction/segment on a net; `extendSegment` | Keeps `netId` |
| **C — Explicit join by name** | `renameNet` → existing name; `mergeNetsByName`; `linkPorts(name)`; paste stub via `ensureNetByName` | Shared `netId` |

Port `name` is a **preferred display name** on independent create, not an implicit join key.

---

## 2. Name allocation

`allocateUniqueNetName(doc, preferred)`:

1. If `preferred` is not used on the sheet → return `preferred` (`out`, `CLK`, `carrier`, …).
2. Else smallest positive `n` with `${base}_${n}` free, where `base` = `netNameFamilyBase(preferred)` (`out_1` → family `out`).
3. Exact string match against **all** net names (legacy `out 2` does not block `out`).
4. Split fragments after delete use the same allocator **only on legitimate geometric fracture** (single component → multiple); multi-fragment canonical nets preserved — [DEL10 fix](diagram-lab-del10-net-split-investigation.md).

Suffix scheme: **`_1`, `_2`, …** (not space + index).

---

## 3. Code map

| Symbol | File | Role |
| --- | --- | --- |
| `allocateUniqueNetName` | `nets.ts` | Deterministic unique display name |
| `createIndependentNet` | `nets.ts` | New id + allocated name |
| `ensureNetByName` | `nets.ts` | Intentional reuse/create by exact name |
| `commitWire` | `nets.ts` | Independent path → `createIndependentNet` |
| `inheritNetName` | `nets.ts` | Preferred label only |
| `renameNet` / `mergeNetsByName` | `nets.ts` | Explicit join (unchanged) |
| `copyAttachedStub` / paste | `edit.ts` | `ensureNetByName` (S3 unchanged) |
| `connectedSegmentGroups` | `wireArrowheads.ts` | Inspector hints only (P5c canonical analysis uses full `netId`) |

---

## 4. D5c.5 delta (precision, not repeal)

| Situation | Before | After |
| --- | --- | --- |
| New wire/stub, no geometry net | Join if name exists | Always independent name + id |
| Rename to existing name | Join | Join (unchanged) |
| Stub → remote net with same name, no geometry | Auto-join on draw | User **renames** or **merge** to join |
| Legacy sheets on load | Unchanged | Unchanged |

**Future (not implemented):** *Detach from Net / Create Independent Net* — split one geometric component onto a new `netId` without redrawing.

---

## 5. Copy / D5c.7

S3 duplicate/paste: named stubs still **`ensureNetByName`** on paste (shared clock nets when duplicating blocks).

Internal Port↔Port copy still creates **new ids** with copied names (possible display-name collisions) — deferred [D5c.7](d5c7-wire-copy-spec.md).

---

## 6. P5c

Automatic arrowheads use per–electrically-connected-group analysis when one `netId` still spans disjoint pieces (legacy or intentional rename). Independent nets avoid accidental multi-port analysis.

Formal **A2-P5c** acceptance follows this package.

---

## 7. Verification

| Command | Result (28 Nov 2026) |
| --- | --- |
| `npm run selfcheck` | **Green** (`selfcheck ok`, incl. `UniqueNet:*`) |
| `npm run check` | **Green** (`vue-tsc --noEmit`) |

### User manual acceptance (28 Nov 2026)

**12 / 12 passed, 0 failures** — no restrictions.

| # | Check |
| --- | --- |
| 1 | Three generic blocks, `out` ports |
| 2 | Three independent stubs → `out`, `out_1`, `out_2` |
| 3 | Three distinct net ids |
| 4 | Port-to-port links get unique names |
| 5 | Free→Port stub same as Port→Free |
| 6 | Tee on segment keeps net id |
| 7 | Rename wire to existing name joins |
| 8 | Display label edits do not change net id |
| 9 | Undo / Redo / Esc |
| 10 | Save / Load |
| 11 | Copy / Shift+Drag behaviour unchanged |
| 12 | Automatic arrows on independent out→in nets |

All cases confirmed by user on 28 Nov 2026. Principle **Unique by Default, Shared by Intent** validated in practice.

---