# Unique Net Naming — Read-only Investigation

**Status:** **Closed** (28 Nov 2026) — [implementation accepted 12/12](diagram-lab-unique-net-naming.md).  
**No code changes** in this package (except this document).  
**Related:** [d5c5-connection-by-name](d5c5-connection-by-name.md), [A2-P5c wire arrowheads](diagram-lab-pilot-a2-p5c-wire-arrowheads.md), [d5c7-wire-copy-spec](d5c7-wire-copy-spec.md), [ADR geometry / semantics](adr-diagram-geometry-routing-style.md).

---

## Executive summary

| Finding | Detail |
| --- | --- |
| **Root cause confirmed** | On **new** wires with **no geometric net** yet, `commitWire` inherits the port `name` and **reuses** any existing sheet net with that display name (`findNetByName` → same `netId`), even when the new segment is **electrically disconnected** from the earlier net. |
| **This is intentional under D5c.5** | Product rule: *equal logical name ⇒ one net id*; disconnected stubs **may** share one id ([d5c5 §2](d5c5-connection-by-name.md)). |
| **User proposal** | **Unique by Default, Shared by Intent** — reverses automatic join-on-create while keeping **explicit** rename / merge / programmatic `linkPorts` join. |
| **Existing allocator** | `uniqueNetName` in `nets.ts` already allocates unique display names but uses **`base 2`** spacing, not `base_1`. It is used on **geometric split** (`reassignComponents`), not on first wire create. |
| **P5c interaction** | Automatic arrowheads analyse **all ports on a `netId`**. Name-collapsed disjoint pieces break automatic rules (multiple `out`, mixed directions). A **local mitigation** (`connectedSegmentGroups` per segment) exists uncommitted; it does **not** fix HDL/Python net identity. |
| **Recommendation** | Implement **Unique Net Naming** as a **semantic correction** (supersedes part of D5c.5 auto-join) **before** formal **A2-P5c** acceptance. |

---

## 1. User finding (confirmed)

Three distinct user-visible layers exist:

| Layer | Model field | Example |
| --- | --- | --- |
| Port name | `Port.name` | `out` |
| Net name | `Net.name` | `carrier_signal` (logical signal) |
| Display label | `Label.displayText` | `b_k` (LaTeX) |

Logical connectivity is determined by **`Net.id`** (`netId` on segments / junctions).  
When several generic blocks expose ports all named `out`, drawing independent port-to-port links or stubs causes **reuse of the first net named `out`**, so unrelated segments share one `netId`. Custom display labels do not affect identity.

**Observed effects**

- False logical connectivity (HDL-Maker / Python-Lab risk).
- [A2-P5c](diagram-lab-pilot-a2-p5c-wire-arrowheads.md) automatic arrows: one analysis per net id → spurious multi-output / unspecified-port failures on BPSK-style sheets.
- Inspector can show many ports on a net the user treats as a single wire (`b_k`).

---

## 2. Confirmed root cause (code)

### 2.1 Primary path — `commitWire`

```299:314:diagram-lab/src/core/nets.ts
  // Geometry wins when a hit already touches a net; otherwise inherit a port name and join by name (D5c.5).
  let createdNet = false
  let netId = probe.netId
  if (!netId) {
    const inherited = inheritNetName(doc, start, end)
    if (inherited) {
      const existing = findNetByName(doc, inherited)
      if (existing) netId = existing.id
      else {
        netId = ensureNetByName(doc, inherited)
        createdNet = true
      }
```

- **`probe.netId`** is set only when **geometry** already touches a net (`netsTouching` on port / junction / segment / free end).
- If both ends are “fresh” (typical **port → port** or **port → free** stub), `inherited` comes from **`inheritNetName`** (port `name`).
- **`findNetByName`** + reuse of `existing.id` is the **silent join** for independent geometry.

