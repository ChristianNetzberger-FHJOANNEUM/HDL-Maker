# Status report — 26 Nov 2026

Detailed product/engineering status for HDL-Maker / `diagram-lab`, plus a roadmap summary. Companion handoff for agents: [status-handoff-2026-11-26.md](status-handoff-2026-11-26.md).

## A. Executive summary

The **diagram engine lab** (`diagram-lab`) has completed the interactive undo/history track through **D5b.5** and the drawing/interaction track through **D5c.6**. Wire-only copy is **specified and deferred** (D5c.7). **D5b.6**, **CL**, and **EDU** remain locked for implementation. Studio HDL/FPGA milestones (M/V/O) are largely unchanged in this session; the active engineering focus has been the lab editor.

**Verify:** `cd diagram-lab && npx tsx src/core/selfcheck.ts` → `selfcheck ok`; `npx vue-tsc --noEmit` → 0.

**Process:** No commit/push/ZIP unless explicitly requested. German with user; English technical names. No inventing HDL/hardware.

---

## B. Detailed status — diagram lab (Branch D)

### B.1 Foundation (done)

| Area | Status |
| --- | --- |
| D0–D4d | Built: blocks, nets, symbols, libraries, assets, migration UI, project/hierarchy, extract/expand |
| D5a + D5a.1–D5a.3 | Accepted — top-down authoring, resize, port authoring; D5a complete |

### B.2 D5b — one undo history + interaction chrome

| Slice | Status | What shipped |
| --- | --- | --- |
| D5b.1–D5b.3 | Accepted | `TransactionManager` Variant A; project-wide history; sheet/project cutover |
| D5b.4 / D5b.4a | Accepted | Gesture latch, cancel/commit robustness; C3 port/wire hit; E3 resize/focus |
| D5b.5a | Accepted | Select default, sticky tools, MMB/Space pan, marquee, RMB context |
| D5b.5b | Accepted | Wire draft survives pan; Space tap = elbow |
| **D5b.5** | **Accepted 26 Nov** | Docked **icon-only** toolbar + tooltips; groups; hierarchy chrome separate; bar fixed while stage pans |
| **D5b.6** | **Locked** | Not released |

**Invariant:** One chronological history. Gesture `preview` always rebuilds from baseline (no stacked ghost edits).

### B.3 D5c — drawing tools and interaction

| Slice | Status | What shipped |
| --- | --- | --- |
| D5c.1 | Implemented | Wire label drag along segment + offset |
| D5c.2 | Implemented | Esc: cancel → Select → deselect |
| D5c.3 | Accepted | Block copy/paste/duplicate (flat OK); paste offset stacking |
| D5c.4 | Accepted | Wire inspector Name; empty name refused |
| D5c.5 | Accepted | Connection-by-name (sheet); rename-join; Port→free stub (dblclick); Merge-all for legacy collisions |
| D5c.6 | Accepted | Shift+Drag block duplicate; Esc/tiny cancel |
| **D5c.7** | **Spec only** | Wire/segment copy **deferred**; recommend later: orphan stub polyline + keep name (by-name join). No code. |

### B.4 Product rules (must not regress)

1. **Tools:** sticky; re-click → Select; Esc stack; MMB + Space pan; toolbar = chrome (not viewport).  
2. **Nets:** per sheet, equal **name** ⇒ one net; unequal geometric join still needs Merge; no silent load-merge of legacy duplicates.  
3. **Copy:** blocks via C/V/D and Shift+Drag; wires inside selection only if both ends selected; no wire-only clipboard yet.  
4. **No** dual history, no `libs/`/EditableDiagram without release, no CL/EDU implementation.

### B.5 Main code surfaces

- `diagram-lab/src/view/DiagramStage.vue`, `style.css`, `interactionPolicy.ts`, `gestureGuard.ts`
- `diagram-lab/src/core/nets.ts`, `edit.ts`, `wiretool.ts`, `transaction.ts`, `session.ts`, `selfcheck.ts`

