# Diagram-Lab — Selection and stub-aware copy investigation

**Status:** Analysis and specification only. **No implementation release.**  
**Trigger:** D5d.0-A stub-move acceptance; user observations on marquee, cumulative select, and Shift+Drag without stubs.  
**Constraints:** No code changes; no performance optimisations; D5d.0-B–D closed; D5c.7 remains deferred; no roadmap reorder; no commit/push.

---

## 1. Executive verdict

| Question | Answer |
| --- | --- |
| Should the UI offer cumulative mixed selection? | **Yes** — foundational editor capability; currently incomplete. |
| Should marquee select wires? | **Yes** — current block-only marquee is a real limitation. |
| Should block copy / Shift+Drag include attached Port↔Free stubs? | **Yes** — implicit copy closure; **S3 implemented** ([d5d0a-s3-stub-aware-copy.md](d5d0a-s3-stub-aware-copy.md)). |
| Product sequencing (accepted) | **S3 → S4 → D5d.0 campaign → S1/S2 later; D5c.7 stays deferred.** |

Preferred long-term UX (agrees with product intent): **select blocks and wires cumulatively**, and **when copying a block, optionally take its attached stubs automatically** without forcing those stubs into the explicit selection set.

---

## 2. Current feature matrix (verified in code)

### 2.1 Selection state (not one model)

| Store | Type | Holds |
| --- | --- | --- |
| `selected` | `Set<string>` | **Block ids only** |
| `selectedSegment` | `string \| null` | **At most one** segment |
| `selectedPort` | `string \| null` | One port (inspector / port ops) |
| `selectedStroke` | `string \| null` | One freehand stroke |
| Vue Flow selection | disabled | `elements-selectable=false`, `selection-key-code=null`, `multi-selection-key-code=null` |

**Blocks + wires cannot coexist** in one selection today: wire hit clears `selected` (`onSpanDown`). Multi-wire selection does not exist.

| Object | Click-select | Multi | Marquee | Notes |
| --- | --- | --- | --- | --- |
| Blocks | Yes | Partial (Shift) | Yes (AABB intersect) | Canonical for move/copy/delete |
| Wire segments | Yes (single) | **No** | **No** | Clears block selection |
| Junctions | Drag only | No | No | Not a selection target |
| Labels | Drag (D5c.1) | No | No | Selects owning segment |
| Ports | Yes (separate ref) | No | No | Correct: belong to block |
| Strokes | Yes (single) | No | No | Parallel to segment |

### 2.2 Modifier / gesture inventory

| Input | Current behaviour | Code |
| --- | --- | --- |
| Click block | Replace selection with that block **only if not already selected**; if already selected, leave multi-set intact (drag-friendly) | `onNodeClick` |
| **Shift+Click block** | **Toggle** membership (add or remove) | `onNodeClick` |
| **Ctrl/Cmd+Click block** | **Not handled** for selection | — |
| Shift+Drag block | **Duplicate** (D5c.6); `<4px` cancels | `blockDragMode`, `duplicateDragMoved` |
| Marquee L→R or R→L | Same rule: block AABB **intersection** (crossing-like); no window/crossing split | `onStagePointerUp` |
| Shift+Marquee | **Add** hit blocks to selection | `box.shift` |
| Ctrl+Marquee | Not handled | — |
| Click empty (tiny marquee) | Clear selection unless Shift | `onStagePointerUp` |
| Wire LMB | Select that segment only; clear blocks; may start span drag | `onSpanDown` |
| Esc | Cancel gesture → Select tool → clear selection (D5c.2) | `nextEscapeAction` |

**Conflict already managed:** Shift+Click multi-select vs Shift+Drag duplicate via movement threshold (`duplicateDragMoved`, 4 px). Marquee starts only on empty canvas (not on nodes/hits).

### 2.3 Copy inventory

| Path | API | What is copied | Stubs Port↔Free | Net policy |
| --- | --- | --- | --- | --- |
| Ctrl/Cmd+C / V | `captureFragment` / `pasteFragment` | Selected **blocks** + Port↔Port wires with **both** ends in selection + their labels | **Omitted** | **New net ids**, display names reused → can create same-name / different-id pairs |
| Ctrl/Cmd+D | `duplicateBlocks` | Same as above | **Omitted** | New net ids, names reused |
| Shift+Drag | `duplicateBlocks` in preview/commit | Same | **Omitted** | Same |
| Wire-only Ctrl+C | — | **Nothing useful** | — | Gap → **D5c.7** deferred |

Relevant filters (both omit free ends):

```text
segment.start.kind === 'port' && segment.end.kind === 'port'
&& both ports’ blocks ∈ selection
```

### 2.4 Delete vs implicit stubs

| Operation | Attached Port↔Free stubs |
| --- | --- |
| `deleteBlocks` | **Removed** (any segment touching deleted ports) — already correct |
| Block move | Rigid translate — **done** (D5d.0-A stub-move) |
| Resize / port drag | Still rubber-band free ends — open |

