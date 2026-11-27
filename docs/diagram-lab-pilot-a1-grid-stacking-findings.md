# A1 — Grid stacking over blocks (presentation defect)

**Status:** Root cause **accepted**. **P0b visually accepted** (26 Nov 2026). Interaction items remain **open** (not marked passed): [p0b-regression](diagram-lab-pilot-a1-p0b-regression.md).  
**Class:** Rendering / stacking defect — **not** a missing style feature.  
**Related:** [diagram-lab-pilot-a1-presentation-findings.md](diagram-lab-pilot-a1-presentation-findings.md), [adr-diagram-animation-runtime.md](adr-diagram-animation-runtime.md) §6, P0 wire chrome.

---

## 1. Observed symptom (screenshot)

- Vertical/horizontal grid lines **cut through** instance-name glyphs (e.g. “Generic block 2”).
- Block borders show gaps where grid lines cross them.
- Port names (`in`, `out`, `p1`, `p2`) partially covered by grid.
- Wires and net labels remain visually **above** the grid.

Block transparency alone explains grid *through empty fill*, **not** interrupted text or broken borders.

---

## 2. Root cause (verified)

### Before P0b

```text
.stage
  VueFlow                    ← blocks / text / ports
  svg.world (absolute overlay)
    g.grid                   ← first in SVG, but whole SVG above Vue Flow
    wires, junctions, handles, labels …
```

Grid lived in the wire overlay → painted **over** Vue Flow borders and glyphs while wires (later SVG children) correctly stayed above the grid.

---

## 3. P0b implementation

### After P0b

```text
.stage (background #f7f8fa)
  svg.world-grid   z-index 0   ← grid only; pointer-events: none; same worldStyle
  VueFlow          z-index 1   ← transparent background; blocks / text / ports
  svg.world        z-index 2   ← wires, junctions, labels, P0 handles, marquee
```

| Requirement | How |
| --- | --- |
| One viewport | Both SVGs use existing `worldStyle` / `viewport` — no second pan/zoom state |
| Grid non-interactive | `.world-grid` + `.grid line` → `pointer-events: none` |
| Transparent blocks | Grid still shows through empty symbol fill; borders/text above grid |
| P0 / S5b | Unchanged in `.world` |

**Changed files:** `diagram-lab/src/view/DiagramStage.vue`, `diagram-lab/src/style.css`, this doc + pilots/handoff.

---

## 4. Why not P3 fill

Opaque fill only hides grid *inside* the box. Names above symbols, port text, and borders still sat under the overlay grid. Stacking fix is required.

---

## 5. Manual acceptance (P0b)

1. Block borders not interrupted by grid lines.  
2. Instance names fully visible.  
3. Port names fully visible.  
4. Grid still visible through transparent block interiors.  
5. Zoom: grid stays aligned with snapped geometry / content.  
6. Pan: grid stays synchronised.  
7. Block and wire interactions unchanged.  
8. P0 handle presentation still works.  
9. Snap behaviour: historically tied to the same toggle as grid paint; **P4** splits them — see [p4-grid-snap](diagram-lab-pilot-a1-p4-grid-snap.md).

**Stop:** P0b closed for presentation track; continue with P1 acceptance.