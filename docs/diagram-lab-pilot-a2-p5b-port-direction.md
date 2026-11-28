# A2-P5b — Port direction (implementation)

**Status:** **Closed / accepted** (28 Nov 2026).  
**Depends on:** [A2-P5a closed](diagram-lab-pilot-a2-p5a-text-typography.md).  
**Out of scope:** P5c arrowheads, bus width, data types, HDL connection rules, automatic flow analysis.

---

## 1. Semantic model

Optional values at two layers (diagram JSON):

| Layer | Field | Values stored | Missing means |
| --- | --- | --- | --- |
| Symbol pin | `SymbolPort.direction` | `in` \| `out` \| `inout` | unspecified |
| Instance port | `Port.direction` | `in` \| `out` \| `inout` | inherit symbol pin |

**Effective direction** (`resolvePortDirection`):

1. Instance `Port.direction` when set.  
2. Else bound `SymbolPort.direction`.  
3. Else `unspecified`.

Independent of port **side**, **t**, **guideU**, wire order, segment geometry, net name, and artwork.

**Not in this package:** logical component interface ports (`interfacePortId` on project components) — sheet instance + symbol defaults only. Hierarchy extract/expand copies instance `Port` records; direction rides along with existing port identity. Document any future interface-level direction separately.

---

## 2. Inspector

**Sheet — selected instance port** (`data-port-direction`):

- Unspecified — clears instance override (revert to symbol default).
- Input / Output / Bidirectional — sets instance override when it differs from symbol default; canonical storage omits redundant values.

Shows **effective** direction in the select; hint when an instance override is active.

**Symbol editor — selected pin** (`data-symbol-pin-direction`):

- Sets the library/symbol default for new instances without override.

No bus width, datatype, or arrow controls.

---

## 3. Editing

- `setPortDirection` (`edit.ts`) — instance; refreshes geometry index only (no net/segment mutation).
- `setSymbolPortDirection` (`symbols.ts`) — symbol pin default.
- History: one transaction per inspector change; no-op commits skipped.

Verified paths: undo/redo, save/load, duplicate block, symbol instantiate, `addSymbolPort` / library JSON, fragment copy via `{...port}`.

**Explicit non-goals:** reject out→out connections, auto-reroute, merge/split nets, or change labels based on direction.

---

## 4. P5c — automatic arrowheads (information for renderer)

Use **effective** `resolvePortDirection` per port on a net. Suggested rules (not implemented in P5b):

| Constellation | Auto arrows |
| --- | --- |
| One `out`, one `in` | Toward the `in` |
| One `out`, many `in` | Toward each `in` |
| Multiple `out` | Ambiguous — none |
| Only `in` | No unique source |
| `inout` involved | Ambiguous without extra rules |
| All `unspecified` | None |
| Same net name, disjoint stubs | Respect net id + port direction set |

Renderer reads persisted metadata only; does not infer direction from names or geometry.

**Code:** `diagram-lab/src/core/portDirection.ts`.

---

## 5. Verification

| Check | Result |
| --- | --- |
| `npm run selfcheck` | **Green** (`A2-P5b:*`) |
| `npm run check` | **Green** |
| Browser inspector | **Accepted** (manual) |

### Manual acceptance (BPSK / Channel Parameters)

1. Legacy sheet loads; ports show **Unspecified** until edited.
2. Symbol editor: set multiplier **out** pin → new instances inherit.
3. One instance override **in** on same pin; hint shows override.
4. Undo/redo direction; save/load preserves symbol + instance fields.
5. Wires and routing unchanged after direction edits.
6. Duplicate block copies instance overrides.

---

## 6. Gates

- **A2-P5c** arrowheads next.  
- P5d, legacy SymbolLabel P5, S5b, D5d unchanged.