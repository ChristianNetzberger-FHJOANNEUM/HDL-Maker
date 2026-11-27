# P4b — Editor preferences (grid & snap spacing)

**Status:** **Accepted** by user (27 Nov 2026) — preferences dialog available; grid/snap spacing works.  
**Depends on:** P4 / P4a function confirmed; [investigation](diagram-lab-pilot-a1-p4b-preferences-investigation.md) accepted.  
**Related:** [p4-grid-snap](diagram-lab-pilot-a1-p4-grid-snap.md), [p4a-geometry-snapping](diagram-lab-pilot-a1-p4a-geometry-snapping.md).

---

## 1. Summary

Independently configurable **grid spacing** and **snap spacing** via a minimal Editor Preferences dialog, plus the existing toolbar toggles. One canonical preference state; not stored on the diagram.

| Field | Default | Meaning |
| --- | --- | --- |
| `gridVisible` | `true` | Paint `svg.world-grid` |
| `gridSpacing` | `20` | Visual line pitch (diagram units) |
| `snapEnabled` | `true` | Geometric snap on/off |
| `snapSpacing` | `20` | `snapValue` step |

---

## 2. Separation of former `GRID` roles

| Former use of `GRID=20` | Now |
| --- | --- |
| Visual grid pitch | `prefs.gridSpacing` |
| Snap quantisation | `prefs.snapSpacing` via `snapValue(v, enabled, spacing)` |
| Min block size | **`MIN_BLOCK_SIZE = 20`** (fixed) |
| Duplicate / paste offset | **`DUPLICATE_OFFSET = 20`** (fixed) |
| Keyboard nudge | **`NUDGE_DISTANCE = 20`** (fixed; not linked to snap yet) |
| Legacy import `GRID` | Alias of `MIN_BLOCK_SIZE` for compatibility |

Hit-test (`nets.SNAP=14`), symbols/ports, routing, benchgen (`TRACK_PITCH` / `CHANNEL_PAD`) unchanged and independent of prefs.

---

## 3. State ownership & persistence

| Concern | Decision |
| --- | --- |
| Canonical state | `prefs` ref in `DiagramStage` (`EditorPreferences`) |
| Module | `diagram-lab/src/core/preferences.ts` — sanitize / load / save; host-injectable |
| Diagram document | Untouched |
| History / dirty | Pref changes create **neither** |
| Diagram-Lab storage | `localStorage` key `diagram-lab.editorPreferences` |
| Corrupt / missing values | `sanitizeEditorPreferences` → defaults |
| D5f hosts | Call `sanitizeEditorPreferences` / supply object; **no** required `localStorage` |
| Mid-gesture prefs | `beginDocumentGesture` freezes `snapEnabled` + `snapSpacing` until gesture close |

---

## 4. Validation

- Spacing: positive finite → round → clamp **[5, 200]**.
- Presets: `5, 10, 20, 40, 100`.
- Invalid stored JSON → full defaults.

---

## 5. UI

- Toolbar **gear** (`data-preferences`) opens compact dialog (Grid & Snapping only).
- Show grid / Snap checkboxes + spacing inputs + presets + Reset + Close.
- Toolbar grid/snap buttons bind the same `prefs` state.
- Escape closes the dialog.

---

## 6. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/core/preferences.ts` | **New** — types, sanitize, localStorage helpers |
| `diagram-lab/src/core/edit.ts` | `MIN_BLOCK_SIZE` / offsets; `snapValue` + spacing args |
| `diagram-lab/src/view/DiagramStage.vue` | Prefs state, freeze, dialog, grid pitch |
| `diagram-lab/src/style.css` | Prefs dialog / presets |
| `diagram-lab/src/core/selfcheck.ts` | P4b cases |
| Docs | This file; investigation; pilots; handoff |

---

## 7. Automated

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | **Pass** |
| `npm run selfcheck` | **Pass** (incl. P4b) |

---

## 8. Manual acceptance (A1)

1. Defaults grid/snap spacing 20.  
2. Grid 40 / snap 20.  
3. Grid 40 / snap 10.  
4. Grid 20 / snap 5.  
5. All four visibility × enable combinations.  
6. Block place / move / resize.  
7. Wire create + stub finish.  
8. Bend / span / free-end / junction.  
9. Off-grid port connections.  
10. Labels + display text still free.  
11. Toolbar ↔ dialog sync.  
12. Reload restores prefs.  
13. Reset to defaults.  
14. Pref changes → no Undo / dirty.  
15. Pref changes → existing geometry unchanged.  
16. Min block size / symbols unchanged when snap=5 or 100.  
17. Pan/zoom grid alignment.

---

## 9. Limitations

- No adaptive / major–minor grid; no per-object snap.  
- Nudge not tied to snap spacing.  
- Gesture freeze covers document gestures; atomic wire clicks use live prefs.  
- Benchgen never reads prefs.  
- No commit/push in this slice.

---

## 10. Acceptance notes

| Area | Status |
| --- | --- |
| Preferences available / usable (user) | **Confirmed** |
| Full 17-point checklist item-by-item | Not exhaustively re-signed; treat unverified rows as open if regressions appear |
| Automated selfcheck / vue-tsc at release | Pass (distinct from manual acceptance) |

Next separate step when released: **A1 final pilot evaluation**. Do not start further feature slices automatically.
