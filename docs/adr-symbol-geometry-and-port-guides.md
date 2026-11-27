# ADR — Symbol geometry, port guides and future Symbol Designer

**Status:** **Accepted.** A2-P1 **closed** (guides + grid-compatible catalog construction). See [a2-p1-symbol-connections](diagram-lab-pilot-a2-p1-symbol-connections.md). Polygon guides, Designer UI, Object Snap, and later SD stages remain future work.  
**Context:** A2.1 port–artwork gaps; superseded interim static catalog leads; desire for a general Symbol Designer rather than Adder/Multiplier-only fixes.  
**Related:** [a2-p1-symbol-connections](diagram-lab-pilot-a2-p1-symbol-connections.md), [scientific presentation investigation](diagram-lab-pilot-a2-scientific-presentation-investigation.md), [a2-preparation](diagram-lab-pilot-a2-preparation.md), [strategic vision](diagram-lab-strategic-vision.md), [geometry/style ADR](adr-diagram-geometry-routing-style.md).

---

## 1. Decision (conceptual)

Separate four concerns inside a symbol:

| Layer | Role |
| --- | --- |
| **Bounding box** | Selection, place, resize of the instance |
| **Artwork** | Visible primitives + images + labels (no electrical meaning) |
| **Port guide** (optional) | Curve that constrains where a port may sit (`p(u)`, `u∈[0,1]`) |
| **Logical ports** | Stable ids/names; placement policy; optional derived **lead** graphics |

**Guiding statement:** A symbol is a small declarative graphic document with defined connection opportunities — not a special-cased class per shape family.

Do **not** auto-detect artwork or bitmap outlines. Do **not** introduce Visio-style constraint/formula engines. Do **not** implement the Symbol Designer in this ADR.

---

## 2. Existing model inventory (verified in code)

| Capability | Status | Location |
| --- | --- | --- |
| `SymbolDefinition` / embed in document | Present | `document.ts` |
| Primitives: rect, ellipse, line, polygon, text, **image** | Present | `SymbolShape` |
| Image assets PNG/JPEG/WebP/SVG; checksum; embed; size limits; SVG script/`foreignObject` reject | Present | `assets.ts`, roadmap D5 notes |
| `lockAspect` letterbox in slot | Present | `fitSymbolShapes` |
| Side ports (`side`+`t`) on **AABB** | Present | `pinLocal` / `portAnchor` |
| Free pins (`x`,`y` fractions) anywhere in box | Present | `pinPoint` / `isFreePin` |
| Instance `placed` override of side+t | Present | `Port.placed`, `placePort` |
| Port drag → AABB for side/free; guide for guided | Present (A2-P1) | `DiagramStage` `onPortMove` |
| Resize scales artwork + border / guide anchors | Present | `fitSymbolShapes`, `portAnchor`, scaled guides |
| Static lead lines as `line` shapes | **Superseded** for Adder/Multiplier/OSC | Prefer derived leads |
| Embedded defs + explicit Compare/Update | Present | `library.ts`, `migration.ts` |
| Symbol Editor UI (draw primitives, pins, image) | Present (limited) | `SymbolEditor.vue` |
| Invisible ellipse guides | **Present (A2-P1)** | `SymbolGuide`, `geometry.ts` |
| Guided `u`-parameter placement | **Present (A2-P1)** | `guideId`/`u`, instance `guideU` |
| Derived radial leads (Variant B) | **Present (A2-P1)** | `lead: 'radial'`, `radialLeadSegment` |
| Direct-contour / `lead: 'none'` (Variant A) | **Present (model)** | Fixture in selfcheck |
| Polygon / polyline guides | **Absent** (interface reserved) | Future SD2 |
| Persistent port groups / coupled rotation | **Absent** | — |
| Instance rotation | **Absent** | — |

**Reuse for a future Designer:** pan/zoom, grid/snap (P4/P4b), selection, history, properties, JSON, SVG render, resource handling, existing Symbol Editor shell — but **primitive edit ops are not automatically the same as sheet block ops**; expect a dedicated editing context, not “one menu item”.

---

## 3. Port placement policies (minimal conceptual model)

Preserve today’s documents: side + free remain valid.

| Mode | DOF | Today | Future |
| --- | --- | --- | --- |
| **Side** | 1 (`t` on AABB edge) | Yes | Keep |
| **Free** | 2 (`x`,`y`) | Yes | Keep |
| **Guided** | 1 (`u` on a guide) | **Yes (A2-P1 ellipse)** | Keep; polygons later |

Implemented fields (definition + optional instance override):

