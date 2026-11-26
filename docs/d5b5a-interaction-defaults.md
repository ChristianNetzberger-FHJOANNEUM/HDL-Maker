# D5b.5a — Interaction defaults (Select / Tools / Pan / RMB)

D5b.4a is accepted by the user. This slice brings desktop interaction defaults to the diagram lab without a full D5b.5 toolbar redesign. D5b.5 (remaining UI polish) and D5b.6 stay locked until separately released. CL/EDU remain planning-only.

## 1. Status

| Item | Status |
| --- | --- |
| D5b.4a | Accepted by the user |
| D5b.5a | Implemented; waiting for user acceptance |
| D5b.5 | Locked (remaining toolbar / shortcut polish) |
| D5b.6 | Locked |

No new undo architecture. No schema / libs / Vue Flow upgrade / CL / EDU. No commit / push / ZIP from this phase.

## 2. Behaviour

### Tool modes

- Modes: `select` | `pan` | `wire` | `freehand` | `port` (existing set).
- Load / New diagram / New project → always **`select`**.
- Toolbar tools are **sticky**. Re-clicking the active non-select tool returns to **Select** (`chooseTool` in `interactionPolicy.ts`).
- Active tool is highlighted (`class="on"`); stage cursor follows Select / Pan / Draw.

### Select (default)

- Block / port / wire behaviour unchanged from D5b.4a.
- LMB drag on empty canvas → **Marquee** (unchanged priority over LMB pan).
- Space held → marquee suppressed so Space+LMB can pan.

### Wire and other draw tools

- Wire / freehand / port only act when that tool is active.
- Mode stays until toggle or another tool.

### Pan

| Input | Effect |
| --- | --- |
| Middle mouse + drag | Pan in any tool (`pan-on-drag` includes button `1`) |
| Space + LMB drag | Pan in any tool (temporary left-button pan) |
| Pan tool + LMB drag | Pan (sticky mode kept for discoverability) |
| LMB empty (Select) | Marquee — **not** pan |
| RMB | Never pan |

Vue Flow API: `panOnDrag: number[]` via `panOnDragButtons(tool, spaceHeld)`.

### Right mouse button
c
- Reserved for context menus. Not used for pan/zoom.
- Block RMB: existing Open as / Open implementation menu.
- Empty stage RMB: stub menu with **Paste** and **Select tool**.

Space while a wire draft is open still toggles the elbow; Space also arms temporary pan.

## 3. Files

| File | Role |
| --- | --- |
| `diagram-lab/src/view/interactionPolicy.ts` | Pure choose/pan/marquee policy |
| `diagram-lab/src/view/DiagramStage.vue` | Tool toggle, Space pan, MMB pan, stage context stub, load→select |
| `diagram-lab/src/style.css` | Stage cursor classes |
| `diagram-lab/src/core/selfcheck.ts` | D5b.5a policy checks |

## 4. Tests

| Command | Result |
| --- | --- |
| `npx tsx src/core/selfcheck.ts` | `selfcheck ok` |
| `npx vue-tsc --noEmit` | Exit 0 |

## 5. Product decisions confirmed

| Topic | Decision |
| --- | --- |
| Space-pan | Implemented (recommended) |
| Context menu | Stub on empty stage; existing block menu kept |
| Dense diagrams | Hit / marquee / wire-hit logic unchanged |
| Dedicated Pan tool | Kept as optional sticky mode; MMB / Space remain primary |

## 6. Re-acceptance checklist

0/10

1. Fresh load → Select active; blocks/ports/wires as before.
2. Wire tool → draw wires; sticky across several wires.
3. Toggle Wire off → Select; drawing stops.
4. Other toolbar tools switch / toggle correctly.
5. Marquee on empty space still works.
6. Middle-click drag pans; selection/marquee unchanged.
7. Space+LMB drag pans.
8. RMB does not pan; context stub / block menu; LMB unchanged.
9. D5b.4a smoke: wired port drag, Escape cancel, resize focus-loss cancel, undo during gesture.
10. Selfcheck + vue-tsc green (already run).

## 7. Boundaries

Full D5b.5 toolbar unification and D5b.6 remain locked. No CL/EDU implementation.