Implicit attachment is already derivable: `isBlockAttachedStub(doc, segment, blockId)` (Port↔Free, either orientation). **No ownership field required.**

### 2.5 Marquee detail

Documented backlog already matches code (`diagram-editor-usability-backlog.md`): marquee = blocks whose boxes meet the rectangle; wires/junctions/labels/strokes excluded. Direction L→R vs R→L is **not** implemented (always intersection).

---

## 3. Modifier-key conflict analysis

| Modifier | Today | Proposed (product) | Risk |
| --- | --- | --- | --- |
| **Shift+Click** | Toggle block | **Add** to selection | Behaviour change; break muscle memory of current toggle |
| **Ctrl/Cmd+Click** | Unused for select | **Toggle** | Low conflict; free |
| **Shift+Drag on block** | Duplicate | Keep | Must stay: distinguish click vs drag (≥4 px) |
| **Shift+Marquee** | Add blocks | Keep / extend to wires | Low |
| **Ctrl+Marquee** | — | Toggle hits | New; OK |
| **Space+LMB** | Pan | Unchanged | No change |
| **MMB** | Pan | Unchanged | No change |

**Recommendation:** Adopt product table (Shift=add, Ctrl=toggle) and treat current Shift-toggle as a **breaking UX change** to document in the selection slice acceptance. Keep Shift+Drag duplicate unchanged.

Click vs Drag must remain unambiguous: pointer down on block → if movement &lt; threshold and Shift held → selection gesture only; if movement ≥ threshold → move or duplicate per `blockDragMode`.

---

## 4. Relationship to D5c.7 and D5c.3/D5c.5/D5c.6

| Concern | Belongs to | Notes |
| --- | --- | --- |
| Wire-only copy of selected segment as orphan stub + keep name | **D5c.7** (deferred, recommended B+C1+D1) | Explicit selection of wires |
| Marquee / multi-select of wires | **Selection slice** (new); D5c.7 listed marquee-of-wires as out of first wire-copy | Selection foundation first |
| Block copy including attached stubs | **Extension of D5c.3 / D5c.6 copy closure** — **not** D5c.7 | Implicit membership; stubs stay Port→free on new ports |
| Keep stub **names** → join existing `clk` | **D5c.5** `ensureNetByName` on paste | Desired for clocks/resets; different from today’s block-copy “new net id + same name” collision pattern |
| Unique renamed stubs (`clk 2`) | D5c.7 **D2** / later “independent stubs” mode | Do **not** ship silently; needs explicit mode |
| Multi-block subgraph + internal Port↔Port | Already D5c.3 | Keep |
| Multi-block + external stubs + internal nets | New **copy-closure** spec | Separate from D5c.7 |

**Critical D5c.5 note:** “Block + Stubs keep names” means pasted stubs of `clk` **electrically join** every existing `clk` on the sheet. That is usually wanted for clock/reset and dangerous for data outs. Product’s three modes remain valid; only **Block + Stubs (keep names)** should be in a first stub-aware copy slice. **Independent names** waits for an explicit mode (touches D5c.7 D2).

Today’s Port↔Port paste already creates **new net ids with reused names** (name collision without join). Stub-aware copy should **not** copy that accident for stubs; it should call out D5c.5 join vs unique-name as a deliberate choice.

---

## 5. Proposed semantics (target model)

### 5.1 Explicit selection vs implicit closure

| Concept | Definition |
| --- | --- |
| **Explicit selection** | User-visible selected set: blocks ∪ segments ∪ (later) junctions / strokes |
| **Implicit stub attachment** | Port↔Free segments derived from selected blocks for **move / resize / port-drag / copy-closure** — **not** auto-added to explicit selection |
| **Copy closure** | Explicit selection ∪ policy-included objects (e.g. attached stubs, internal Port↔Port wires) |

Do **not** auto-select stubs when selecting a block (avoids Delete/Rename surprises). Delete-block already removes attached stubs via port touch.

### 5.2 Selection interaction (target)

| Input | Effect |
| --- | --- |
| Click object | Replace selection with that object |
| Shift+Click | Add (if absent) |
| Ctrl/Cmd+Click | Toggle |
| Marquee | Select blocks **and** segments (and later junctions) per hit test |
| Shift+Marquee | Union |
| Ctrl+Marquee | Toggle membership of hits |
| Empty click | Clear |
| Esc | Existing D5c.2 stack |

**Window vs crossing marquee:** valuable CAD convention; **optional later** (priority medium). First wire marquee can use one rule (recommend: segment hit if any point or any edge intersects rect = crossing-like, matching today’s block AABB intersect).

### 5.3 Copy modes (target)

