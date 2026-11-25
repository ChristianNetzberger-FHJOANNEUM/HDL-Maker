# Component Library System — architecture (proposal)

**Status:** planning only. Not accepted. Not released for implementation.  
**Does not replace** accepted D0–D5a / D5b.1–D5b.3 decisions or the ongoing D5b.4 work.  
**Related:** [educational-web-editor-architecture.md](educational-web-editor-architecture.md), [diagram-editor-roadmap.md](diagram-editor-roadmap.md), [learning-mode.md](learning-mode.md).

## 1. Product vision (proposal)

The diagram lab should become a **universal, license-free technical diagram editor**. Domain meaning comes from **loaded component libraries**, not from hard-coded HDL semantics in the core.

Target hosts (same infrastructure where possible):

| Product | Audience | Role |
| --- | --- | --- |
| HDL-Maker | Students / FPGA developers | Hierarchical HDL design |
| Component Library Manager | Lecturers / library authors | Define and compose libraries |
| Educational Web Editor | Course students | Browser assignments without toolchains |

## 2. Naming note (roadmap collision)

The repository already uses:

- **L0** — Learning Mode (local offline courses for HDL-Maker) — [learning-mode.md](learning-mode.md)
- **E0–E6** — Studio editor branch

Therefore this proposal uses:

| Proposed stream | IDs | Avoids |
| --- | --- | --- |
| Component Library System | **CL0–CL7** | Conflict with Learning Mode **L0** |
| Educational Web Applications | **EDU0–EDU6** (see sister doc) | Conflict with Studio **E0–E6** |

The user’s draft labels `L0–L7` / `E0–E6` map 1:1 onto **CL** / **EDU**. Acceptance may rename them; until then **CL/EDU** are the unambiguous planning IDs.

## 3. Layered architecture (proposal)

| Layer | Responsibility | Today in repo |
| --- | --- | --- |
| **A. Diagram Core** | Project, documents, components, ports, nets, hierarchy, serialize, `TransactionManager` | Largely present in `diagram-lab/src/core/` (framework-free) |
| **B. Reusable Diagram Editor** | Render, select, gestures, wire, palette UI, properties, undo UI | Present as Vue lab (`DiagramStage.vue`); **D5f** packages it |
| **C. Component Library System** | Reusable library packages, categories, symbols, parameters, versioning | Partial: `SymbolLibrary` (D3c/d), not full functional library components |
| **D. Library Manager** | Browse / edit / compose libraries | Not present as a product |
| **E. Assignment System** | Task packages, capabilities | Not present (see EDU doc) |
| **F. Host applications** | HDL-Maker, web editor, manager, viewer | HDL-Maker exists; others planned |

Package boundaries are **not** decided here. No Pinia mandate; D5b ownership rules stay until a later acceptance.

## 4. Existing model — reuse first

### Already implemented (accepted / built)

| Structure | Location | Role |
| --- | --- | --- |
| `DiagramProject` | `component.ts` | Project container, `schemaVersion: 1` |
| `ComponentDefinition` | `component.ts` | Logical identity: ports, bindings, implementation, optional `symbolId`, `revision` |
| `ComponentImplementation` | `component.ts` | `none` / `diagram` used; other kinds reserved via `extra` |
| Block instance | `document.ts` `Block` | `componentId`, `symbolId`, **instance** `parameters?: Record<string, string>` |
| Logical vs graphic ports | `Port.interfacePortId`, `placed`, per-instance size | Bidirectional sync (D5a.3) |
| `SymbolDefinition` + shapes | `document.ts` | Native primitives + `image` shapes |
| `ImageAsset` | checksum, base64 embed, SVG audit | D3d |
| `SymbolLibrary` | `library.ts` | Catalog of **symbols**, categories, assets, version, license |
| Copy-on-place | `adoptLibrarySymbol` / place from palette | Sheet opens without original library |
| Explicit symbol update | D3e | No silent library chase |
| `TransactionManager` | `transaction.ts` | One project history (D5b) |

