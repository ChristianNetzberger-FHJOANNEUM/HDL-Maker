# A2-P5e — Multi-object property editing

**Status:** **Architecture approved** (28 Nov 2026). **Implementation not released** — after **D5d** baseline + separate freigabe.  
**Id:** **P5e** (do not confuse with **D5e** SVG export on the product roadmap).  
**Related:** [P5 roadmap](diagram-lab-pilot-a2-p5-roadmap.md), [P5d generic circle](diagram-lab-pilot-a2-p5d-generic-circle.md), [D5d prep](d5d-large-diagrams-prep.md) §2.1 (perf hypotheses), `diagram-lab/src/core/transaction.ts` (D5b), `BlockStyle` in `diagram-lab/src/core/document.ts` (P3).

---

## Architecture approval (28 Nov 2026)

Investigation **accepted** with the decisions below. Documentation-only close-out; no code in this slice.

### Approved architecture decisions

| Topic | Decision |
| --- | --- |
| Selection model | Existing `selected: Set<string>` |
| Properties inspector | Extend existing Properties column (no separate batch UI) |
| Property aggregation | `uniform` / `mixed` / `unavailable` |
| Mixed colours | **Placeholder swatch** with “Mixed” label — no tri-state colour dropdown |
| Fill semantics (inspector) | Distinguish **Mixed**, **Transparent** (`fillTransparent`), **Default/inherited** (no stored override), **Uniform explicit** colour — never conflate in aggregation |
| Mixed booleans | Native **`indeterminate`** checkbox |
| Mixed numbers / enums | Appropriate empty / placeholder (“Mixed”) |
| Typography gate (v1) | Unavailable unless **all** selected blocks have non-empty `displayText` |
| Text offset X/Y | **Not in v1** |
| History | One transaction per completed user edit |
| Schema | **No** change |
| Symbol definitions | **Unchanged** by batch instance edits |
| `refreshAll` / perf | Recorded as [D5d hypothesis](#81-d5d-performance-hypothesis-p5e) — **no** optimisation before D5d baseline |
| Implementation | **Locked** until explicit release after D5d investigation |

### Inspector policy (normative)

- Show count of selected blocks (`N objects selected`).
- Never persist mixed state; selection change must not normalize document fields.
- Explicit user edit applies the chosen value to **all eligible** selected blocks in one `edits().execute`.
- One history entry; **undo** restores each object’s prior individual values; **redo** restores the batch result.
- Preserve unrelated properties and non-selected objects; skip history on no-op (existing `transact` / `EditSession` semantics).
- Do not create one full document copy or one history entry **per** selected block.

### Approved v1 property scope

**Include:** P3 appearance (fill, transparent, border, text colour, reset appearance); P1 visibility (`showName`, `showPortNames`, `showDisplayText`); P5a typography + reset when typography gate passes.

**Defer:** text offsets; display text replacement; text format conversion; geometry/resize; instance naming; port management; symbol definition changes; mixed-object selection.

**Later note (non-blocking):** font size on blocks **without** display text today — may be useful for preparing styled blocks; out of v1.

---

## 1. Motivation

Multiple block instances can already be selected together (marquee, Shift-click, Ctrl+A). Drag, duplicate, delete, group, copy/paste, and nudge operate on the full selection.

The Properties panel **does not**: it only renders block fields when **exactly one** block is selected (`oneBlock`). With two or more blocks (and no symbol-editor / port / wire focus), the aside falls through to **sheet-level** controls (e.g. diagram arrow default) only.

The desired capability: edit **shared visual and presentation fields** for all selected blocks in one place, without mutating shared symbol definitions.

---

## 2. Desired inspector behaviour (product)

| State | UI |
| --- | --- |
| All selected blocks share the same stored value | Show that value (colour picker, checkbox, select, number). |
| Values differ | Show **Mixed** (placeholder swatch for colours; **indeterminate** for checkboxes). |
| Property does not apply to every selected object | **Hide** or **disable** the control (document which per property). |

Rules:

- Apply changes **only** after an explicit user edit (change event on control), same as today’s single-block commits.
- Selecting objects must **not** normalize mixed values into the document.
- Mixed is **inspector-only**; it is never serialized.

Header when `selectedBlocks.length ≥ 2`:

`N objects selected` (user mock-up: “6 objects selected”).

---

## 3. Existing implementation inventory

### 3.1 Selection model

| Item | Location | Behaviour |
| --- | --- | --- |
| Canonical selection | `DiagramStage.vue` — `selected: Ref<Set<string>>` | Block **ids** only. |
| Multi-select | Marquee, Shift additive toggle on block click, Ctrl/Cmd+A (`selected = all block ids`), drag moves all selected origins. | Port/segment selection cleared on many block operations. |
| Resize handles | `handles: selected.size === 1 && …` on flow nodes | Geometry resize stays single-block (P5d uniform resize policy unchanged). |
| Nudge / duplicate | `onNudge`, `duplicateSelection`, `onDragStop` | Already loop over `[...selected]` or captured origin map. |

No separate “selection manager” module — aggregation can be a **pure function** over `doc.blocks` filtered by `selected`.

### 3.2 Properties inspector

| Item | Location | Behaviour |
| --- | --- | --- |
| Single-block gate | `oneBlock = computed(() => selected.size === 1 ? … : null)` | Entire block template is `v-else-if="oneBlock"`. |
| Multi-block fallback | `v-if="!activeSymbol && !oneBlock"` (first branch) | Diagram-wide arrow default only — **not** a multi-block panel. |
| Wire inspector | `selectedNet && !activePort && !oneBlock` | Can show alongside empty multi-block state; future mixed S1/S2 must define priority. |
| Commit handlers | `commitBlockFill`, `commitBlockVisibility`, `commitBlockTypography*`, … | Each reads `oneBlock` and calls `edits().execute` once for **one** id. |
| Effective UI defaults | `blockFillPickerValue`, `blockStrokePickerValue`, `blockTextPickerValue` | Picker shows `#ffffff` / `#243140` / `#1c2430` when `style` fields absent — **display** defaults, not stored values (important for mixed detection). |

Symbol editor and port instance panels are unrelated code paths (`activeSymbol`, `activePort`).

### 3.3 Canonical block edit operations (core)

All live in `diagram-lab/src/core/edit.ts` (framework-free). Safe for batch loops inside **one** `execute` / `transact` callback.

| Operation | Function | Touches symbol definition? | Calls `refreshAll`? |
| --- | --- | --- | --- |
| P3 colours | `setBlockStyle(doc, blockId, patch)` / `resetBlockStyle` | **No** — instance `block.style` only | **Yes** (every call) |
| P1 visibility | `setBlockFields(… showName / showPortNames / showDisplayText)` | No | Yes if geometry fields; **yes** even for visibility-only today |
| P2 display text | `setBlockFields(… displayText)` | No | Yes |
| P5a typography | `setBlockTypography`, `resetBlockTypography`, `setBlockTextFormat` | No | Yes when changed |
| P3a offset | `setDisplayTextOffset` | No | **No** (caller should not rely on net refresh) |
| Geometry | `setBlockFields(… x/y/width/height)` | No | Yes + stub delta logic |

**Instance ownership (P5d-Fix3):** batch style/visibility edits must only touch `Block` rows. They must **not** call `addSymbolPort`, `applySymbol`, or library publish paths.

**Renderer contract:** `BlockNode.vue` maps `appearance` → `bodyFill` / `bodyStroke` / caption colour; plain boxes use CSS background. Missing `style` ⇒ library/symbol default paint (not the same as inspector picker defaults).

### 3.4 History and transactions

| Mode | Mechanism | One user action ⇒ one history entry? |
| --- | --- | --- |
| Standalone sheet | `EditSession` (`session.ts`) | `execute()` pushes one snapshot, then applies callback. **Loop inside one callback = one undo step.** |
| Open project | `TransactionManager.transact('Edit', …)` via `projectSheetAdapter` (`DiagramStage.vue`) | Same: one project snapshot before/after one transact. |
| Gestures | `begin` / `preview` / `commit` | Multi-block **move** already one gesture for all blocks. |

`selfcheck` and P1/P3 tests already prove: multiple field changes inside one `session.execute` undo together.

**Undo restoration:** Full document (or project) snapshot — restores **per-block** distinct values automatically; no special batch undo structure required.

**Caveat:** Project history stores **entire project JSON** per step (D5b). Batch fill on 500 blocks is still **one** entry, but the snapshot is large. Acceptable for P5e; D5d may later want lighter patch history (out of scope).

### 3.5 Vue reactivity and updates

- Inspector reads `doc` (active sheet) and `selected` — aggregation should be `computed` from those refs, no mirrored block copies.
- Each `edits().execute` ends with `rebindAfterProject()` when a project is open; `refreshHistory()` updates undo labels in the UI.
- Math/markdown previews are wired to `oneBlock` watchers — multi-select should **not** spin up N previews; hide preview sections unless single selection.

### 3.6 What already multi-selects but is not “property editing”

| Feature | Batch? |
| --- | --- |
| Move / nudge / duplicate / delete | Yes |
| Group / ungroup | Yes |
| Copy/paste fragment | Yes |
| Inspector appearance / typography | **No** |

---

## 4. Gap analysis — minimal changes

| Layer | Change |
| --- | --- |
| **Core** | Add `aggregateBlockProperty` helpers + optional `applyBlocksPresentationPatch(doc, blockIds, patch)` that applies N blocks then **one** `refreshAll` (see §8). No schema change. |
| **View** | `selectedBlocks` computed; new template branch `v-else-if="selectedBlocks.length >= 2"` **before** or **instead of** falling through to sheet-only hints; generalise commit handlers to target id list. |
| **Controls** | Mixed-capable colour inputs, checkbox tri-state or select `On | Mixed | Off` for booleans (user mock-up). |
| **Tests** | `selfcheck` batch undo + mixed aggregation unit tests; browser checklist P5e-S1… |

**Explicit non-goals for v1:** mixed block+wire selection, port batch direction, symbol definition batch, Format Painter.

---

## 5. Property compatibility (initial scope)

Legend: **Batch** = intended in P5e v1; **Defer** = later; **No** = excluded.

| Property | Batch v1 | Aggregation key | Unavailable when | Apply via |
| --- | --- | --- | --- | --- |
| Fill colour | Yes | `style.fill` + `fillTransparent` | — | `setBlockStyle` |
| Transparent fill | Yes | `style.fillTransparent` | — | `setBlockStyle` |
| Border colour | Yes | `style.stroke` | — | `setBlockStyle` |
| Display text colour | Yes | `style.text` | — | `setBlockStyle` |
| Reset appearance | Yes | `style` object presence | No block has `style` → disable button | `resetBlockStyle` each |
| Show instance name | Yes | effective `showName !== false` | — | `setBlockFields` |
| Show port names | Yes | effective `showPortNames !== false` | — | `setBlockFields` |
| Show display text | Yes | effective `showDisplayText !== false` | — | `setBlockFields` |
| Font size | Yes | `fontSize` with default 12 for display | **Any** selected block lacks non-empty `displayText` | `setBlockTypography` |
| Text alignment | Yes | `textAlign` with format default | Same as font size | `setBlockTypography` |
| Reset typography | Yes | typography fields set | Same gate as font size | `resetBlockTypography` |
| Text offset X/Y | Investigate | `displayTextOffset` | Not all have display text / all hidden | `setDisplayTextOffset` |
| Text format | Defer | `textFormat` | Risky (LaTeX invalidates plain) | — |
| Display text body | Defer | `displayText` | Per-instance semantics | — |
| Width / height | Defer | geometry | `resizeAspect` (circle) vs free rectangle | `setBlockFields` + policy |
| Instance name | Defer | `name` | Uniqueness / HDL naming | — |
| Ports add/delete | No | — | — | — |
| Symbol assignment | No | — | — | — |
| Net / port ids | No | — | — | — |

**Cross-type blocks:** Generic Circle, Adder, plain `sym_block`, and boundary-style blocks all expose the same `Block` fields — aggregation compares **stored** fields, not symbol family. **No** Generic Circle-specific batch logic.

**Mixed vs “looks the same”:** Two blocks with **no** `style.fill` can look different on screen (symbol palette vs plain box). Aggregation must compare **canonical serialized fields** (and effective booleans), not rendered pixels.

Suggested comparators:

```ts
export type AggregatedProperty<T> =
  | { state: 'uniform'; value: T }
  | { state: 'mixed' }
  | { state: 'unavailable' }
```

Implement small readers per property, e.g. `readBlockShowName(block): boolean` ⇒ `block.showName !== false`.

---

## 6. Proposed architecture

```
┌─────────────────────┐
│ Selection (Set<id>) │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐     derive only (Vue computed)
│ Property aggregation │ ◄── aggregateBlockProperties(doc, ids)
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Properties inspector │◄── existing controls + Mixed UX
└──────────┬──────────┘
           │ user edit
           v
┌─────────────────────┐
│ edits().execute     │◄── one callback: for (id of ids) apply*
│ (EditSession / TM)  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Document (+ project)│◄── single history snapshot
└─────────────────────┘
```

**Batch edit transaction pattern (required):**

```ts
edits().execute((draft) => {
  for (const id of selectedIds) {
    setBlockStyle(draft, id, { fill: '#fff4cc', fillTransparent: false })
  }
  // optional: single refreshAll if helpers stop calling it per block
})
refreshHistory()
```

**Preserve untouched fields:** Only call the same mutators as single-block commits; never “clear then set” on unrelated fields.

**Never modify definitions:** Do not import batch path into symbol editor `addSymbolPort` / `applySymbol`.

---

## 7. Mixed-state UI notes (approved)

| Control type | Mixed behaviour |
| --- | --- |
| Fill colour | Visually distinct **placeholder swatch** + “Mixed” (not a dropdown). Picking a colour sets uniform fill on all selected blocks (clears mixed). **Undo** restores individual fills. |
| Transparent fill | Checkbox or dedicated control — orthogonal to Mixed; represents stored `fillTransparent: true` when uniform. |
| Default / inherited fill | When all blocks lack an explicit `style.fill` and are not uniformly transparent — show **Default** (not Mixed). Compare **canonical stored fields**, not rendered pixels (symbol vs plain block may differ visually). |
| Border / text colour | Same placeholder pattern as fill when values differ; distinguish absent `style` from explicit mixed. |
| Checkbox visibility | HTML **`indeterminate`** when effective booleans differ; user toggle clears indeterminate and applies to all. |
| Number (font size) | Blank + placeholder `Mixed`; commit sets all gated blocks. |
| Reset buttons | Enabled when any selected block has resettable state (appearance) or gated typography overrides exist. |

**Never** persist `mixed` or any inspector sentinel in the document. User mock-up: four blocks, fill “Mixed”, one colour choice → uniform; one undo → four distinct colours.

---

## 8. Performance considerations (D5d-aligned)

| Issue | Today | P5e recommendation |
| --- | --- | --- |
| `setBlockStyle` / visibility `setBlockFields` call `refreshAll` | Re-routes **every** segment on each call | Add internal `refresh?: boolean` or `applyBlocksStyle(doc, ids, patch)` that mutates all styles then **one** `refreshAll` — or skip `refreshAll` entirely when **no** geometry field changed (style-only). |
| 500 × history | N/A | Still **one** `execute` — good. |
| 500 × snapshot size | Project undo copies whole project | Accept for v1; note in D5d benchmark scenarios later. |
| Vue Flow node update | `flowNodes` computed maps all blocks | Style change only updates props — acceptable. |

Style-only batch edit should **not** trigger net geometry work once core helpers are adjusted (**after** D5d measures dependencies — see below).

### 8.1 D5d performance hypothesis (P5e)

| Scenario | Naive per-block `setBlockStyle` | Target (post-D5d, if validated) |
| --- | --- | --- |
| 500 blocks, one batch colour edit | **500** × `refreshAll` (full segment re-route each call) | **0** if style-only needs no net geometry; else **1** × `refreshAll` per batch transaction |

This is a **counting hypothesis** for the D5d campaign — not measured runtime yet. **Do not** change `edit.ts` refresh behaviour until D5d baseline + dependency review. Cross-reference: [d5d-large-diagrams-prep.md §2.1](d5d-large-diagrams-prep.md#21-editor-mutator-hypotheses-d5d-measurement).

**Preferred future shape (implementation release only):** verify which mutators truly require `refreshAll`; omit or batch for purely visual `Block` patches.

---

## 9. Proposed minimal implementation slices

| Slice | Contents |
| --- | --- |
| **P5e.0** | `blockAggregate.ts`: property readers + `aggregateProperty(blocks, pick, isEqual)`. |
| **P5e.1** | Core batch helpers; refresh policy per D5d findings (0 or 1 × `refreshAll` per batch); selfcheck: 3 blocks, 3 colours → one yellow → one undo → 3 colours back. |
| **P5e.2** | Inspector: multi header + P3 colours + transparent + reset appearance. |
| **P5e.3** | P1 visibility booleans (tri-state). |
| **P5e.4** | P5a typography when all have display text. |
| **P5e.5** | Browser checklist sign-off. |

Estimated effort: **low–medium** if refresh consolidation is included in P5e.1; otherwise medium due to per-block `refreshAll` cost.

---

## 10. Self-check criteria (proposed)

Add to `selfcheck.ts` (names indicative):

| Id | Assertion |
| --- | --- |
| P5e-A1 | Three blocks, distinct `style.fill`; one `execute` sets uniform fill; serialize round-trip preserves. |
| P5e-A2 | Same scenario: one `undo` restores three distinct fills. |
| P5e-A3 | `aggregateProperty` reports `mixed` for differing `showPortNames`. |
| P5e-A4 | `aggregateProperty` reports `uniform` when all omit `style` and effective visibility true. |
| P5e-A5 | Batch `setBlockStyle` on N blocks triggers at most **one** `refreshAll` (after refactor) — optional perf guard. |
| P5e-A6 | Batch edit does not change `doc.symbols[*].ports` length. |

---

## 11. Browser acceptance checklist (proposed)

Manual **P5e-S1…S12** after implementation:

| # | Scenario |
| --- | --- |
| S1 | Select 2+ circles with different fills — inspector shows “N objects selected”, fill = Mixed. |
| S2 | Set uniform fill — all update; one undo restores individuals. |
| S3 | Toggle transparent fill on mixed selection. |
| S4 | Border + text colour batch. |
| S5 | Reset appearance on subset that had overrides only. |
| S6 | Mixed show port names → set On/Off → per-block flags correct. |
| S7 | Include block **without** display text — font size control disabled/unavailable. |
| S8 | All with display text, mixed font sizes → set size → uniform; undo restores. |
| S9 | Selection spans symbol + plain block — same P3 fields work. |
| S10 | 20+ blocks colour change — responsive; no multi-step undo. |
| S11 | Project open — batch edit uses project undo stack (one step). |
| S12 | Save/load preserves per-block differences after batch edit. |

---

## 12. Roadmap placement (binding order, 28 Nov 2026)

| Step | Package | Status |
| --- | --- | --- |
| 1 | **P5d** manual acceptance | **Done** (14/14 + F3 9/9) |
| 2 | Git checkpoint (P5d implementation) | **Done** (28 Nov 2026) |
| 3 | **P5e** architecture approval | **Done** (this document) |
| 4 | BPSK demonstrator 2 | Planned |
| 5 | D5d performance investigation (incl. §8.1 hypothesis) | Planned |
| 6 | **P5e implementation** | **Locked** — explicit release only |

P5e does not block P5d close-out. Implementation must **not** start before D5d baseline and a separate implementation freigabe.

---

## 13. Future extensibility (design only)

| Selection | Shared properties (later) |
| --- | --- |
| Multiple segments | Stroke colour, width, dash, arrow overrides |
| Multiple labels / free text | Font size, colour, alignment |
| Multiple ports | Direction, bus width |
| Mixed types | Intersection of per-type schemas — needs **S1/S2 mixed selection** UX |

Keep aggregation **type-tagged** (`kind: 'block' | 'segment' | …`) so P5e block code does not block wire batch styling.

---

## 14. Risks and resolved decisions

| Topic | Decision (28 Nov 2026) |
| --- | --- |
| Colour mixed UX | **Approved** — placeholder swatch + “Mixed” |
| Fill aggregation | **Mixed / Transparent / Default / Uniform** — four distinct inspector/logic states |
| Typography gate | **Approved** — all must have display text in v1 |
| Text offset batch | **Deferred** from v1 |
| `refreshAll` | **D5d hypothesis** — optimise only after baseline |
| Wire + multi-block inspector | Defer to mixed selection S1/S2 |

---

## 15. Investigation conclusion

| Question | Answer |
| --- | --- |
| Architecturally feasible? | **Yes** — selection, mutators, and single-step history already support multi-target edits (cf. nudge, delete). |
| Separate batch UI required? | **No** — extend Properties column. |
| Touches symbol definitions? | **No** — if only instance `setBlockStyle` / `setBlockFields` are used. |
| Minimal core work | Aggregation helpers + optional single `refreshAll` batch path. |
| Main UI work | Multi template branch + mixed controls + generalise commits. |

**Architecture approved; implementation gated.** No code, commit, or push from this approval slice.

---

## 16. Key source references

| Area | Path |
| --- | --- |
| Selection + inspector | `diagram-lab/src/view/DiagramStage.vue` (`selected`, `oneBlock`, `commitBlock*`, aside template ~5564+) |
| Block schema | `diagram-lab/src/core/document.ts` (`Block`, `BlockStyle`) |
| Mutators | `diagram-lab/src/core/edit.ts` |
| Segment refresh | `diagram-lab/src/core/geometry.ts` (`refreshAll`, `moveBlock`) |
| Sheet history | `diagram-lab/src/core/session.ts` (`EditSession.execute`) |
| Project history | `diagram-lab/src/core/transaction.ts`, `projectSheetAdapter` in `DiagramStage.vue` |
| Rendering | `diagram-lab/src/view/BlockNode.vue`, `SymbolFace.vue` |