| Mode | Closure | Net names | Milestone fit |
| --- | --- | --- | --- |
| Block only | Blocks + ports | — | Existing subset |
| **Block + attached stubs (keep names)** | + Port↔Free stubs + labels; remap ports; **ensureNetByName** | Join sheet nets | **Recommended default** for Shift+Drag / Duplicate when stubs exist |
| Block + independent stubs | Same geometry; unique names | Later / D5c.7-D2 adjacent | Spec later |
| Copy selection | Explicit blocks + explicit segments (+ internal Port↔Port rule) | Per object policy | After mixed selection |
| Wire-only orphan stub | D5c.7 | D1 keep name | Deferred D5c.7a |

**Shift+Drag:** same closure as Duplicate (include attached stubs under keep-names policy once that slice ships).

**Multi-block:**  
- Internal Port↔Port: keep D5c.3.  
- Each block’s attached stubs: include once (dedupe by segment id).  
- Do not copy the “other half” of a same-name stub on an unselected block.

### 5.4 Resize / port drag (geometry follow-on)

Consistent with stub-move:

| Operation | Proposed rule |
| --- | --- |
| Port drag | Translate attached Port↔Free stub(s) by that port’s Δ |
| Block resize | For each attached stub, translate by its port’s actual Δ (ports on moving edges move; opposite edge ports Δ=0) |

Narrow slices; no new ownership model.

---

## 6. Code locations (inventory)

| Area | Path |
| --- | --- |
| Selection UI / marquee / wire hit | `diagram-lab/src/view/DiagramStage.vue` (`selected`, `selectedSegment`, `onNodeClick`, `onStagePointer*`, `onSpanDown`, `copySelection`, `removeSelection`) |
| Modifier policy | `diagram-lab/src/view/interactionPolicy.ts` (`blockDragMode`, `allowMarquee`, `duplicateDragMoved`) |
| Copy / delete | `diagram-lab/src/core/edit.ts` (`duplicateBlocks`, `captureFragment`, `pasteFragment`, `deleteBlocks`) |
| Stub attachment helper | `diagram-lab/src/core/geometry.ts` (`isBlockAttachedStub`, `moveBlock`) |
| By-name nets | `diagram-lab/src/core/nets.ts` (`ensureNetByName`, …) |
| Specs | `docs/d5c3-block-copy-duplicate.md`, `d5c6-shift-drag-duplicate.md`, `d5c5-connection-by-name.md`, `d5c7-wire-copy-spec.md`, `d5d0a-stub-block-move.md`, `diagram-editor-usability-backlog.md` |

---

## 7. Recommended implementation slices (when released)

Ordered for dependency; **not** released here; **not** inserted into D5d.0-A.

| Slice | Scope | Status |
| --- | --- | --- |
| **S3 — Stub-aware block copy closure** | Implicit Port↔Free in `captureFragment` / `duplicateBlocks` / Shift+Drag; **ensureNetByName** | **Released for acceptance** |
| **S4 — Stub resize / port-drag** | Rigid stub follow port Δ | Next (not released) |
| **D5d.0 campaign** | Quantified performance | After S4 + generator A closed |
| **S1 — Mixed selection** | Multi-type selection | Deferred post-measurement |
| **S2 — Marquee includes segments** | Wire marquee | Deferred post-measurement |
| **D5c.7a** | Wire-only orphan stub clipboard | Deferred |
| **S6–S8** | Subcircuit / window-crossing / independent names | Later |

**Product sequencing:** complete stub semantics (S3→S4) before selection expansion (S1/S2) and before D5d measurement.

---

## 8. What UI should offer (product evaluation)

| Feature | Offer in UI? | Rationale |
| --- | --- | --- |
| Cumulative selection (Shift/Ctrl) | **Yes** | Baseline for any serious editor; Shift+Drag conflict already solvable |
| Marquee selects wires/stubs | **Yes** | Current gap blocks precise copy/delete of wiring |
| Implicit stub with block copy / Shift+Drag | **Yes** | Matches stub-move semantics; high HDL value |
| Auto-add stubs to explicit selection | **No** (default) | Keeps Delete/Rename predictable |
| Keep-name stub copy (join) | **Yes** as default stub-aware mode | Clocks/resets; status must say joined net |
| Independent-name stub copy | **Later**, explicit mode | Avoid silent isolation; aligns with D5c.7 D2 |
| Window vs crossing marquee | **Later** | Useful; not required for first wire marquee |
| Full subcircuit copy policy UI | **Separate spec** | High value; needs closure rules beyond S3 |

---

## 9. D5d boundary reminder

Synthetic benches exposed: zoom, stub-move, selection/copy gaps, and ~50-block interactivity limits. **Selection/copy work is generic editor capability**, not a benchmark fix. Performance measurement (D5d.0-B–D) remains the larger unknown and stays closed until freigegeben. Choose consciously whether any of S1–S4 precede the campaign.

---

## 10. Stop for review

No code changed. No milestones reopened. Awaiting product decision on:

1. Whether to schedule **S3** (stub-aware copy) before D5d measurement, and/or **S1+S2** (selection).  
2. Confirmation of Shift=add / Ctrl=toggle (replacing today’s Shift=toggle).  
3. Default net policy for stub-aware copy = **keep name → D5c.5 join**.