### Partially prepared

| Topic | State |
| --- | --- |
| Instance parameters | String map round-trips; **no schema**, no typed UI |
| Component description / revision | Fields exist; no library provenance package |
| Symbol editor (D3b) | Lab has native shape editing; not a full Library Manager |
| SVG/bitmap import | In-document/library assets with script/handler refusal |
| Generic block palette | `BLOCK_TEMPLATES` hard-coded in `edit.ts` |

### Not present (proposal only)

- Functional **library component** package (ports + parameters + graphics + optional impl as one library unit)
- Master → assignment subset composer
- Typed parameter schema / generated inspector
- Immutable asset store separate from undo snapshots
- Capability / permission model for hosts
- Assignment packages / Solution Viewer / Checker / simulation bindings

**No second competing component model** without a later accepted reason. Prefer extending `ComponentDefinition` + provenance fields over inventing a parallel type tree.

## 5. Definition vs instance vs library (proposal)

```
LibraryComponent (CL package)
        │ import / adopt into project
        ▼
ComponentDefinition (in DiagramProject.components)
        │ instantiate on a sheet
        ▼
Block (+ Ports)  — instance graphics & parameters
```

| Concern | Shared definition | Per instance |
| --- | --- | --- |
| Logical port set / `interfacePortId` | Yes | Bound copies; graphic `side`/`t` may differ when `placed` |
| Parameter **schema** | Yes (proposal) | — |
| Parameter **values** | Defaults on definition | `Block.parameters` |
| Symbol / asset picture | Definition / symbol | Instance box size already individual |
| Implementation diagram | Optional shared | Open as / hierarchy unchanged |

Compatibility to keep: Open as, Place on sheet, Duplicate, Make unique, interface sync, individual size/port graphics, hierarchy, transactional undo.

A library component **may** omit implementation (`kind: 'none'`) and still be placeable.

## 6. Library package model (proposal — not schema)

Suggested conceptual contents (format TBD, acceptance later):

- Library id, name, version, license, origin  
- Categories  
- Components: stable library component id, metadata, port defs, parameter schema, symbol/asset refs, optional implementation payload or reference  
- Assets (SVG/PNG/…) by id + checksum  
- Dependency list for composed subsets  

**Master vs assignment subset:** export a **self-contained, versioned** subset so student work does not depend on a mutable master at runtime. Prefer copy-with-provenance over live references for course packs.

## 7. Shape representation (proposal priority)

Aligns with existing D3b–D3d:

1. Reuse generic / existing symbols as library faces  
2. Import/export component definitions  
3. Define functional ports  
4. Import SVG (prefer over bitmap for technical symbols)  
5. Import bitmaps for photos/boards  
6. Place ports on imported artwork  
7. Parameter schemas + generated editors  
8. **Then** deepen native Shape Editor (D3b already exists — extend, do not fork)

SVG security: keep refusing script, handlers, external links (`assets` / library audit already started).

## 8. Dynamic palette (proposal)

Host supplies which libraries appear. Loading a library is **not** a project undo step. Placing a component (including adopting its definition into the project) is **one** transaction.

Coexist with `BLOCK_TEMPLATES` until a host chooses to hide them.

## 9. Parameter schema (proposal)

Today: `Record<string, string>` only.  
Proposal: schema on the definition (type, unit, min/max, enum, default); values on the instance; generated inspector; each value edit = one transaction.

## 10. Library Manager (proposal)

Browse / edit / compose. Reuse editor primitives (select, port drag, resize, inspector, transactions) — **no second graphics stack**. Editing a **standalone master library file** may use its **own** history artifact (not the open student project stack).

## 11. Transaction Manager integration (proposal)

Binding rule from D5b: project-bound mutations share one chronological history. Library place / adopt / parameter / interface change → ≤1 entry per user action.  
Do **not** generalize `TransactionManager` in this planning phase. Asset-heavy snapshots → design issue for **D5d / CL5**, not a silent D5b rewrite.

### Asset vs snapshot risk (analysis)

