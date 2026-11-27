# P3 — Minimal block appearance

**Status:** **Function confirmed** by user (27 Nov 2026). Full 14-point checklist not re-run item-by-item; open items stay unverified separately. Follow-on: [P3a text position](diagram-lab-pilot-a1-p3a-text-position.md).  
**Depends on:** P0–P2 accepted.  
**Related:** [diagram-lab-pilot-a1-presentation-findings.md](diagram-lab-pilot-a1-presentation-findings.md), [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md).

---

## 1. Summary

Optional **instance-level** colour overrides. Two instances of the same symbol may differ. Symbol library definitions are never modified.

| Control | Field | Notes |
| --- | --- | --- |
| Fill colour | `style.fill` | Closed shapes / plain-block background |
| Transparent fill | `style.fillTransparent` | Explicit no-fill; distinct from omitting `style` |
| Border colour | `style.stroke` | Plain border or closed-shape stroke |
| Text colour | `style.text` | P2 display text only |
| Reset appearance | delete `style` | P1/P2 fields untouched |

---

## 2. Document model

```ts
type BlockStyle = {
  fill?: string
  fillTransparent?: boolean  // true = no fill (grid may show through)
  stroke?: string
  text?: string
}
Block.style?: BlockStyle
```

**Resolution**

| Situation | Result |
| --- | --- |
| No `style` | Pre-P3 defaults (plain white box; symbol shapes `fill: none`) |
| `fillTransparent: true` | No body fill (opaque prior `fill` may remain stored for the picker) |
| `fill` set, not transparent | That CSS colour |
| `stroke` / `text` set | Override border / display-text colour |

API: `setBlockStyle(doc, id, patch | null)`, `resetBlockStyle(doc, id)`.

---

## 3. Rendering

| Surface | Fill / stroke |
| --- | --- |
| Plain block (no SymbolFace) | CSS `background` / `border-color` |
| Symbol / flush rect | Inline style on **rect / ellipse / polygon** only (beats `.sym-shape { fill: none }`) |
| Lines, images, symbol labels | Unchanged |
| Selection outline / handles / ports / wires | Unchanged (selection CSS independent of `stroke`) |

No extra rectangle behind non-rectangular symbols — fill follows existing closed geometry.

Opaque fills sit in Vue Flow above `svg.world-grid` (P0b), so they hide the grid; transparent fills reveal it.

---

## 4. Properties UI

Under Appearance:

- Fill colour (`type="color"`) + small presets (`#cfe8ff`, `#d8f0d8`, `#fff4cc`, `#f0d4d4`)
- Transparent fill checkbox
- Border colour
- Text colour
- **Reset appearance** (disabled when no `style`)

Colour inputs commit on `change` (picker close) → one history entry; blur for Ctrl+Z (P1-Fix).

---

## 5. Changed files

| File | Change |
| --- | --- |
| `diagram-lab/src/core/document.ts` | `BlockStyle`, `Block.style` |
| `diagram-lab/src/core/edit.ts` | `setBlockStyle`, `resetBlockStyle` |
| `diagram-lab/src/view/SymbolFace.vue` | Closed-shape paint overrides |
| `diagram-lab/src/view/BlockNode.vue` | Plain box + pass appearance |
| `diagram-lab/src/view/DiagramStage.vue` | Appearance controls |
| `diagram-lab/src/style.css` | Colour UI |
| `diagram-lab/src/core/selfcheck.ts` | P3 cases |
| Docs | This file; pilots; handoff |

---

## 6. Automated

| Check | Result |
| --- | --- |
| `vue-tsc --noEmit` | **Pass** |
| `npm run selfcheck` | **Pass** |

---

## 7. Manual acceptance (A1)

1. Light blue fill on ADDER.  
2. Light green fill on REGISTER.  
3. Change border on one block.  
4. Darker fill + white **Text colour**.  
5. Transparent fill on one block.  
6. Opaque hides grid; transparent shows it.  
7. Instances styled independently.  
8. Move / resize.  
9. Ports, wires, stubs OK.  
10. Undo/Redo (toolbar and Ctrl+Z after blur).  
11. Save / reload.  
12. Duplicate → restyle copy only.  
13. Reset appearance → P1/P2 unchanged.  
14. Older document → default look.

---

## 8. Known limitations

- Line-only artwork inside a symbol is not filled (by design).  
- Image shapes ignore fill/stroke.  
- No gradients, shadows, border width, opacity slider, wire styles, named presets framework.  
- Preset swatches are convenience only, not a style library.

---

## 9. Acceptance notes

| Area | Status |
| --- | --- |
| Core fill / border / text colour / transparent / reset (user) | **Confirmed working** |
| Full 14-point A1 checklist | Not exhaustively re-signed; treat unverified rows as open if regressions appear |
| P3a text positioning | Released next (A1 feedback) |

P4 remains gated.
