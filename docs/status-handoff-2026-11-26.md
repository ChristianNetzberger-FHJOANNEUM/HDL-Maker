# Status handoff — diagram lab (26 Nov 2026)

For an **external agent**: read this first, then the linked slice docs. Do **not** invent HDL/hardware. German with the user; English technical names. **No commit / push / ZIP** unless explicitly asked.

## 1. Standing constraints

| Rule | Detail |
| --- | --- |
| History | One shared project history (**Variant A**); no dual undo stacks |
| Gestures | begin / preview / commit / cancel; preview **rebuilds from baseline** each frame (D5c.6 ghost fix) |
| Forbidden without release | `libs/`, EditableDiagram, FPGA without approval, workspace/`ui.json` edits as product changes |
| Locked streams | **D5b.6**, **CL0–CL7**, **EDU0–EDU6** |
| HEAD / commit | Do not commit unless user asks; do not push |

## 2. Acceptance snapshot (this session chain)

| Slice | Status | Doc |
| --- | --- | --- |
| D5a … D5a.3 | Accepted (earlier) | various `docs/d5a*` |
| D5b.1–D5b.4a | Accepted | `d5b*`, `d5b4a-gesture-robustness-fixes.md` |
| D5b.5a | Accepted | `d5b5a-interaction-defaults.md` |
| D5b.5b | Accepted | `d5b5b-wire-draft-pan.md` |
| **D5b.5** toolbar icons/groups | **Accepted 26 Nov 2026** | `d5b5-toolbar-icons-groups.md` |
| D5b.6 | **Locked** | — |
| D5c.1 | Implemented (label drag); treat as done in practice | `d5c1-wire-label-drag.md` |
| D5c.2 | Esc→Select stack | `d5c2-escape-tool-select.md` |
| D5c.3 | Accepted — block copy/paste/duplicate | `d5c3-block-copy-duplicate.md` |
| D5c.4 | Accepted — wire rename inspector | `d5c4-wire-rename-inspector.md` |
| D5c.5 | Accepted — connection-by-name + open stubs | `d5c5-connection-by-name.md` |
| D5c.6 | Accepted — Shift+Drag block duplicate (+ preview baseline fix) | `d5c6-shift-drag-duplicate.md` |
| D5c.7 | **Spec only** — wire copy **deferred** (B+C1+D1) | `d5c7-wire-copy-spec.md` |
| CL / EDU | Strategic accepted; **implementation locked** | `component-library-system-architecture.md`, `educational-web-editor-architecture.md` |

Roadmap tables: `docs/roadmap.md`, `docs/diagram-editor-roadmap.md`. Changelog: `docs/changelog.md`.

## 3. Product rules that must not regress

### Interaction (D5b.5a/b, D5c.2)
- Default tool **Select**; sticky tools; re-click non-select → Select (`chooseTool` / `interactionPolicy.ts`).
- Esc stack: cancel transient → tool Select → clear selection.
- MMB pan + Space+LMB pan in any tool; wire draft survives pan.
- Marquee = Select + LMB empty (not Space); RMB = context, never pan.
- Toolbar is **app chrome** (not viewport): stays visible/fixed while stage pans. **Docked only** — no detach/float (future slice).

### Toolbar (D5b.5)
- **Icon-only** buttons; `title` / `aria-label` = original label (+ shortcuts where known).
- Groups: `file` · `navigate` · `draw` · `edit` · `io` · `view`; separators.
- Hierarchy: `.hierarchy-chrome` crumbs (path text + icon Root/Up/Back/Forward).
- Mode ids: `data-tool-id="select|pan|wire|freehand|port"`.

### Nets / wires (D5c.4–D5c.5)
- **Per sheet:** same display **name** ⇒ one net (rename-join; stub reuse via `ensureNetByName`).
- Empty rename refused; unequal geometric join still blocked (`probeWire`) → use **Merge**.
- Legacy duplicate names: **no** auto-merge on load; Inspector collision + **Merge all with this name**.
- Stub: Port → free via **double-click** (or Enter); name from port / by-name.

### Copy / duplicate (D5c.3, D5c.6)
- Block Ctrl/Cmd+C/V/D; paste offset stacking; internal wires only if both ends selected.
- **Shift+LMB-drag** on block = duplicate under pointer; Esc/tiny drag cancels; originals stay.
- Wire-only copy: **not implemented** — see D5c.7 deferred scope (orphan stub + keep name).

## 4. Key code map

| Area | Path |
| --- | --- |
| Stage / toolbar / gestures | `diagram-lab/src/view/DiagramStage.vue` |
| Styles | `diagram-lab/src/style.css` |
| Tool policy | `diagram-lab/src/view/interactionPolicy.ts` |
| Gesture latch | `diagram-lab/src/view/gestureGuard.ts` |
| Nets / rename / by-name / stubs | `diagram-lab/src/core/nets.ts` |
| Block copy / duplicate | `diagram-lab/src/core/edit.ts` |
| Wire draft clicks | `diagram-lab/src/core/wiretool.ts` |
| TM preview-from-baseline | `diagram-lab/src/core/transaction.ts` (+ `session.ts`) |
| Regression | `diagram-lab/src/core/selfcheck.ts` |

## 5. Verify commands

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts    # expect: selfcheck ok
npx vue-tsc --noEmit             # expect: exit 0
```

Lab typically at `http://localhost:5174/` (Diagram lab).

## 6. What is intentionally NOT next

| Item | Note |
| --- | --- |
| D5b.6 | Locked until explicit release |
| D5c.7a wire-copy implement | Only after product release of deferred scope |
| Detachable floating toolbar | Explicit non-goal of D5b.5 |
| CL / EDU code | Planning only |
| FPGA / Vivado / opensource program flows | Separate M/O tracks; no drive-by |

## 7. Sensible next asks (only if user frees them)

1. **D5b.6** (whatever that slice’s release text says — do not invent scope).  
2. **D5c.7a** implement wire stub-copy per `d5c7-wire-copy-spec.md` (B+C1+D1).  
3. Further D5c comfort (routing around symbols, fit button, etc. from usability backlog) — only if ordered.  
4. Detachable toolbar as its **own** named slice.

## 8. Open / known nuances

- Same **name** ≠ same net until D5c.5 join/stub/merge-all; old sheets may still show collisions until user merges.  
- Block duplicate of a named net may still create a new net id with copied name depending on `duplicateBlocks` path — watch by-name consistency if touching that code.  
- Embedded automation may report `document.hasFocus() === false`; prefer selfcheck over flaky browser focus tests.

## 9. One-line summary

**D5b through D5b.5 and D5c through D5c.6 are accepted; D5c.7 is deferred spec-only; D5b.6 / CL / EDU stay locked; next work only on explicit user release.**
