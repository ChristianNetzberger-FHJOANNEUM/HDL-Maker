# P4 — Independent grid visibility and snapping

**Status:** **Accepted** by user (27 Nov 2026) — all four grid/snap combinations confirmed for blocks and wires; reconfirmed with P4a.  
**Depends on:** P0b grid stacking; P3a accepted.  
**Related:** [diagram-lab-pilot-a1-grid-stacking-findings.md](diagram-lab-pilot-a1-grid-stacking-findings.md), [p4a release](diagram-lab-pilot-a1-p4a-geometry-snapping.md), [p4b preferences investigation](diagram-lab-pilot-a1-p4b-preferences-investigation.md).

---

## 1. P3a acceptance note

User confirmed free mouse repositioning of block display text on A1 (captions clear of port names). Persistence / duplication / Escape / Undo–Redo remain covered by selfchecks but were **not re-signed** in that manual pass — see [p3a](diagram-lab-pilot-a1-p3a-text-position.md) §10.

---

## 2. Summary

Visual **grid** and geometric **snap** are independent editor preferences.

| Preference | Ref | Default | Effect |
| --- | --- | --- | --- |
| Show grid | `showGrid` | `true` | Paint lines in `svg.world-grid` (P0b layer) |
| Snap to grid | `snapOn` | `true` | Existing `snapValue` policy for ops that already honour it (see P4a investigation for wire gaps) |

| Grid | Snap | Use |
| --- | --- | --- |
| On | On | Precise technical drawing |
| On | Off | Free placement with orientation aid |
| Off | On | Clean figures while editing snaps |
| Off | Off | Free graphical drawing |

Toggling either control does **not** change the other.

---

## 3. State ownership and persistence

| Concern | Decision |
| --- | --- |
| Ownership | Editor view preference in `DiagramStage` (`ref`), same class as pre-P4 `snapOn` |
| Document model | **Not** stored on the diagram |
| History / dirty | Toggle creates **no** history entry and does **not** mark modified |
| Geometry | Enabling snap does **not** auto-snap existing objects |
| Persistence | Session-only (no `localStorage`); matches prior Snap convention — no new preference subsystem |
| Spacing / routing | Unchanged (`GRID`, canonical snap helpers) |

---

## 4. Rendering

- Reuses P0b `svg.world-grid` under transparent Vue Flow.
- When `showGrid` is false, the grid `<g>` is omitted and `gridLines` returns `[]` (no unnecessary line nodes).
- Viewport sync, canvas background, fills, wires, junctions, display text, ports, handles unchanged.
- Grid remains non-interactive (`pointer-events: none` via existing CSS).

---

## 5. UI

Toolbar (Edit group), compact `tool-btn`s with independent `.on` / `aria-pressed`:

| Control | `data-*` | Tooltips |
| --- | --- | --- |
| Show grid | `data-show-grid` | Show grid / Hide grid |
| Snap | `data-snap` | Enable snapping / Disable snapping |

No settings dialog or presentation mode.

---

## 6. Interaction

All operations that previously used `snapOn` still do. P3a display-text drag stays non–grid-snapped. Canonical snap implementation untouched beyond the visibility split.

---

## 7. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/view/DiagramStage.vue` | `showGrid`; grid `v-if`; toolbar; `gridLines` skip when hidden |
| Docs | This file; pilots; handoff; P3a acceptance; findings |

---

## 8. Automated

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | **Pass** |
| `npm run selfcheck` | **Pass** |

No new selfcheck cases: both prefs are view-only and already outside document serialization.

---

## 9. Manual acceptance (A1)

1. Grid on, snap on.  
2. Grid off, snap on.  
3. Grid on, snap off.  
4. Grid off, snap off.  
5. Toggle grid — snap state unchanged.  
6. Toggle snap — grid state unchanged.  
7. Pan / zoom with grid hidden.  
8. Show grid again — viewport alignment correct.  
9. Transparent and opaque block fills still correct.  
10. Grid toggles do not create Undo steps / dirty flag.  
11. Diagram geometry unchanged by toggles.  
12. P3a display text drag still works.

---

## 10. Scope / limitations

- P4 only. No presentation mode, configurable spacing, adaptive grid, new snap algorithms, alignment guides, SVG export, wire style, Library Manager.  
- Prefs are session-only (reload resets to both on).  
- P0–P3a, S5b, D5d gates preserved. No commit/push.

---

## 11. Addendum (investigation only)

User asked for a **P4a** consistency pass after observing that wires often ignore the grid while blocks snap. Inventory and proposed minimal scope: [p4a-geometry-snapping-investigation](diagram-lab-pilot-a1-p4a-geometry-snapping-investigation.md). **Not implemented** in this slice.

## 12. Acceptance

User confirmed the four Grid × Snap combinations work for **blocks and wires**. Follow-on: [P4a](diagram-lab-pilot-a1-p4a-geometry-snapping-investigation.md) (consistent free-point / bend / junction snap).
