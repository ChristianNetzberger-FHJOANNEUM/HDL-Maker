# A2-P1 — Parametric port guides and dynamic symbol connections

**Status:** **Closed / accepted** (27 Nov 2026).  
**Related:** [adr-symbol-geometry-and-port-guides.md](adr-symbol-geometry-and-port-guides.md), [a2-findings](diagram-lab-pilot-a2-findings.md), [scientific presentation investigation](diagram-lab-pilot-a2-scientific-presentation-investigation.md).

---

## 0. Closure summary

A2-P1 delivered:

1. Declarative elliptical/circular **port guides** + instance `guideU`.  
2. **Derived** radial connection leads (not nets).  
3. **Catalog geometry** corrected so standard HV ports land on the default snap lattice without Object Snap.

**User-confirmed (manual):** Oscillator–Adder–AWGN retest — circular Adder, dynamic leads, visually straight horizontal and vertical wires, ports/wires on grid. Screenshot accepted.

**Automated:** `npm run selfcheck` ok; `npm run check` (`vue-tsc --noEmit`) ok — including cardinals, constant lead length 20, HV alignability, history/persistence, stale-embed compatibility.

**Later packages:** A2-P2 **closed**; A2-P3 LaTeX **implemented** (manual accept open) — [p3](diagram-lab-pilot-a2-p3-latex-labels.md); A2-P4 (Markdown) gated. Object Snap / Smart Guides remain deferred. S5b and D5d gates preserved.

---

## 1. Architecture (retained)

| Element | Role |
| --- | --- |
| **Artwork** | Visible symbol graphics (incl. bitmaps) |
| **Port guide** | Geometric constraint for movable ports (`u ∈ [0,1)`) |
| **Port** | Logical connection point with stable identity |
| **Net** | Logical connectivity between ports |

| Decision | Outcome |
| --- | --- |
| Parametric port guides | **Keep** |
| Dynamic graphical leads | **Keep** |
| Grid-compatible symbol construction | **Confirmed** |
| Shared rotation centre | **Confirmed** |
| Object Snap / Smart Guides | **Deferred** |
| Uniform resize policy | Later optional |
| Polygon guides | Later |

No symbol-name special cases. Leads are derived graphics only.

---

## 2. Implemented capabilities

| Capability | Status |
| --- | --- |
| Side ports / free pins | Preserved |
| Elliptical guides (circle = special case) | Yes |
| Individual guided drag + wraparound | Yes |
| Derived radial leads (Variant B) | Yes |
| Direct-contour / `lead: 'none'` (Variant A) | Model + fixture |
| Guide over Cartesian snap | Yes |
| Canonical Adder/Multiplier 120×120 | Yes (rev 4) |
| Oscillator 160×120 centred image | Yes (rev 2) |
| Selected rectangular \(2mg\) defaults | Yes |
| Polygon guides / Designer / Object Snap | **Out of scope** |

**Ownership:** definition owns artwork, guides, default `u`/leads; instance owns `guideU` / `placed`, size/style, nets. Explicit Compare → Update only — no silent migration.

---

## 3. Catalog geometry (final)

### Adder / Multiplier (`revision: 4`)

| Property | Before (failed accept) | After |
| --- | --- | --- |
| Box | 88 × 64 | **120 × 120** |
| Centre | (44, 32) | **(60, 60)** |
| Artwork | ellipse 56 × 48 | **circle 80 × 80** at (20, 20) |
| Outer / inner guides | dissimilar ellipses | **circles r=60 / r=40** |
| Lead length | angle-dependent | **constant 20** |

Cardinals (local): **(120, 60)**, **(60, 120)**, **(0, 60)**, **(60, 0)** — on-grid when origin is on-grid.  
Defaults: a `u=0.58`, b `u=0.42` (off-cardinal left, intentional), y `u=0` (right cardinal). Port ids unchanged.

### Oscillator (`revision: 2`)

| Before | After |
| --- | --- |
| 160 × 108; image y=4; midY=54 | **160 × 120**; image y=20 centred; midY=**60** |

### Rectangular A2 defaults

| Item | After |
| --- | --- |
| Generic block | 160 × 80 |
| Process symbol / template | 200 × 120 |
| Decision template | 160 × 120 |

**Unchanged (reported):** Gain / Integrator / Delay / Filter / most gates 88×64; other Pictures 160×108; Decision *symbol* artwork still legacy-local.

**Old sheets:** Compare → Update or re-place.

---

## 4. Acceptance history

| Phase | Result |
| --- | --- |
| Interim static catalog leads | **Failed** — orphan lines when ports moved |
| Guides without circular catalog | Mechanism ok; **alignment failed** (88×64 ellipse / OSC H=108) |
| Construction review | Root cause = **catalog geometry**, not snap/renderer |
| Final catalog + user OSC–Adder–AWGN retest | **Passed** (screenshot) |

Preserve the failed findings: they motivated guides and then geometry correction.

---

## 5. Final verification matrix

| Item | Evidence |
| --- | --- |
| Circular Adder + dynamic leads + HV wires on grid | **User-confirmed** (screenshot) |
| Exact cardinals (120,60)…(60,0); lead length 20 | **Automated** (selfcheck) |
| OSC/Generic/Process grid mid-ports | **Automated** |
| Guided move, wraparound, instance independence | **Automated** + earlier manual guide tests |
| Stub follow, undo/redo, paste, save/load, stale embed | **Automated** |
| Resize / block move / attached Port↔Port wires | **Automated** (anchor/stub) + prior A1 stub path; full interactive multi-corner wire cosmetics **not re-screenshot** this close |
| Escape cancel | Prior gesture contract; not re-shot this close |
| Symbol import/export | Library serialize/parse selfchecks; guides in fingerprint/`sameSymbolBody` |
| `vue-tsc --noEmit` | **Pass** |
| Full `selfcheck` | **Pass** |

**Remaining limitations (non-blocking):** free guided angles off-grid; non-uniform resize breaks circle/grid guarantees; orthogonal wires not re-routed on port move; untouched 88×64 teaching symbols; Object Snap deferred.

---

## 6. Symbol Designer authoring conventions

Recommended (not mandatory for arbitrary symbols):

- Prefer \(W,H = 2mg\) when mid-side / cardinal ports should sit on snap spacing \(g\).  
- Explicit shared centres; exact circles/ellipses; concentric similar guides for constant leads.  
- Numerically defined radii; cardinal/symmetric defaults where HV wiring matters.  
- Optional future uniform resize; optional soft grid-compatibility hints (no hard ban).  
- Compatible with later polygon guides and bitmaps.

---

## 7. Explicit non-goals (closed package)

No Object Snap / Smart Guides; no `resizePolicy`; no polygon guides; no Designer/Library Manager; no display-label / MathJax / Markdown (A2-P2+); no unrelated refactor; no commit/push from this close-out.

---

## 8. Changed files (package)

- Core: `document.ts`, `geometry.ts`, `edit.ts`, `catalog.ts`, `compare.ts`, `library.ts`, `selfcheck.ts`  
- View: `SymbolFace.vue`, `BlockNode.vue`, `DiagramStage.vue`, `SymbolPalette.vue`, `SymbolEditor.vue`  
- Docs: this file, ADR, A2 findings, handoff, application-pilots note

---

## 9. Stop

**A2-P1 closed** (A2-P2 also closed; A2-P3 awaiting accept). Preserve S5b / D5d.