### B.6 Known nuances

- Legacy sheets may still show duplicate display names until Merge-all / rename-join.  
- D5c.1/D5c.2 docs may still say “waiting” in older wording; treat behaviour as in tree and used daily.  
- Detachable floating toolbar is **out of scope** (future slice, not D5b.5).

---

## C. Status — rest of HDL-Maker (high level)

| Track | Status |
| --- | --- |
| M0–M5a | Done/committed baseline narrative (`bd5defa` era) |
| M5b JTAG | Tested on hardware; working tree historically uncommitted per roadmap note |
| M4b / M5c / M6 | Planned |
| V1 Vivado minimal install | Planned; license unresolved for redistribution |
| O1–O3 | Feasibility / backend / hardware check recorded; O4–O5 planned |
| E0–E1 Studio diagrams | Implemented on workspace model (not HDS write-back) |
| E2–E6 | Mostly covered by D or planned after D5 |
| U / R | Planned optional FPGA branches |

Studio, VHDL generators, and FPGA backends were **not** the focus of the recent lab interaction slices.

---

## D. Roadmap summary

### D.1 Active diagram-engine path

```
D0 … D4d     DONE (built)
D5a … D5a.3  DONE (accepted)
D5b … D5b.5  DONE (accepted)     D5b.6 LOCKED
D5c … D5c.6  DONE (accepted)     D5c.7 SPEC / deferred
D5d          Planned — large diagrams / perf
D5e          Planned — export & documentation
D5f          Planned — Vue 3 component library for hosts
D4f–D4g      Specified — not started (libraries / adapter acceptance)
```

**Guidance (planning):** keep domain palettes out of the core; consider **CL0 before D5f**; large assets vs snapshot undo = D5d concern.

### D.2 Locked / deferred next gates

| Gate | Action needed |
| --- | --- |
| D5b.6 | Explicit release text + freigabe |
| D5c.7a | Only if implementing deferred wire stub-copy per `d5c7-wire-copy-spec.md` |
| Detachable toolbar | Separate slice (not D5b.5) |
| CL0–CL7 | Strategic accepted; **no code** until released |
| EDU0–EDU6 | Strategic accepted; **no code** until released |

### D.3 Long-term streams (after / beside D5)

| Stream | Intent | Status |
| --- | --- | --- |
| **CL** | Domain-neutral component libraries, params, assets | Architecture accepted; implementation locked |
| **EDU** | Browser assignments, packs, student JSON, checker | Architecture accepted; implementation locked |
| **M / V / O / U / R** | Teaching HDL + Vivado + open-source + other vendors + remote | Per main `roadmap.md`; parallel; any may stay unused |

**MVP sketch (proposal only):** finish D5b → CL0 → small library → transactional place/wire → student JSON — Shape Editor / auto-grade / sim out of MVP.

### D.4 Principle

> The library is a **diagram editor first**. HDL is an **adapter**.

---

## E. Suggested reading order for a new agent

1. This file + [status-handoff-2026-11-26.md](status-handoff-2026-11-26.md)  
2. [roadmap.md](roadmap.md) status table + [diagram-editor-roadmap.md](diagram-editor-roadmap.md)  
3. Latest slice docs: `d5b5-toolbar-icons-groups.md`, `d5c5-connection-by-name.md`, `d5c6-shift-drag-duplicate.md`, `d5c7-wire-copy-spec.md`  
4. Run selfcheck + vue-tsc before changing behaviour  

---

## F. Bottom line

**Lab editor:** D5b.5 and D5c.6 closed; interaction and by-name nets are product rules; toolbar is icon-only chrome.  
**Next engineering:** only on **explicit freigabe** (typically D5b.6 or D5c.7a).  
**Strategic CL/EDU:** planned, not buildable yet.  
**FPGA/HDL studio tracks:** continue on their own milestones; not blocked by these lab slices, and not to be mixed in without approval.
