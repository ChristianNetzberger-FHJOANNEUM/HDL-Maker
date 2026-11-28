# P5d-Fix3 — Symbol definition vs. instance port ownership (investigation)

**Status:** **Closed and accepted** (28 Nov 2026). **F3-1…F3-9: 9/9**; **P5d-S1…S14: 14/14**. [P5d close-out](diagram-lab-pilot-a2-p5d-generic-circle.md#12-close-out).  
**Context:** P5d-Fix1/Fix2 visually accepted; **instance independence** fails when adding ports on sheet.  
**Related:** [P5d spec](diagram-lab-pilot-a2-p5d-generic-circle.md), [ADR symbol geometry](adr-symbol-geometry-and-port-guides.md), [A2-P1 connections](diagram-lab-pilot-a2-p1-symbol-connections.md).

---

## 1. User observation (confirmed by code review)

Two **Generic Circle** instances from the library share one embedded definition (`sym_generic_circle` in `doc.symbols`). Adding a port on instance **A** also materialises the same new symbol pin on instance **B**.

This contradicts the desired **configurable generic symbol** semantics: artwork and guides are shared; **port count, angles, names, and directions are per instance**.

---

## 2. Root cause (verified)

### 2.1 Not shared mutable port objects

Instance records are separate `Port` rows (`createId('prt')` per block in `instantiateSymbol`). Wires cite **instance** `port.id`, not symbol pin ids directly on the sheet.

The bug is **not** aliasing of JavaScript objects between instances.

### 2.2 Primary mechanism: definition mutation + `applySymbol`

| Step | What happens |
| --- | --- |
| Place from library | `adoptLibrarySymbol` embeds **one** `SymbolDefinition` per library id; each `instantiateSymbol` creates instance ports with `symbolPortId` → definition pin id. |
| P5d-Fix1 `addPortAt` (guided) | Calls **`addSymbolPort(doc, symbol.id, …)`** → appends pin to **`symbol.ports`** (definition). |
| Sync | **`applySymbol(doc, symbolId)`** runs for **every** `block` with that `symbolId`: missing symbol pins become new instance ports on **all** blocks (respecting `suppressedPins` / component rules). |

**File evidence:** `edit.ts` (`addPortAt` guided branch), `symbols.ts` (`addSymbolPort`, `applySymbol`).

P5d-Fix1 correctly fixed guided **geometry** but chose the **definition-edit** code path intended for symbol authoring / library revision, not per-instance sheet editing.

### 2.3 Secondary: collision pick uses definition pins

`pickAvailableGuideU(symbol.ports, …)` in Fix1 considers angles of **definition** pins only. Even after instance-local add, angle spacing is definition-centric.

### 2.4 What already works per instance (partial model C)

The data model already supports **instance overrides** without touching the definition:

| Field / op | Scope | Used for |
| --- | --- | --- |
| `Port.guideU` | Instance | Angular position override for an **existing** guided symbol pin (`placeGuidedPort`) |
| `Port.direction` | Instance | P5b override |
| `Port.placed` + `side`/`t` | Instance | Extra ports on **rectangular** blocks (`addPortAt` without guides) — independent per block |
| `Port.name` | Instance | `renameInstancePort` (when not `interfacePortId`) |
| `removeUnwiredPort` | Instance | Removes one instance port; `hideSymbolPin` suppresses symbol pin on **that** block only |
| `Block.style`, `displayText`, size | Instance | Already independent |

**Gap:** No supported path for **instance-only guided ports** (no new `symbolPortId`, but on ellipse guide with radial lead).

### 2.5 Existing mitigations (not automatic)

| Mechanism | Behaviour | Fit for generic circle |
| --- | --- | --- |
| **`detachInstance`** (`migration.ts`) | **Copy-on-write (B):** clones entire symbol; one block gets new `symbolId`. | Manual; forks whole definition; user must know to use “Separate definition”. |
| **`makeUnique`** (`hierarchy.ts`) | Component hierarchy only; duplicates implementation + bindings. | N/A for flat library blocks. |
| **Symbol Editor `addSymbolPort`** | Always definition-level → all instances. | Correct for **library authoring**, wrong for instance add on sheet. |

### 2.6 Affected operations today (shared definition)

| Operation | Entry point | Affects other instances? |
| --- | --- | --- |
| **Add port (sheet, guided)** | `addPortAt` → `addSymbolPort` | **Yes** — all instances |
| **Add port (symbol editor)** | `addSymbolPort` | **Yes** |
| **Remove symbol pin** | `removeSymbolPort` | **Yes** — `applySymbol`; wired ports diagnosed |
| **Move guided port (sheet)** | `placeGuidedPort` | **No** — `guideU` on instance |
| **Move symbol pin (editor)** | `moveSymbolPort` | **Yes** |
| **Rename port (sheet)** | `renameInstancePort` | **No** (unless `applySymbol` resets name from def — skips if `interfacePortId`; syncs from def for bound ports **without** `placed`) |
| **Port direction** | `setPortDirection` | **No** — instance field |
| **Remove unwired port** | `removeUnwiredPort` | **No** on other blocks |
| **Resize block** | `setBlockFields` | **No** |
| **Add port (generic rect, no guide)** | `addPortAt` → `placed: true` | **No** |

**Conclusion:** The defect is **architectural policy**, not circle-specific rendering. Any **shared** embedded symbol with guided ring hit by Fix1’s `addPortAt` path behaves the same (would affect a second Adder on the same sheet if users used sheet add-port — uncommon but possible).

---

## 3. Current ownership model (as implemented)

```text
Library (builtin)          Document embed (once per sym id)     Block instances
─────────────────         ────────────────────────────────     ───────────────
sym_generic_circle   →    doc.symbols[id=sym_generic_circle] → Block A, Block B
  ports: in, out              ports: in, out (+ user adds)         ports[] with symbolPortId
  guides, shapes                same guides/shapes                  guideU?, direction?, placed?
```

- **Electrical identity:** instance `Port.id` (wires, nets).  
- **Graphic template:** shared `SymbolDefinition` (shapes, guides, default `SymbolPort` list).  
- **Binding:** `Port.symbolPortId` → `SymbolPort.id`.

**Designed split (A2-P1):** Definition supplies default **u**; instance **`guideU`** overrides angle **without** rewriting the library.

**Missing split (P5d product):** Definition supplies **default port set** at place time; **additional** ports exist only on chosen instances.

---

## 4. Architecture alternatives

### A — Shared definition mutation (status quo after Fix1)

- **Principle:** All instances of `symbolId` stay mirrors of `symbol.ports`; `applySymbol` propagates.
- **Pros:** Simple; matches symbol-editor / library revision workflow; one pin id namespace per definition.
- **Cons:** **Unacceptable** for configurable generic blocks (user requirement).

### B — Copy-on-write symbol definitions

- **Principle:** First instance-specific edit calls `detachInstance` (or automatic variant): new `sym_*`, block repointed; other instances keep old def.
- **Pros:** Reuses `detachInstance`; symbol editor continues to edit “this instance’s” def; minimal new geometry code.
- **Cons:** Proliferation of `sym_*` defs in `doc.symbols`; angle/name changes to “default” pins still live on def unless every instance is detached; library compare/update complexity; **auto-CoW** on first add-port surprises users who expected implicit sharing.

### C — Instance-owned port configuration (recommended if achievable)

- **Principle:** Shared **artwork + guides** on `SymbolDefinition`; **port list for connectivity** primarily on `Port` records per `blockId`. Definition ports = **initial template** only at `instantiateSymbol`.
- **Add guided port on sheet:** append **instance** `Port` with `guideU` (and `side`/`t` hints), **no** `symbolPortId`, **no** `addSymbolPort`.
- **Geometry:** Reuse `symbol.guides` + `guidedPinPoint` / `radialLeadSegment` via **synthetic** pin descriptor or `portAnchor` branch (instance guided port).
- **Pros:** Matches user table (§1); no extra symbol defs; library stays one generic circle; copy/paste already clones `Port[]` per block.
- **Cons:** Requires targeted changes in anchor, lead, drag, serialization, and tests; must distinguish **fixed-interface** symbols (adder in library edit) vs **configurable** symbols.

**Recommendation:** **Variant C** for **configurable generics** (`sym_generic_circle`, future generic polygon, arguably `sym_block`). Retain **definition mutation** when editing in **Symbol Editor** or publishing library revisions. Optionally gate with `SymbolDefinition.portPolicy?: 'instance' | 'shared'` (default `'shared'` for backward compatibility) rather than hard-coding ids.

---

## 5. Schema and compatibility (variant C)

| Topic | Proposal |
| --- | --- |
| **New persisted fields** | Prefer **none**: instance guided add uses existing `Port.guideU` + absent `symbolPortId` + existing `side`/`t`/`name`. Optional `portPolicy` on symbol only. |
| **Backward compatibility** | Documents saved after Fix1 may have **extra definition pins** visible on all instances — **no silent migration**; users delete stray ports or use suppress/remove per block; optional future “shrink definition to defaults” tool out of scope. |
| **Port id ownership** | Unchanged: wires keep `port.id`. |
| **Serialization** | Instance-only ports already round-trip; extend selfcheck for guided instance ports without `symbolPortId`. |
| **Library export** | Builtin library unchanged; user saves symbol **definition** still exports `SymbolPort[]` as today. |
| **Hierarchy / `interfacePortId`** | Unchanged: bound ports follow component interface; instance-only extras stay local (no `interfacePortId`). |
| **Fixed-interface symbols** | D-FF, gates, Adder **library** editing remains definition-level (`shared`); sheet add-port on Adder could stay disabled or CoW — product choice. |

---

## 6. Required future behaviour (acceptance target)

For instances **A** and **B** of Generic Circle (same embedded template):

| Action on A | B |
| --- | --- |
| Add guided port | Unchanged port set |
| Remove unwired port | Unchanged |
| `placeGuidedPort` | Unchanged |
| Rename / direction | Unchanged |
| Resize A | Unchanged |
| New place from library | Default **in/out** only (definition template), not A’s extras |
| Copy A | Clone carries A’s **instance** ports; independent after copy |
| Undo/redo | Only A’s document delta |

Preserve: Fix1 guide geometry, Fix2 interior labels, S5b.2, stubs, nets, `resizeAspect`.

---

## 7. Implemented correction (P5d-Fix3)

| Piece | Location |
| --- | --- |
| `SymbolDefinition.portPolicy` | `document.ts` — `'instance' \| 'shared'`; default `shared` |
| Generic circle | `catalog.ts` — `portPolicy: 'instance'` |
| Sheet add port | `edit.ts` `addPortAt` — instance policy → `Port` with `guideU`, no `addSymbolPort` |
| Geometry | `geometry.ts` — `resolveGuidedPortModel`, `syntheticRadialGuidedPin`, `blockGuideUValues` |
| Render / drag | `DiagramStage.vue` — leads, labels, `guidedPortContext` via `resolveGuidedPortModel` |
| `applySymbol` | Unchanged removal semantics; instance-only ports (no `symbolPortId`) already preserved |
| Tests | `selfcheck` Fix3-R1…R8 + shared adder regression |

**Defective Fix1 saves:** definition may still contain extra pins; manual cleanup per §7 investigation doc (no auto-migration).

---

## 7a. Original minimal correction sketch (superseded)

1. **`portPolicy`:** Set `portPolicy: 'instance'` on `sym_generic_circle` in catalog (and document embed on adopt). Default `'shared'` elsewhere.
2. **`addPortAt`:** If block’s symbol has `portPolicy === 'instance'` and guided ring:
   - Create instance `Port` with projected `guideU`, `pickAvailableGuideU` over **that block’s** guided ports (instance `guideU` + definition pins).
   - **Do not** call `addSymbolPort`.
3. **`portAnchor` / `radialLeadSegment` / `guidedPortLabelPlacement`:** Resolve instance-only guided ports using symbol guides + `port.guideU`.
4. **`guidedPortContext` / drag:** Allow drag when `guideU` set without `symbolPortId`.
5. **Remove:** Instance-only guided removal via existing `removeUnwiredPort`; definition pin remove only in symbol editor.
6. **Revert** Fix1 regression in selfcheck (two-instance independence tests).

**Alternative minimal path (B):** Auto-`detachInstance` on first instance-specific port add — smaller diff but worse long-term symbol table hygiene; not recommended.

---

## 8. Proposed regression tests (selfcheck)

| ID | Assertion |
| --- | --- |
| Fix3-R1 | Two `sym_generic_circle` instances; `addPortAt` on A → B port count unchanged |
| Fix3-R2 | New port on A is guided (`guideU`, radial lead, interior label) without new `symbol.ports` entry |
| Fix3-R3 | `placeGuidedPort` on A does not change B `guideU` |
| Fix3-R4 | `duplicateBlocks` / paste copy customized ports only on copy |
| Fix3-R5 | Fresh `placeLibrarySymbol` → default 2 ports only |
| Fix3-R6 | Save/load: A and B port sets differ as saved |
| Fix3-R7 | `sym_block` `addPortAt` still instance `placed` (regression) |
| Fix3-R8 | Symbol editor `addSymbolPort` on shared Adder still updates all adder instances (shared policy) |
| Fix3-R9 | Undo add port on A restores B unchanged |

---

## 9. Symbol categories (product alignment)

| Category | Examples | Port edits on sheet | Port edits in symbol editor |
| --- | --- | --- | --- |
| **Configurable generic** | Generic block, Generic circle, future generics | **Instance (C)** | Affects definition (authoring) |
| **Fixed functional** | D-FF, MUX, future Python block | View/bind only | Definition / library revision |
| **Decorative** | Ellipse, text | N/A | N/A |

HDL/Python: component **interface** remains definition-bound; generic circles on sheet are **not** components until extract — instance ports stay sheet-local.

---

## 10. Manual acceptance — F3-1…F3-9 — **9/9 accepted** (28 Nov 2026)

| ID | Case | Expected |
| --- | --- | --- |
| F3-1 | Two Generic circles | Each has default `in` / `out` only |
| F3-2 | Add several ports on A | B unchanged; definition pins unchanged |
| F3-3 | Remove unwired port on A | B unchanged |
| F3-4 | Move / rename / direction on A | B unchanged |
| F3-5 | Place third instance C | Defaults only (2 ports) |
| F3-6 | Copy / Shift+Drag A | Custom ports on copy; edit copy ≠ original |
| F3-7 | Wires on B | Unaffected by A edits |
| F3-8 | Undo/redo | Instance-local |
| F3-9 | Save/load | Independent port sets preserved |

---

## 11. P5d status after Fix3

| Item | State |
| --- | --- |
| Circle geometry, Fix1 guided add (geometry) | **Accepted** |
| Fix2 labels | **Accepted** |
| Instance independence (Fix3) | **Accepted** — F3 **9/9** |
| Full P5d-S1…S14 | **Accepted** — **14/14** |

---

## 12. One-line summary

**Root cause: P5d-Fix1 routes sheet “add port” through `addSymbolPort` + `applySymbol`, mutating the single embedded definition shared by all instances; fix by instance-owned guided ports (variant C) with optional `portPolicy`, not by circle-only rendering.**