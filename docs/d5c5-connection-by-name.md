# D5c.5 — Connection-by-name + open stubs

D5c.4 made wire **Name** editable but did **not** join nets. Same display name could mean several net ids. This slice adopts HDL-Designer-like **connection by name** on the current sheet and adds **Port → free** stub finish via double-click.

## 1. Status

| Item | Status |
| --- | --- |
| D5c.4 | Accepted (26 Nov 2026) |
| D5c.5 | Accepted by the user (26 Nov 2026) |
| D5c.6 | Accepted (26 Nov 2026) |
| D5c.7 | Spec only — deferred implement; see [d5c7-wire-copy-spec.md](d5c7-wire-copy-spec.md) |
| D5b.5 / D5b.6 | Locked |

## 2. Product rule (updated 28 Nov 2026 — [Unique Net Naming](diagram-lab-unique-net-naming.md))

**Per sheet:** equal logical **name** ⇒ **one net** (one net id) **after an explicit join** (rename to existing name, merge-all, `linkPorts`, paste stub via `ensureNetByName`).

**New wires and stubs** without geometric attachment to an existing net receive a **unique display name** (`out`, `out_1`, …) and a **new net id** — the port name is only a **naming suggestion**, not an implicit join.

**Merge** stays for joining nets that still have **different** names.

Scope is the **current sheet only** (not project-wide across child diagrams).

## 3. Rules

| Situation | Behaviour |
| --- | --- |
| Create stub / new wire (no geometric net yet) | **Unique** name (`allocateUniqueNetName`) and **new** net id — see [unique net naming](diagram-lab-unique-net-naming.md) |
| Port → free stub | Name from the **start port** (port `name`); free end open |
| Free → port | Name from the **end port** if no net yet on that hit |
| Geometry already on a net | That net wins; no silent rename |
| Rename → free unused name | Rename only; no split |
| Rename → name already used | **Join** into the target net (one history entry); source net id removed |
| Draw joining two **unequal** nets geometrically | Still refused (`probeWire`); use Merge |
| Ambiguous snap | Still refused |
| Legacy duplicate names on open | **Not** auto-merged; Inspector warns; optional **Merge all with this name** |
| Delete / disconnect pieces | New fragment nets get **unique** names (no new silent duplicates) |

### Port name inheritance

1. If start or end already touches a net → keep that net.  
2. Else if start is a port → use that port’s `name`.  
3. Else if end is a port → use that port’s `name`.  
4. Else → default unique `net` / `net N`.

### Stub gesture

1. Wire tool: click a **port** to start.  
2. Optional bend clicks on free space.  
3. **LMB double-click** on free space (or **Enter**) commits an open end.  
4. Esc cancels (D5c.2); pan does not kill the draft (D5b.5b).

## 4. Migration / legacy

- Opening a sheet with several nets named `net 4` leaves them separate until the user acts.  
- Inspector: “Name used N times” when the selected net’s name collides.  
- **Merge all with this name** merges every sheet net with that name into one id (stable: keep smallest net id).

## 5. Non-goals

- No Shift+Drag (D5c.6), no wire-segment copy (D5c.7).  
- No port direction matrix.  
- No auto-merge-all-duplicates on load.  
- No cross-sheet / project-global name join.  
- No D5b.5 toolbar polish.

## 6. Implementation map

| Piece | Role |
| --- | --- |
| `findNetByName` / `ensureNetByName` / `netsNamed` / `nameCollisions` / `mergeNetsByName` | Sheet-scope policy |
| `renameNet` | Join when name exists |
| `commitWire` / `createNet` | Inherit port name; reuse by name |
| `reassignComponents` | Spawned nets get unique names |
| `wiretool` + `DiagramStage` | Double-click free → stub commit |
| Inspector | Collision hint + Merge-all |

## 7. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 8. Acceptance checklist

8/8 — accepted 26 Nov 2026 (incl. various stubs)

1. Doc covers scope, rename-join, stub-join, Merge, migration.  
2. Selfcheck: rename to existing name → one net id; Undo splits again.  
3. Selfcheck: stub create with existing name → segment on that net.  
4. Unequal geometric join still blocked without Merge.  
5. Port → double-click free → stub + correct name; no parallel net when name exists.  
6. Three legacy `net 4` stubs stay apart until Merge-all / rename-join.  
7. Inspector collision warning (+ Merge-all).  
8. Esc / pan / undo smoke; selfcheck + vue-tsc green.