```792:802:diagram-lab/src/core/nets.ts
function inheritNetName(doc: DiagramDocument, start: SnapHit, end: SnapHit): string | null {
  if (start.kind === 'port') {
    const port = doc.ports.find((item) => item.id === start.portId)
    if (port?.name.trim()) return port.name.trim()
  }
  if (end.kind === 'port') {
    const port = doc.ports.find((item) => item.id === end.portId)
    if (port?.name.trim()) return port.name.trim()
  }
  return null
}
```

### 2.2 `ensureNetByName` / `createNet`

```213:221:diagram-lab/src/core/nets.ts
export function ensureNetByName(doc: DiagramDocument, rawName: string): string {
  const name = rawName.trim()
  if (!name) return createNet(doc)
  const existing = findNetByName(doc, name)
  if (existing) return existing.id
  const id = createId('net')
  doc.nets.push({ id, name })
  return id
}
```

Any caller of `ensureNetByName` **joins by name** when creating. That is correct for **explicit** “connect to existing net” operations; it is wrong for **independent** auto-created nets under the new policy.

### 2.3 Explicit join paths (keep under “Shared by Intent”)

| API | Join behaviour | Intended under new model |
| --- | --- | --- |
| `renameNet` → name already used | `mergeNets` into target id | **Yes** (explicit user rename) |
| `mergeNetsByName` | Collapse all same-name ids | **Yes** (explicit inspector action) |
| `mergeNets` / geometric join via `probeWire` | Refuse unequal nets unless merged | **Yes** (geometry + explicit merge) |
| `linkPorts(doc, a, b, name)` | `ensureNetByName(doc, name)` | **Yes** — supplied **logical** name |
| Programmatic bench / tests using `linkPorts(..., 'clk')` | Same | **Yes** |

Selfcheck: [D5c.5 rename-join and stub join](diagram-lab/src/core/selfcheck.ts) (~3571–3640).

### 2.4 Already-correct “unique” path

On **segment delete**, disconnected components get **new net ids** and **`uniqueNetName`** on the spawned nets (`reassignComponents`) — avoids geometric split reintroducing duplicate names. This matches the user’s split semantics.

---

## 3. Call-path inventory

| Operation | Touches net id / name? | Behaviour today |
| --- | --- | --- |
| **Port → port** new wire (`commitWire`, no prior net on hits) | Create / join | **Join by port name** if name exists |
| **Port → free** stub (`commitWire` / `finishFree`) | Create / join | **Join by start port name** if name exists (D5c.5 selfcheck) |
| **Free → port** wire | Create / join | **Join by end port name** if name exists |
| **Tee off existing segment** (snap segment / junction) | Reuse | **Geometry wins** — same `netId` (correct) |
| **Extend free end** (`start.kind === 'end'`) | Reuse | Keeps segment `netId` |
| **`reconnectEnd`** | Reuse / refuse | Keeps identity; refuses unequal net meet without merge |
| **`splitSegmentAt` / junction insert** | Reuse | Same `netId` on both children |
| **`deleteSegment` → fragments** | New ids + unique names | `reassignComponents` + `uniqueNetName` |
| **`renameNet`** | Join or rename only | Join if target name exists |
| **`mergeNetsByName`** | Join all same display names | Explicit |
| **`placeFreeEnd`** | None | Net identity unchanged |
| **Block move / resize** | None | — |
| **Port rename** | None on nets | Port name only |
| **`setLabelDisplayText` / display label** | None | Presentation only |
| **Save / load** | None | Round-trip ids and names |
| **`duplicateBlocks` — internal Port↔Port** | **New `netId`**, **same `Net.name`** | Can create **name collisions** (two ids, one name); no auto join |
| **`duplicateBlocks` / paste — attached stub** | `ensureNetByName(net.name)` | **Joins** sheet net by display name (S3 / D5c.5) |
| **`linkPorts`隔着 hierarchy** | `ensureNetByName` | Explicit name |
| **Symbol `instantiateSymbol`** | No nets | Ports only |
| **`copyAttachedStub` / `pasteFragment`** | `ensureNetByName` on stub | Join by name |

**Hierarchy** (`hierarchy.ts`): no direct `ensureNetByName`; connectivity copied via extract/expand document ops (inherits saved `netId` / names).