```text
SymbolGuide = { id; kind: 'ellipse'; cx; cy; rx; ry }   // polyline reserved later
SymbolPort  += optional guideId, u, lead ('none'|'radial'), leadGuideId
Port        += optional guideU   // instance override; does not rewrite definition
```

Logical port **id/name** stay independent of placement. Guide evaluation is kind-dispatched so open polylines / closed polygons can be added without renaming the placement fields.

---

## 4. Guide geometry

Prefer a **small** set of guides, not one class per symbol silhouette:

| Guide | Parameterisation |
| --- | --- |
| Rectangle boundary | Perimeter distance → `u` (same idea as side ports, but any rect in local space) |
| Ellipse / circle | `φ = 2πu` → `(cx+rx cos φ, cy+ry sin φ)`; circle = equal radii |
| Open polyline | Arc-length along segments |
| Closed polygon | Arc-length on loop (triangle/hex = data, not types) |
| Future path | Deferred (no native Bezier shape kind yet) |

Guides may be **invisible**. They need not match artwork. A bitmap may use an ellipse/polygon guide outside the photo.

**Resize:** store guides in symbol-local coords; scale with the definition→instance transform like shapes (`fitSymbolShapes` pattern). Prefer normalised geometry so `u` stays stable under uniform scale; document non-uniform stretch behaviour (ellipse angles vs arc-length) at implementation time.

**Reuse vs duplicate:** guides can *reference* a primitive id **or** carry their own geometry. Referencing avoids drift but couples edit UX; copying geometry is simpler for v1. Decision deferred to SD0.

---

## 5. Interactive port movement

| Concern | Guidance |
| --- | --- |
| Pointer → guide | Project onto nearest point; set `u` |
| Closed contours | Wrap `u` mod 1 |
| Polygon vertices | Continuous arc-length; avoid jumps (hysteresis optional) |
| Snap | Grid optional; angular snap optional on ellipse |
| Wires/stubs | Keep port **id**; refresh endpoint geometry (existing `portAnchor` / stub translate) |
| Routing policy | Orthogonal **nets** unchanged; **graphic** leads may be radial/diagonal |

Reuse `begin/preview/commit` port-drag gestures; replace `pinOnBorder`-only projection when mode is guided/free.

---

## 6. Rotational symmetry

| Need | Approach |
| --- | --- |
| Orbit | Ellipse/circle guide |
| Equal spacing | Authoring op: write N guided ports with `u = i/N` |
| Common rotate | Authoring op: add Δu (or Δφ) to selected ports once |
| Persistent groups | **Not required** unless a concrete product case appears |

Distinguish **symbol-local** port angles from future **instance** rotation of the whole block.

---

## 7. Derived connection leads

Optional **LeadPolicy** (conceptual):

| Policy | Behaviour |
| --- | --- |
| `none` | Port on contour / free; no extra stroke |
| `anchor` | Line from port to fixed local attachment point |
| `radial` | Ray from centre (or defined origin) to intersection with an **inner** contour |

Outer **guide** (where the logical port sits) may differ from inner **attachment contour** (where the lead meets artwork).

| Issue | Mitigation |
| --- | --- |
| Concave polygon / multi-hit ray | Explicit attachment point or first-hit rule — no auto outline |
| Static `line` shapes vs derived leads | Static lines **orphan** when instance `placed` moves — known A2-P1 limitation |
| Orthogonal wires vs radial leads | Allowed: leads are artwork, nets stay orthogonal |

Leads remain **derived graphics**, never nets.

---

## 8. Bitmap architecture

Already largely present (`image` + `ImageAsset`). Future Designer requirements (no new work now):

PNG/JPEG (WebP already); alpha; local pose/size; `lockAspect`; mix with vectors/text; embed + checksum dedupe; validation/size limits; D5e embed; **independent** guides/attachments — **no** bitmap tracing.

---

## 9. Definition vs instance

| Owned by definition | Owned by instance |
| --- | --- |
| Artwork, guides, default `u` / lead policy | Sheet pose/size, P1–P3 presentation, `placed` / `guideU` overrides, wires/nets |

Preserve embed + explicit Update. Guide/port id stability matters for updates. Missing or invalid guides: fall back to side/`t` (or free) geometry without dropping nets; no silent catalog rewrite of embedded bodies.

---

## 10. Reference systems (concepts only)

| System | Takeaway for Lab |
| --- | --- |
| **Visio** | Local connection points + optional direction; ShapeSheet formulas → **too heavy** — skip |
| **draw.io** | Relative points; optional project-to-perimeter; perimeter separate from fill shape |
| **yFiles** | Fixed vs dynamic port candidates on shape geometry |
| **KiCad** | Graphics ≠ electrical pins — align with Lab nets |

