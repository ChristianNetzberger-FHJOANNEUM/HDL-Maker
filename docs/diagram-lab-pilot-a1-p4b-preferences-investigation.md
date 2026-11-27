# P4b investigation — Editor preferences (grid & snap spacing)

**Status:** Investigation **accepted**; P4b **implemented** — see [p4b-preferences](diagram-lab-pilot-a1-p4b-preferences.md).  
**Depends on:** P4 and P4a **function confirmed** by user.  
**Related:** [p4-grid-snap](diagram-lab-pilot-a1-p4-grid-snap.md), [p4a-geometry-snapping](diagram-lab-pilot-a1-p4a-geometry-snapping.md).

---

## 1. P4 / P4a acceptance

| Slice | User confirmation | Automated at release | Unverified separately |
| --- | --- | --- | --- |
| **P4** | Four Grid × Snap combinations work for **blocks and wires** | `selfcheck` / `vue-tsc` at P4 release | Full 12-point checklist not re-signed item-by-item |
| **P4a** | Consistent geometry snapping for blocks and wires **works** | `selfcheck` (incl. P4a cases) / `vue-tsc` at P4a release | Full 14-point checklist not re-signed item-by-item |

Manual user acceptance is recorded above. Automated results are **not** a substitute for that confirmation. P4 / P4a are **not** blockers for P4b preparation.

---

## 2. Objective (future implementation)

Minimal, extensible **Editor Preferences** with independently configurable:

| Preference | Role | Default |
| --- | --- | --- |
| `gridVisible` | Paint grid layer | `true` |
| `gridSpacing` | Visual line pitch (diagram units) | `20` |
| `snapEnabled` | Geometric snap on/off | `true` |
| `snapSpacing` | Quantisation step for `snapValue` | `20` |

Toolbar quick toggles for visibility / snap remain; all UI binds to **one** canonical preference state. Changing prefs must **not** rewrite existing diagram geometry, create history, or mark dirty.

---

## 3. Complete `GRID` / snap dependency inventory

Today `export const GRID = 20` in `edit.ts` is a **single constant** used for visual pitch, snap step, minimum size, and some offsets. `snapValue(value, enabled)` always divides by `GRID`.

### 3.1 Must become preference-driven (P4b)

| Use | Location | Today | P4b mapping |
| --- | --- | --- | --- |
| Grid line generation | `DiagramStage` `gridLines` | `+= GRID` | `gridSpacing` |
| Grid visibility | `showGrid` ref | session | `gridVisible` |
| Snap enable | `snapOn` ref | session | `snapEnabled` |
| All `snapValue(..., snapOn)` call sites | `DiagramStage` + `edit.ts` helpers | step = `GRID` | step = `snapSpacing` |
| `borderPlacement` / `nearestBlockBorder` | `edit.ts` | via `snapValue` | `snapSpacing` |
| `resizeBox` moving edge | `edit.ts` | via `snapValue` | `snapSpacing` |
| `addBlock` / `placeTemplate` / `snapBlocks` | `edit.ts` | via `snapValue` | `snapSpacing` |
| Wire free points, stub tip, bend/junction/free-end (P4a/S5b) | `DiagramStage` | via `snapValue` | `snapSpacing` |
| Span commit finalize | `DiagramStage` | via `snapValue` | `snapSpacing` |

### 3.2 Must **not** track user snap/grid spacing

These should stay **fixed geometry policy** (recommend a renamed constant, e.g. `MIN_BLOCK_SIZE = 20`), otherwise changing snap to 5 or 100 silently changes product rules:

| Use | Location | Why independent |
| --- | --- | --- |
| Minimum block width/height on resize | `resizeBox`: `Math.max(GRID, …)`, `right - GRID` | Min size ≠ snap pitch |
| Minimum size in `setBlockFields` | `Math.max(GRID, fields.width/height)` | Same |
| Block templates default sizes | `BLOCK_TEMPLATES` (160×80, …) | Library/product defaults |
| Symbol definition sizes / pin layout | symbols, libraries, `fitSymbolShapes` | Document/symbol data |
| Orthogonal routing rules | `orthogonalTo`, `simplifyOrthogonal` | Routing mode ≠ snap |
| Connectivity hit radius | `nets.SNAP = 14` | Hit-test, not grid |
| Port reach / chrome sizes | `portReach`, `chromeWorld(…)` | Zoom-aware UI chrome |
| P3a display-text drag | integer diagram units, not `GRID` | Fine presentation |
| Wire-label drag | unsnapped world | Fine presentation |
| Freehand / `orthogonalize` | stroke geometry | Explicitly out of snap prefs |

### 3.3 Ambiguous — recommend fixed defaults (not prefs)

| Use | Location | Recommendation |
| --- | --- | --- |
| Duplicate offset | `duplicateBlocks(..., GRID, GRID)` | Keep **fixed** paste/duplicate step (20), not `snapSpacing` — avoids huge jumps when snap=100 |
| Paste offset | `GRID * clipPasteCount` | Same fixed step |
| Keyboard nudge step | `BlockNode` `step = 20` | Keep fixed 20 (or later a separate pref); not snap spacing |
| Template slot pitch | `placeTemplate` 40-unit lattice | Fixed layout helper |
| Benchgen `CHANNEL_PAD = 20`, `TRACK_PITCH = 12` | `benchgen.ts` | **Always** recipe-local; never read user prefs (D5d reproducibility) |

### 3.4 Hard-coded `20` in tests / benches

Selfchecks and S5b cases often assume step 20 (`Math.round(x/20)*20`, `GRID === 20`). P4b must update tests to pass explicit spacing or keep defaults at 20 for regression parity. Bench hashes must ignore editor prefs.

---

## 4. Smallest separation of responsibilities

```text
EditorPreferences (view / host)
  gridVisible, gridSpacing, snapEnabled, snapSpacing

Geometry policy (code constants — not user prefs)
  MIN_BLOCK_SIZE (= 20)
  DUPLICATE_OFFSET (= 20)   // optional alias
  nets.SNAP (hit-test)
  benchgen TRACK_PITCH / CHANNEL_PAD

Canonical snap algorithm (unchanged)
  snapValue(value, enabled, spacing = prefs.snapSpacing)
  → Math.round(value / spacing) * spacing when enabled
```

**Do not** overload one `GRID` for all three roles after P4b.

Preserve algorithm: round-to-nearest multiple; connectivity hit-test still precedes quantisation (P4a).

---

## 5. Proposed state ownership & persistence

### Typed structure (conceptual)

```ts
type EditorPreferences = {
  gridVisible: boolean
  gridSpacing: number   // diagram units, > 0, finite
  snapEnabled: boolean
  snapSpacing: number   // diagram units, > 0, finite
}
```

Defaults: all match today’s behaviour (`true` / `20` / `true` / `20`).

### Ownership

| Concern | Decision |
| --- | --- |
| Canonical state | One reactive object in the editor shell (Diagram-Lab: `DiagramStage` or tiny module) |
| Document model | **Not** stored on the diagram |
| History / dirty | Pref changes → **no** history, **no** dirty |
| Validation | Positive finite numbers; clamp to min/max (see §8); reject NaN |
| Origin | Diagram coordinates; zoom-independent |
| Diagram-Lab persistence | Optional `localStorage` key (e.g. `diagram-lab.editorPreferences`) — evaluate on implement |
| D5f / hosts | Inject defaults or full prefs; **must not** require Diagram-Lab `localStorage` |
| Benchmarks | Explicit recipe only; never load saved user prefs |

No general settings framework; no empty categories.

---

## 6. Minimal UI proposal

- Toolbar **gear** → compact modal/panel **Editor Preferences**.
- Section **Grid & Snapping** only:
  - Show grid (checkbox) ↔ toolbar `data-show-grid`
  - Grid spacing (presets + number input)
  - Snap to grid (checkbox) ↔ toolbar `data-snap`
  - Snap spacing (presets + number input)
  - Reset to defaults
