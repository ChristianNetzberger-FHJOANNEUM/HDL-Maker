# D5b.5 — Toolbar icons and groups

D5c interaction slices through D5c.6 are accepted; D5c.7 wire-copy is **deferred** (spec only). This slice polishes the **docked** lab toolbar: icons for mode tools, functional grouping, hierarchy chrome kept off the draw strip. **Detachable / floating toolbar remains out of scope.**

## 1. Status

| Item | Status |
| --- | --- |
| D5b.5a / D5b.5b | Accepted |
| D5b.5 | Accepted by the user (26 Nov 2026) |
| D5b.6 | Locked |
| CL / EDU | Locked |

## 2. Chrome vs viewport

The toolbar is **app chrome** (`header.toolbar`, grid row above the sheet). Pan / zoom move only the stage viewport. The bar stays **visible and fixed** during MMB-pan, Space-pan, wire draft, marquee, and block drag — same idea as Figma / draw.io / KiCad.

Hierarchy navigation stays in `.hierarchy-chrome` (crumbs under the toolbar), not mixed into Draw tools.

## 3. Groups

| `data-group` | Role |
| --- | --- |
| `file` | Sheets / fixtures / symbol fixtures (text buttons) |
| `navigate` | Select, Pan — icon tools (`data-tool-id`) |
| `draw` | Wire, Freehand, Port — icon tools |
| `edit` | Group / Ungroup / Duplicate / Delete / Snap / Convert / Confirm + Undo/Redo icons |
| `io` | Save / Reload / Load / Round-trip |
| `view` | Zoom in/out + status |

Separators: `.toolbar-sep`. Docked only — no drag, no position persistence.

## 4. Icons and a11y

- **All** toolbar actions are icon-only (`class="tool-btn"`); no visible text labels on chrome buttons.
- Tooltip `title` carries the **original** name (plus shortcut/gesture when useful); `aria-label` matches.
- Fixtures Digital / Signal / General use a letter glyph (`D` / `S` / `G`) as the icon.
- Hierarchy path crumbs keep readable text; Root / Up / Back / Forward are icons.
- Active mode / Snap: `class="on"` + `aria-pressed`.
- Tool ids unchanged: `data-tool-id="select|pan|wire|freehand|port"`. Header marked `data-toolbar-icons="only"`.

Sticky toggle, Esc→Select, MMB/Space pan, marquee, Shift+Drag block: **unchanged** (`interactionPolicy`).

## 5. Non-goals

Detachable toolbar, new icon framework, shortcut remapping, D5b.6, wire-copy, CL/EDU, `libs/`.

## 6. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 7. Acceptance checklist

7/7 — accepted 26 Nov 2026 (icon-only toolbar + hover tooltips confirmed)

1. Mode tools as icons with tooltip (name + shortcut/gesture).  
2. Visual groups; hierarchy chrome separate from Draw.  
3. Sticky / Toggle / Esc→Select unchanged.  
4. During MMB-pan and Space-pan the toolbar stays visible and usable.  
5. Wire / marquee / Shift+Drag block still ok.  
6. No detach/drag of the bar.  
7. Selfcheck + vue-tsc green.