Adopt the **separation** ideas; do not clone full products.

---

## 11. Minimal A2-P1 correction (shipped)

**Problem with provisional catalog leads alone:** instance port-drag left orphaned static lines; Adder/Multiplier-only static lines were not Designer-reproducible.

**Shipped path:**

1. Adder/Multiplier: declarative ellipse guides + derived radial leads (Variant B).  
2. Variant A (`lead: 'none'`) supported by the same model (selfcheck fixture).  
3. Oscillator: side ports on rectangular picture artwork (no forced ellipse).  
4. AABB side ports and free pins unchanged for other symbols.  
5. No persistent port groups; no contour engines; no Designer UI.

**Immediate vs deferred**

| Shipped (A2-P1) | Deferred (SD*) |
| --- | --- |
| Ellipse-guided ports + radial leads for circular DSP symbols | Full Designer UI |
| No orphan static leads under moved ports | Polygon guides |
| Resize preserves `u`; wires/stubs follow endpoints | Bitmap authoring UX, group rotate |
| Explicit Compare/Update for embedded defs | LaTeX/display labels (A2-P2+) |

---

## 12. Staged future development (not released)

| Stage | Content |
| --- | --- |
| **SD0** | Specify guides + placement + lead policy; compatibility — **done for ellipses via A2-P1** |
| **SD1** | Circle/ellipse guides; derived leads — **done (minimal) via A2-P1** |
| **SD2** | Polyline/polygon guides |
| **SD3** | Edit graphics in Designer context |
| **SD4** | Author guides/ports graphically |
| **SD5** | Bitmap import/place UX |
| **SD6** | Preview, validate, library save |
| **SD7** | Equal spacing / batch rotate ops |
| **SD8** | Align/group comfort |

Effort estimates are qualitative only.

---

## 13. Compatibility, performance, acceptance (future)

- Old documents: side/free only; missing guides → current behaviour.  
- Update: changed guides like pin changes — conflicts if wired ports vanish.  
- Perf: evaluate `p(u)` in drag/hit paths; cache polyline lengths; no typesetting concerns here.  
- Tests: projection stability, wrap, resize `u` stability, wire follow, no net created by leads, Designer round-trip of the A2-P1 symbols.

---

## 14. Explicit non-goals

No constraint solver; no universal contour/bitmap tracing; no plugin framework; no Designer/Library Manager/new bitmap features/display-label/LaTeX/simulator; no polygon guides in A2-P1; no commit/push from this work package.

A2-P2…P4 stay gated. Preserve S5b, D5d, HDL-Maker Studio.

---

## 15. Guiding statement

**Artwork ≠ guide ≠ logical port ≠ net.**  
Parametric guides (`u`) buy Visio/draw.io-class flexibility without ShapeSheet complexity — when separately released.

---

## 16. Symbol construction conventions (grid as authoring aid)

Full numerical inventory and root-cause analysis: [a2-p1 §9](diagram-lab-pilot-a2-p1-symbol-connections.md). Summary:

| Convention | Guidance |
| --- | --- |
| Local coordinates | Symbol box origin top-left; centres stated explicitly |
| Default size | Prefer \(W,H = 2mg\) for snap spacing \(g\) when mid-side / cardinal ports should land on-grid |
| Circular symbols | Exact circles (`rx = ry`); square box; shared centre for artwork, guides, box |
| Port guides | Concentric **similar** circles/ellipses when equal lead length is desired |
| Cardinal defaults | \(u \in \{0, 0.25, 0.5, 0.75\}\) for HV-friendly defaults |
| Free angles | Allowed off-grid — grid is an aid, not a hard limit |
| Bitmaps | Centre slot in the box; side ports still follow AABB unless guided |
| Resize | Optional future `free` / `uniform` policy; do not compensate bad defaults with snap frameworks |

**Priority:** correct catalog geometry before Object Snap / Smart Guides / magnetic port alignment — **catalog correction shipped** (Adder/Multiplier 120×120 circles; OSC 160×120; selected rectangular \(2mg\) defaults). See [a2-p1 §3](diagram-lab-pilot-a2-p1-symbol-connections.md).

**Deferred:** Object Snap and Smart Guides (not required for grid-built standard symbols).

**Future resize (documentation only):** `free` (independent W/H, current behaviour) vs `uniform` (preserve aspect — useful for circles/bitmaps). No `resizePolicy` field in this release.