- Suggested presets: `5, 10, 20, 40, 100` (validated).
- Toolbar and dialog share the same state (two-way).

Interactive mock from the user brief is the UX target; no other preference sections in P4b.

---

## 7. Compatibility

| Topic | Expectation |
| --- | --- |
| Existing documents / symbols | Unchanged; prefs are editor-only |
| Off-grid ports / geometry | Remain; snap only affects new edits |
| Active gesture when prefs change | Prefer: ignore mid-gesture or apply on next preview frame; document chosen rule on implement — avoid rewriting baseline |
| P4a preview snap | Keep; pass `snapSpacing` into `snapValue` |
| Orthogonal routing | Unchanged |
| Labels / P3a text | Stay unsnapped |
| Free-angle routing (future) | Same free-point snap with `snapSpacing` |
| Retroactive normalisation | **Forbidden** |

---

## 8. Performance considerations

| Topic | Finding |
| --- | --- |
| Current grid | SVG lines on fixed world `0…1600` step `GRID` (~81×2 lines at 20) |
| Very small spacing | e.g. spacing=1 → ~1600×2 lines; cost rises linearly |
| Zoom | Transform scales lines; density on screen increases when zoomed out |
| Recommendation | Clamp spacing (e.g. **min 5**, **max 200**) — document only; no adaptive grid |
| D5d | Benchgen independent; prefs must not affect hashes |

No adaptive grid or perf campaign in P4b.

---

## 9. Future extensibility (not in scope)

Application defaults, spacing presets as named profiles, temporary snap override, major/minor grids, adaptive rendering, per-category snap — architecture should not preclude these; P4b does not build them.

---

## 10. Estimated complexity

| Work item | Complexity |
| --- | --- |
| `EditorPreferences` + validation + defaults | Low |
| Refactor `snapValue` to take spacing | Low–medium (many call sites) |
| Split `MIN_BLOCK_SIZE` from snap/grid | Low (critical correctness) |
| Wire UI gridLines to `gridSpacing` | Low |
| Unify toolbar + dialog state | Low–medium |
| Diagram-Lab `localStorage` | Low |
| Host injection hook (API surface only) | Low |
| Selfchecks for dual spacing + min size independence | Medium |
| Gesture-during-pref-change edge cases | Low–medium |

Overall: **small focused slice** if scope stays as below.

---

## 11. Recommended minimal P4b implementation scope

1. Introduce `EditorPreferences` with the four fields + defaults.  
2. Replace visual `GRID` step with `gridSpacing`; snap step with `snapSpacing` via `snapValue(value, enabled, spacing)`.  
3. Extract `MIN_BLOCK_SIZE` (and keep duplicate/paste/nudge on fixed 20 unless explicitly decided otherwise).  
4. Gear dialog: Grid & Snapping section; sync with toolbar.  
5. Optional Diagram-Lab `localStorage`; document host override path.  
6. Clamps for spacing; no retroactive geometry; no schema.  
7. Selfchecks: independent grid vs snap spacing; min size unchanged when snap=5/100; prefs no history; benchgen unaffected.  
8. Docs + manual acceptance on A1.

**Out of P4b:** freehand quantise, adaptive grid, per-object snap, major/minor grid, geometry normalisation, routing changes, general settings framework.

---

## 12. Required regression tests (when implementing)

- Defaults match pre-P4b behaviour (20/20, both on).  
- `gridSpacing=40`, `snapSpacing=20` — grid denser/sparser visually; snap still 20.  
- `gridSpacing=20`, `snapSpacing=10` — free wire/block snaps to 10; min block size still 20.  
- Snap off — no quantise; grid still paints at `gridSpacing`.  
- Toolbar ↔ dialog sync.  
- Pref toggle: no undo stack / dirty.  
- Existing off-grid port connections unchanged after pref edit.  
- P3a text + labels still free.  
- P4a bend/junction/wire free paths honour `snapSpacing`.  
- Benchgen hash stable with / without saved prefs.  
- `vue-tsc` + full `selfcheck`.

---

## 13. Stop

Superseded by the P4b release note.