Full project JSON currently embeds `ImageAsset.data`. Forty history strings would multiply large bitmaps. Long-term options to **study** (not implement now):

- Immutable asset table keyed by id/checksum; history stores references only  
- Content-addressed blobs outside the snapshot string  
- Cap or refuse oversized embeds in educational packs  

D5d remains the systematic performance / memory phase.

## 12. Versioning (proposal)

Distinguish: file schema version, library version, component version, assignment version, project `schemaVersion`. No silent upgrades; explicit upgrade later (compare to D3e spirit).

## 13. External formats (proposal)

Possible importers later: SVG packs, diagrams.net, KiCad, open symbol sets, HDL-Designer — only after structure **and license** review. General importer interface optional. **No** changes under `libs/`. No proprietary content without rights.

## 14. Security (proposal)

Treat student JSON, libraries, SVG, ZIP as untrusted: schema validate, size limits, SVG sanitize, no JS execution on open. Solution Viewer must assume hostile input.

## 15. Proposed CL roadmap (planning IDs)

| ID | Content | Depends on (soft) |
| --- | --- | --- |
| **CL0** | Architecture & data model acceptance | Analysis complete; ideally before locking D5f APIs |
| **CL1** | Library import/export/validate | CL0 |
| **CL2** | Dynamic palette + transactional place | CL1; benefits from D5b done |
| **CL3** | Library Manager + Composer | CL1–CL2; D5f helps packaging |
| **CL4** | Component Editor (ports, metadata, params schema) | CL0–CL2 |
| **CL5** | SVG/bitmap assets & safe processing | D3d base; D5d asset strategy |
| **CL6** | Generated parameter inspector | CL4; D5b transactions |
| **CL7** | Native shape editor depth | D3b base; after MVP |

**CL0 before or parallel to late D5f** is recommended so the reusable Vue package does not bake in hard-coded palettes.

Relation to existing **D4f–D4g** (HDL adapter libraries): keep separate; CL is domain-neutral. Relation to **Learning Mode L0**: complementary (local HDL courses vs browser/library-first education).

## 16. Inventory table (planned vs present)

| Planned capability | Foundation | Modules | Needed extension | Deps | Complexity | Risk | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project / component / instance | Strong | `component.ts`, `document.ts` | Provenance fields | — | M | Low | Implemented |
| Symbol library catalog | Strong | `library.ts`, palette | Functional component entries | CL0 | M | Med | Partial |
| Native shapes | Strong | `SymbolShape`, SymbolEditor | Manager UX | CL7 | H | Med | Partial |
| SVG/bitmap embed + audit | Strong | `assets.ts` | Pack/composer, snapshot policy | CL5, D5d | H | High (memory) | Partial |
| Instance parameters | Weak | `Block.parameters` | Schema + UI | CL4, CL6 | M | Med | Partial |
| Dynamic domain palette | Weak | `SymbolPalette`, templates | Library-driven | CL2 | M | Med | Conceptual |
| Library Composer | None | — | New host | CL3 | H | Med | Conceptual |
| Typed params / inspector | None | props panel | Generator | CL6 | M | Low | Conceptual |
| Asset-stable undo | None | `transaction.ts` | Snapshot design | D5d | H | High | Conceptual |
| External importers | None | — | Per format | later | H | High | Conceptual |

## 17. Open architecture decisions (not accepted)

1. Exact library JSON schema and whether `ComponentDefinition` gains `libraryComponentId` / version fields vs `extra`.  
2. Whether educational packs use ZIP or multi-file folders.  
3. Asset dedup strategy relative to Variant A snapshots.  
4. Whether Library Manager is a separate SPA or a mode of D5f.  
5. Final roadmap IDs (**CL/EDU** vs user draft L/E).  
6. Capability model shape (JSON flags vs allow-list of commands).

## 18. What this document is not

No code, no schema migration, no library implementation, no D5b.4 changes, no `libs/` edits. Implementation requires explicit acceptance of **CL0** (and related EDU decisions).
