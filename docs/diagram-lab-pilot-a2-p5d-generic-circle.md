# A2-P5d — Generic circle block (preparation)

**Status:** **Closed and accepted** (28 Nov 2026). **P5d-S1…S14: 14/14**; **F3-1…F3-9: 9/9**; Fix1/Fix2 visually confirmed. `npm run selfcheck` + `npm run check` green. [Port ownership](diagram-lab-p5d-fix3-port-ownership-investigation.md). **Next:** BPSK demonstrator 2 → D5d → P5e (gated).  
**Gate:** S5b.2 endpoint snap & connect **12/12 accepted** — [close-out](d5d0a-s5b2-endpoint-snap-connect.md).  
**Related:** [roadmap §4](diagram-lab-pilot-a2-p5-roadmap.md#4-a2-p5d--generic-circle-block), [ADR symbol geometry](adr-symbol-geometry-and-port-guides.md), [A2-P1 symbol connections](diagram-lab-pilot-a2-p1-symbol-connections.md).

---

## 1. Goal

Deliver a **reusable circular block** suitable for domain-specific symbols (adders, multipliers, junctions, oscillators, etc.) **without** per-domain geometry code or a second port model.

The user places or edits a **generic circle** and configures:

- Ports at arbitrary angles on the circumference (`u` on an ellipse guide).
- Port names and optional **port direction** (P5b).
- Block fill, border, typography, Plain / LaTeX / Markdown (P5a).
- Wires, stubs, S5b.2 free-end snap to off-grid port anchors.
- Copy, Shift+Drag, Undo/Redo, Save/Load.

**Non-goals for P5d:** Symbol Designer UI, polygon guides, free-angle autorouting, bus width, general resize-policy framework, changing shipped Adder/Multiplier/Oscillator definitions.

---

## 2. Current implementation inventory (code review, 28 Nov 2026)

| Area | What exists | P5d relevance |
| --- | --- | --- |
| **Guide model** | `SymbolGuide` `kind: 'ellipse'` with `cx`, `cy`, `rx`, `ry` in symbol-local space — [ADR §3–4](adr-symbol-geometry-and-port-guides.md) | **Circle = equal `rx` and `ry`** — no new schema field |
| **Guide math** | `pointOnEllipseGuide`, `projectOntoEllipseGuide`, `continuousGuideU`, `scaleEllipseGuide` — `diagram-lab/src/core/geometry.ts` | Full circumference parameterisation; `u=0` right, `0.25` bottom, `0.5` left, `0.75` top |
| **Guided ports** | `SymbolPort.guideId`, `u`, `lead: 'radial'`, `leadGuideId`; instance `Port.guideU` override; `isGuidedPin` | Same model for generic circle |
| **Anchors & leads** | `guidedPinPoint`, `portAnchor`, `radialLeadSegment` | Port snap (S5b.2) uses `portAnchor` — off-grid ready |
| **Edit ops** | `placeGuidedPort`; port drag on guide in `DiagramStage.onPortMove` (guide projection **overrides grid**) | Angular port move already shipped (A2-P1) |
| **Resize / move** | `fitSymbolShapes` scales artwork; guides scaled per-instance `sx`/`sy`; `setBlockFields` + `portAnchorDeltas` + `translateAttachedStubsByPortDeltas` (S4) | A2-P1 selfcheck: resized guided anchors + attached stubs follow |
| **Reference symbols** | `guidedEllipseSymbol()` in `catalog.ts` — Adder + Multiplier (`sym_adder`, `sym_multiplier`): 120×120, body ellipse + twin guides (`guide_ports` / `guide_body`) | **Pattern to reuse**, not duplicate |
| **Decorative ellipse** | `sym_ellipse` (General library) — visible ellipse, **no guides, no ports** | Not a electrical block primitive |
| **Generic rect block** | `sym_block` — side ports on AABB only | Different port policy |
| **Block templates** | `BLOCK_TEMPLATES` — rectangles only | P5d is a **library symbol**, not a rect template |
| **Port add/remove** | `addSymbolPort` / `removeSymbolPort` in `symbols.ts` — new ports are **side + `t` only** (no `guideId`/`u`) | **Gap** for user-authored guided ports |
| **Symbol Editor** | Draw primitives, side pins, images — **no guide authoring UI** (`guideId` not in editor) | Add/remove guided ports via catalog or extended API only unless we extend editor |
| **Oscillator** | Picture library image + side pins (not guided ellipse) | **Out of scope** — do not migrate silently |

**Conclusion:** Ellipse-guide infrastructure is **complete for P5d**. The missing product piece is a **builtin generic circle symbol** (and optionally small extensions so add/remove port ops attach to the existing guide).

---

## 3. Geometry decisions (needs approval)

### D1 — True circle without new schema

| Question | Finding | Proposal |
| --- | --- | --- |
| Can ellipse guide represent a circle? | Yes — `rx === ry` in symbol-local space | Generic circle uses same `kind: 'ellipse'` guide; artwork ellipse with equal width/height aligned to guides |
| Angular position | `φ = 2πu` per [ADR](adr-symbol-geometry-and-port-guides.md) | Store port angle as **`u`**, not degrees in the document |

**Approve:** Reuse ellipse guide; no `kind: 'circle'`.

### D2 — Circle shape under block resize (unverified UX risk)

Today `resizeBox` allows **independent** width and height (`edit.ts`). Guides scale with `sx = instanceW/defW`, `sy = instanceH/defH`. Equal radii in definition space become **unequal** under non-uniform instance resize → **ellipse**, not circle.

| Option | Behaviour | Effort |
| --- | --- | --- |
| **A (document only)** | Non-uniform resize → ellipse; uniform resize → circle | None — current code |
| **B (P5d flag)** | Symbol metadata e.g. `preserveCircle: true` → resize handles force `height` from `width` (or vice versa) | Small block-resize branch |
| **C (defer)** | Ship A; revisit with Symbol Designer | — |

**Recommend for approval:** **Option A** for P5d v1 (matches ADR §4 “document non-uniform stretch”); note in manual checklist. Option B only if product requires strict circles on sheet.

### D3 — Orthogonal wires vs arbitrary port angles

| Layer | Policy |
| --- | --- |
| **Net geometry** | Unchanged — orthogonal segments, `commitWire` / stub routing |
| **Graphic lead** | `lead: 'radial'` — diagonal segment from inner to outer guide |
| **Wire attachment** | `portAnchor` at **outer** guide point; wire tool builds orthogonal path from there |

Non-cardinal ports already work for Adder/Multiplier. Generic circle inherits the same: last/first wire leg may meet the radial lead at a non-90° junction visually; electrical model unchanged.

**Approve:** No new routing engine for P5d.

### D4 — Adding/removing ports on generic circle

| Path | Today | P5d minimum |
| --- | --- | --- |
| Catalog default ports | N/A | Builtin symbol ships with 0–4 example ports at chosen `u` |
| Runtime add | `addSymbolPort` — side pins only | **Extend** `addSymbolPort` (or dedicated helper) to append guided port: `guideId: 'guide_ports'`, `u` from `projectOntoEllipseGuide` at default side midpoint **or** explicit `u` argument |
| Runtime remove | `removeSymbolPort` | Reuse as-is if port ids stable |
| Instance drag | `placeGuidedPort` | Reuse as-is |
| Symbol Editor UI | No guide pins | **Optional stretch** — not required for P5d if builtin + JSON/library embed suffices |

**Approve:** Extend canonical `addSymbolPort` (or one thin wrapper used by UI) — **no parallel circular port manager**.

### D5 — Compatibility with S5b.2

`probeConnectFreeEnd` / `connectFreeEnd` use `portAnchor` and grid-independent snap — covered by A2-P1 off-grid port tests and S5b.2 S5 case. Generic circle ports are ordinary `Port` records.

**Approve:** Re-run S5b.2 S5/S4 on generic circle during P5d manual pass.

### D6 — Existing Adder / Multiplier / Oscillator

Implement **new** symbol id (e.g. `sym_generic_circle` in General or Signal library). **Do not** change `sym_adder`, `sym_multiplier`, or `sym_oscillator` revisions or geometry in P5d.

---

## 4. Proposed minimal implementation (after approval)

1. **Catalog symbol** — extract or duplicate `guidedEllipseSymbol` parameters for `sym_generic_circle` (“Generic circle”):
   - Square definition size (e.g. 120×120 like Adder).
   - Visible ellipse fill/stroke; `guide_ports` / `guide_body` with `rx = ry` (true circle in local space).
   - Default ports: e.g. empty label text; **2–4 ports** at sample `u` values **or** zero ports + documented “add port” flow — product choice at implement time.
   - Default instance grid step consistent with other A2-P1 blocks (multiple of 40).

2. **Optional — `addSymbolPort` guided branch** — when target symbol has `guide_ports` ellipse and caller passes `{ guided: true }` or implicit detection:
   - Assign `guideId`, `lead: 'radial'`, `leadGuideId: 'guide_body'`, initial `u`.

3. **Tests** — see §6; no change to Adder/Multiplier selfcheck fixtures beyond shared helper refactor if we deduplicate `guidedEllipseSymbol`.

4. **Documentation** — update roadmap status to “implemented” only after manual checklist.

**Explicitly not in minimal slice:** Symbol Editor guide authoring, uniform resize lock, polygon guides, Haskell/HDL export changes.

---

## 5. Expected limitations

- Non-uniform block resize **may turn a circle into an ellipse** unless D2-B is approved and implemented.
- New guided ports via UI may remain **catalog/JSON-first** until Symbol Editor grows guide-aware pin creation.
- No automatic “equal angular spacing” command — author sets `u` per port (future authoring op per ADR §6).
- Radial leads are **graphic**; they do not imply non-orthogonal net topology.
- Block **rotation** still unsupported — port angles are symbol-local only.

---

## 6. Automated regression tests (proposed `selfcheck` ids)

Run with existing `npm run selfcheck`; add a **P5d** section after implementation:

| ID | Assertion |
| --- | --- |
| P5d-R1 | Builtin `sym_generic_circle` exists; guides present; `guide_ports.rx === guide_ports.ry` |
| P5d-R2 | All default ports `isGuidedPin` + `lead === 'radial'` |
| P5d-R3 | `guidedPinPoint` at `u=0,0.25,0.5,0.75` on placed block matches scaled circle |
| P5d-R4 | `placeGuidedPort` + `portAnchor` move; stub endpoint follows (reuse A2-P1 pattern) |
| P5d-R5 | Uniform resize (Δw=Δh) — port stays on circumference; `u` unchanged |
| P5d-R6 | Non-uniform resize smoke — anchors still on scaled ellipse guide (documents D2-A) |
| P5d-R7 | `addSymbolPort` (guided) adds port on guide with valid `u` |
| P5d-R8 | Save/load JSON round-trip preserves `guides`, `u`, instance `guideU` |
| P5d-R9 | `portAnchor` for off-grid angle snap-eligible for `probeConnectFreeEnd` (same-net fixture) |
| P5d-R10 | Copy block / Shift+Drag duplicate preserves guided port geometry |

Reuse existing **A2-P1** cases for adder/multiplier as regression guard — must still pass unchanged.

---

## 7. Browser acceptance — **14/14 accepted** (28 Nov 2026)

| Track | Result |
| --- | --- |
| **P5d-S1…S14** | **14/14 PASSED** (S9 corner resize / square aspect — final sign-off 28 Nov 2026) |
| **F3-1…F3-9** | **9/9 PASSED** — [Fix3](diagram-lab-p5d-fix3-port-ownership-investigation.md) |

Screenshot review (28 Nov 2026): dual-circle integration — independent ports/names, guided geometry, radial leads, interior labels, per-instance styling, port-direction arrows; no acceptance-blocking defects.

**Accepted limitations (deferred, not defects):**

- No automatic port-label collision avoidance.
- Flow arrows terminate at **outer port anchor** (radial lead is symbol geometry, not net).
- No automatic migration for sheets saved during the defective Fix1 window (manual cleanup — §9).

Checklist record:

| ID | Case | Expected |
| --- | --- | --- |
| P5d-S1 | Place Generic circle from library | Circular artwork; ports on outline |
| P5d-S2 | Drag port along circumference | Smooth `u`; no grid snap override |
| P5d-S3 | Add port (if UI enabled) | New port on guide; unique name |
| P5d-S4 | Remove port | Symbol + instance ports consistent; no orphan wires |
| P5d-S5 | Wire from cardinal `u` | Orthogonal stub + radial lead |
| P5d-S6 | Wire from diagonal `u` (e.g. 0.125) | Connects at outer anchor; routing acceptable |
| P5d-S7 | S5b.2 snap free end to off-grid port | Connect without grid snap |
| P5d-S8 | Grid snap off | P5d-S2 + P5d-S7 still work |
| P5d-S9 | Resize corner handle asymmetric | Block stays **square**; circle stays circular — **PASSED** |
| P5d-S10 | Resize edge handle | Block stays square; instance centred on the orthogonal axis |
| P5d-S11 | Fill / border / text Plain+LaTeX+Markdown | P5a behaviour |
| P5d-S12 | Port direction arrows (P5b) | Correct rendering |
| P5d-S13 | Undo/Redo port move + resize | Restores `guideU` |
| P5d-S14 | Save / Load | Circle + ports + wires intact |

**Adder/Multiplier regression spot-check:** open demo sheet — visuals and ports unchanged from pre-P5d baseline.

---

## 8. Architecture approval — **accepted** (28 Nov 2026)

| # | Decision | Accepted |
| --- | --- | --- |
| 1 | Ellipse guide (`rx=ry`) | Yes |
| 2 | Resize D2 variant **B** | Yes — square block, circular guide |
| 3 | Orthogonal nets + radial leads | Yes |
| 4 | `addSymbolPort` guided extension | Yes |
| 5 | Builtin `sym_generic_circle` only | Yes |
| 6 | Default ports `in` / `out` with directions | Yes |
| 7 | Symbol Editor guides | Deferred |

---

## 9. P5d-Fix1 — dynamically added ports (sheet UI)

### Root cause

| Path | Behaviour |
| --- | --- |
| Default ports | Defined on `sym_generic_circle` with `guideId` / `u` / `lead: radial` |
| **Add port on sheet** (click block edge) | Called `addPortAt` → instance port with **`placed: true`** on the **AABB** |
| Render / drag | `port.placed` skips guided anchor + radial lead; `guidedPortContext` returns null |

`addSymbolPort` was already guided-capable, but the **canonical sheet entry point** bypassed it.

### Correction (superseded by Fix3 for Generic Circle)

Initial Fix1 used `addSymbolPort` (definition mutation). **Fix3** routes `portPolicy: 'instance'` symbols to instance `guideU` only — see [Fix3](diagram-lab-p5d-fix3-port-ownership-investigation.md). Shared guided symbols still use definition add when `portPolicy` is omitted/`shared`.

### Recovery (defective saves)

Sheets created during the buggy build may contain `pN` ports with `placed: true` and **no** `symbolPortId`. These are **not** auto-migrated. **Manual:** remove unwired `pN` ports, re-add on the circle edge (Fix1 path). Wired legacy ports stay on the AABB until reworked.

### Fix1 automated checks

`P5d-Fix1` in `selfcheck`: `addPortAt` on placed Generic Circle → guided pin, radial lead, outer anchor, default ports unchanged.

---

## 9b. P5d-Fix2 — interior port name placement

### Problem

Guided ports used `nameAt` fallback **above the outer anchor** (`y - 8`), so names sat on radial leads.

### Correction

`guidedPortLabelPlacement` (`geometry.ts`): from inner lead endpoint `(x2,y2)`, step toward guide centre by `clearance + f(name length)`; **horizontal** `text-anchor: middle` in `SymbolFace`. Wired into `DiagramStage` / palette / symbol editor previews. **Not persisted** — derived each frame from `u`, block size, and name.

Adder/Multiplier/generic circle share the same radial-lead rule; rectangular `placed` / side ports unchanged.

### Fix2 automated checks

`P5d-Fix2` in `selfcheck`: label radius &lt; inner contour and &lt; outer anchor; long names inset further.

---

## 10. Implementation summary (shipped)

| Piece | Location |
| --- | --- |
| Builtin **Generic circle** (`sym_generic_circle`) | `catalog.ts` — General library; neutral ellipse artwork; `in` (u=0.5) + `out` (u=0) |
| Uniform resize | `SymbolDefinition.resizeAspect: 'preserve'`; `resizeBoxUniform` + `DiagramStage` resize |
| Port policy | `portPolicy: 'instance'` on Generic Circle |
| Guided add-port (sheet) | **`addPortAt`** → instance `guideU` (Fix3); **Symbol editor** still `addSymbolPort` |
| Regression | `selfcheck` P5d-R1…R10 + compat adder skew resize |

**Minimal schema addition:** optional `resizeAspect?: 'preserve'` on `SymbolDefinition` (forward-compatible with a future `free` / `preserveAspectRatio` / `fixedSize` policy). No change to net or segment records.

**Verification:** `npm run selfcheck` + `npm run check` green.

---

## 11. Fix1 manual smoke (before full P5d pass)

| ID | Expected |
| --- | --- |
| F1 | New port on same circumference as `in` / `out` |
| F2 | Radial lead drawn automatically |
| F3 | Drag along full circle (not box edges) |
| F4 | Adding ports does not move existing ports |
| F5 | Wires/stubs follow port motion |
| F6 | Resize keeps circle + radial geometry |

---

## 12. Close-out

| Item | Date | Result |
| --- | --- | --- |
| Architecture | 28 Nov 2026 | Accepted (§8) |
| Fix1 / Fix2 / Fix3 | 28 Nov 2026 | Shipped + accepted |
| Manual P5d-S + F3 | 28 Nov 2026 | **14/14 + 9/9** |
| Git checkpoint | 28 Nov 2026 | `P5d generic circle accepted` (local) |

**Related:** [P5e architecture](diagram-lab-multi-object-property-editing.md) approved; implementation **not** released.

---

## 13. One-line summary

**Generic circle in General library: A2-P1 ellipse guides, `resizeAspect` square resize, instance `portPolicy` ports (Fix3), interior labels (Fix2) — P5d accepted 14/14.**