**Wire tool:** `wiretool.ts` → `commitWire` on finish; stub finish per [d5d0a-s5a](d5d0a-s5a-port-stub-draw.md).

---

## 4. Existing unique-name helper

```204:211:diagram-lab/src/core/nets.ts
/** Next free display name on this sheet (`clk`, `clk 2`, …). */
export function uniqueNetName(doc: DiagramDocument, baseRaw: string): string {
  const base = baseRaw.trim() || 'net'
  if (!findNetByName(doc, base)) return base
  let index = 2
  while (findNetByName(doc, `${base} ${index}`)) index += 1
  return `${base} ${index}`
}
```

| Aspect | Today | User preference |
| --- | --- | --- |
| Collision suffix | Space + index: `out 2`, `out 3` | Underscore: `out_1`, `out_2`, … |
| First use | Base without suffix: `out` | Same |
| Scope | Any **display name** on sheet | Same (including user-renamed nets) |
| Determinism | Yes (linear search) | Same |

**Proposal:** export **`allocateUniqueNetName(doc, preferredBase)`** (rename or thin wrapper over `uniqueNetName` with chosen suffix rule). **Always pair with a new `netId`** when allocating an **independent** net.

**Do not** retroactively renumber existing nets on load.

---

## 5. Proposed minimal correction

### 5.1 Policy split

Introduce two internal behaviours:

1. **`createIndependentNet(doc, preferredBase)`**  
   - `name = allocateUniqueNetName(doc, preferredBase ?? 'net')`  
   - **New** `createId('net')` always  
   - Never calls `findNetByName` for reuse  

2. **`reuseOrCreateNetByName(doc, name)`** (current `ensureNetByName` semantics)  
   - For **explicit** join: rename, merge, `linkPorts`, paste stub onto sheet clock, etc.

### 5.2 `commitWire` change (core)

When `!probe.netId`:

- Compute `preferred = inheritNetName(...) ?? 'net'`.
- **`netId = createIndependentNet(doc, preferred)`** — do **not** `findNetByName(inherited)`.

When `probe.netId` is set (port already wired, junction, segment tee, extension): **unchanged**.

### 5.3 D5c.5 deltas (document + selfcheck)

| Rule | D5c.5 today | After correction |
| --- | --- | --- |
| New wire / stub, no geometry net | Reuse name → same id | **Unique name + new id** |
| Rename to existing name | Join | **Unchanged** |
| Stub to existing **global clk** by drawing from port named `clk` without geometry link | Join existing `clk` net | **Would become separate `clk_1` unless user renames or merges** — **semantic change** |
| Legacy duplicate names on disk | Stay separate until merge-all | **Unchanged** |

The **stub → existing named net without geometry** case is the main tension with HDL-Designer-style “same signal name = connected”. Under **Unique by Default**, that connection becomes **explicit** (rename to `CLK`, merge-all, or future dedicated “connect to net” tool).

**Optional later UX package:** merge confirmation on `renameNet` (user mock-up) — not required for core allocator.

### 5.4 What not to change in this package

- **S3 / D5c.6 duplicate:** stub copy still using `ensureNetByName` for **shared-net duplicate** ([selfcheck ~4023–4029](diagram-lab/src/core/selfcheck.ts)).
- **`duplicateBlocks` internal wires:** still copy **name** with new id (may list in `nameCollisions` until user merges or renames).
- **D5c.7** independent duplicate mode: future.

---

## 6. Interaction with A2-P5c (wire arrowheads)

| Topic | Detail |
| --- | --- |
| **Implementation status** | **Implemented** in `wireArrowheads.ts` + `DiagramStage.vue`; doc status **manual acceptance pending** ([p5c doc](diagram-lab-pilot-a2-p5c-wire-arrowheads.md)). |
| **Analysis unit** | Automatic mode uses port directions **per electrically connected group** on a `netId` (recent uncommitted mitigation when D5c.5 collapsed disjoint pieces). |
| **Without naming fix** | Mitigation hides some arrow symptoms; **logical net id remains wrong** for export / simulation. |
| **With naming fix** | One `out` + `in` per simple link → automatic arrows align with user intent; analysis can safely return to **per `netId`** (or keep groups as defence-in-depth). |

**Recommendation:** Treat **Unique Net Naming** as **prerequisite** for P5c sign-off on BPSK / generic block farms, not only a presentation tweak.

---

## 7. Backward compatibility

| Asset | Impact |
| --- | --- |
| **Saved JSON / projects** | No mutation on load. Sheets already merged by old rules stay as saved (user may use Merge / rename / split delete). |
| **Legacy duplicate display names** | Still reported via `nameCollisions`; `mergeNetsByName` still available. |
| **D5c.5 acceptance tests** | **Must be revised** (stub auto-join, join-on-second-`out` wire). |
| **Benchgen / HDL-like stubs** | Audit recipes that rely on drawing a second stub onto an existing **name** without geometry. |
| **Hierarchy extract / VHDL prep** | Cleaner nets after fix; existing diagrams unchanged until re-edited. |

---

## 8. Proposed selfchecks (implementation phase)

| Case | Expectation |
| --- | --- |
| Two **disconnected** port→port wires from ports both named `out` | **Two** `netId`s, names `out` and `out_1` (or `out 2` if underscore not adopted) |
| Second wire drawn after first on **different** blocks | Not same `netId` |
| Tee from existing segment | Same `netId` |
| Rename `out_1` → `out` | Join per `renameNet` |
| `linkPorts(..., 'clk')` twice on disjoint pairs | Same `netId` (explicit) |
| Port→free stub with port name `clk`, no `clk` net yet | Creates `clk`; second stub creates `clk_1` |
| `deleteSegment` split | Spawned names unique (`reassignComponents`) |
| Duplicate block + stub (S3) | **Unchanged** shared-name join on paste |
| P5c automatic on simple out→in | Arrows on input end |
| Save / load round-trip | Names and ids stable |

### Manual acceptance

1. BPSK sheet: three TX links `out`/`a_k`/… — **distinct** net ids unless explicitly named same.  
2. Set directions + Automatic — arrows on each independent signal.  
3. Rename two nets to common clock — join + optional confirmation (if UX package landed).  
4. Legacy file with name collisions — inspector warning still works.

---

## 9. Unresolved semantic decisions

1. **Suffix format:** `out_1` vs `out 2` (breaking from current `uniqueNetName` and any user docs mentioning space numbering).  
2. **D5c.5 doc supersession:** Amend [d5c5-connection-by-name.md](d5c5-connection-by-name.md) §2 or add ADR — “name implies id” only after **explicit** join, not on create.  
3. **Stub without geometry to global signal:** Require rename/merge vs future “connect to net” picker.  
4. **`linkPorts` / API default:** Keep join-by-name (recommended).  
5. **Merge confirmation dialog:** Separate UX package vs ship allocator only.  
6. **P5c:** Remove `connectedSegmentGroups` workaround after naming fix, or keep as safety net for legacy sheets.  
7. **`findNetByName` with duplicate legacy names:** Today returns **first** `doc.nets` match; allocator must consider **all** display names (user requirement).

---

## 10. Roadmap alignment (user table)

| Package | Recommendation |
| --- | --- |
| A2-P5a / P5b | Closed |
| **Unique Net Naming** | **Next implementation** after this investigation approval |
| A2-P5c | Continue after naming fix; defer formal acceptance until BPSK re-tested |
| A2-P5d | After P5c |
| D5c.7 independent/shared copy | Still deferred; naming fix reduces accidental collision on duplicate |

---

## 11. Architecture review checkpoint

**Questions for approval**

1. Confirm **superseding** D5c.5 automatic join-on-create while keeping rename/merge/`linkPorts`.  
2. Choose **underscore vs space** suffix scheme (and migration note for `uniqueNetName`).  
3. Confirm **no change** to S3 shared-net duplicate in the first slice.  
4. Approve implementation touch list: primarily `commitWire` (+ call graph audit for mistaken `ensureNetByName` on *create* paths only).

**Stop here** — no implementation until freigegeben.