# Educational Web Applications — architecture (proposal)

**Status:** strategic roadmap extension **accepted** (25 Nov 2026). Stream EDU0–EDU6 remains **planned only** — not released for implementation. Concrete pack formats and embed choices stay open until a future EDU0 acceptance.  
**Sister document:** [component-library-system-architecture.md](component-library-system-architecture.md).  
**Does not replace** D5b priorities or accepted diagram-lab decisions.

## 1. Naming

| Draft label (user) | Planning ID in this repo | Reason |
| --- | --- | --- |
| E0–E6 Educational | **EDU0–EDU6** | **E0–E6** already mean Studio editor |
| Assignment / Learning Mode | Distinct from **L0** Learning Mode | L0 is local offline HDL courses ([learning-mode.md](learning-mode.md)) |

EDU targets **browser / web-script** delivery without HDL toolchains. L0 targets **local HDL-Maker** course packages. Both may share the diagram core later; they are not the same product.

## 2. Didactic scenario (binding vision for EDU)

Lecturer builds an assignment (e.g. QPSK Transmitter) with a **small task library** (≈10 components, possibly including distractors) and optional starter project. Students:

1. Pick components from the assignment palette  
2. Place, move, wire, parameterize  
3. Save a **standalone JSON** solution  
4. Submit via BASIN / email  

Lecturer reopens the file and inspects the full design. **No** central DB, accounts, auto-grading, or simulation server in v1.

## 3. Browser standalone requirements (analysis)

Desired: no student install, no Python backend for pure graphic tasks, no local npm, no HDL/Vivado/license servers; static hosting; load library + optional starter; edit in browser; JSON I/O; embed in web scripts.

### Integration variants (comparison — not chosen)

| Variant | Effort | Portability | Isolation | Reuse |
| --- | --- | --- | --- | --- |
| **iframe** host page loads static editor URL with query/hash for assignment pack | Low–M | High | Strong (origin sandbox) | Good for web scripts |
| **Vue component** (`D5f`) imported by host Vue/Nuxt app | M–H | Needs same build toolchain as host | Shared JS heap | Best for HDL-Maker / Nuxt |
| **Standalone JS bundle** (IIFE/ESM) | M | High if assets inlined | Medium | Good for non-Vue hosts |
| **Web Component** wrapper | H (later) | Highest for mixed stacks | Medium | Optional after D5f |

**Proposal:** design **EDU2** against a **static bundle or iframe** first; keep **D5f Vue export** as the shared surface HDL-Maker and Nuxt use. Do not require the Python/HDL backend for EDU v1.

Existing lab is Vite + Vue 3 + Vue Flow — a static `vite build` is the natural packaging path once D5f/EDU2 are accepted.

## 4. Assignment package (proposal)

Conceptual contents (format TBD):

- `assignment.json` — id, version, title, description, refs, capabilities, submission hints  
- `library.json` — self-contained task library (CL subset)  
- `starter-project.json` — optional `DiagramProject`  
- assets / optional markdown  
- optional validation rules (EDU5 later)

Prefer **self-contained** packs so reproducibility does not need the master library.

## 5. Capability / permission model (proposal)

Host or assignment sets allow/deny for: place from palette, generic blocks, define components, edit interfaces, ports, parameters, wire, move, resize, open/edit hierarchy, import libraries, export JSON/SVG, etc.

Implement as **host policy** around the editor command surface — not special cases inside Diagram Core. Client-side flags are **UX guidance**, not anti-cheat.

## 6. Student solutions & reproducibility (proposal)

Prefer: **adopt used component definitions into the project** (same spirit as D3c copy-on-place); keep `libraryComponentId` + version as provenance; embed small assets; optional ZIP for large media. Old solutions must not silently track newer library versions. History stays out of the file (D5b rule).

**No schema migration in this planning phase.** Future fields go through an accepted schema bump.

## 7. Solution Viewer (proposal — EDU4)

Same editor, preferably read-only mode. Opening student JSON in the normal editor is enough for MVP. No second renderer.

## 8. Solution Checker (proposal — EDU5, later)

Graph/rule checks on **functional** topology and parameters; layout-agnostic; multiple accepted solutions. Not in MVP.

## 9. Simulation (proposal — EDU6, later)

Keep graphics, interface, and simulation model separate. Editor must not require a simulator. Optional later hooks (logic, DSP, Python, GHDL, plots).

## 10. Proposed EDU roadmap

| ID | Content | Soft dependencies |
| --- | --- | --- |
| **EDU0** | Educational architecture acceptance | This doc + CL0 |
| **EDU1** | Assignment packages | CL1 |
| **EDU2** | Standalone educational web editor | D5b done; D5f helpful; static build |
| **EDU3** | Student JSON import/export & provenance | Project model; CL2 |
| **EDU4** | Solution Viewer | EDU2–EDU3 |
| **EDU5** | Solution Checker | EDU3+ |
| **EDU6** | Optional simulation | Separate backends |

## 11. MVP path (first usable course exercise)

**Goal:** lecturer ships a pack; students edit in browser; JSON returns; lecturer opens it.

Minimum stack (proposal):

1. **CL0** acceptance of library/component provenance model  
2. Author small library (even manually / scripted JSON) — full Manager not required  
3. **CL1**-level load/validate of that library  
4. **CL2**-level palette + place (transactional)  
5. Wire / move / resize (existing D5 editor after D5b)  
6. **CL6**-lite or simple string parameters for MVP if schemas lag  
7. Save project JSON (**EDU3**)  
8. Lecturer reopen (**EDU4** = open in same editor)

**Can wait:** CL7 shape editor, external importers, auto upgrade, EDU5 checker, EDU6 simulation, accounts, server submission.

### Suggested MVP order vs full vision

```
D5b complete → CL0 → (manual/JSON libraries) → CL1/CL2 → EDU1/EDU2/EDU3
     ↑
D5c/D5e improve authoring & export in parallel when released
D5f packages the surface used by EDU2 and HDL-Maker
D5d addresses asset/snapshot cost before large bitmap packs
```

## 12. Relationship to Learning Mode (L0)

| | Learning Mode L0 | EDU stream |
| --- | --- | --- |
| Host | Local HDL-Maker | Browser / web script |
| Toolchains | May use GHDL/FPGA later | Not required for v1 |
| Package | Course package on disk | Assignment pack (library + starter) |
| Checker | Lesson checks (future) | EDU5 (future) |

Share the **diagram core** and eventually D5f; do not merge roadmaps into one ID space.

## 13. Open decisions

1. iframe vs Vue embed vs static bundle for first deployment  
2. Assignment pack = folder vs ZIP  
3. How capabilities are expressed  
4. Whether MVP parameters stay untyped strings  
5. BASIN integration (out of editor scope)

## 14. Accepted strategic recommendations (shared with CL)

- MVP may start from manual library JSON + existing editor after D5b; full Manager (CL3) and Shape Editor (CL7) are not MVP gates.
- Prefer knowing CL0 host seams before locking D5f packaging APIs.
- Asset/snapshot cost stays with D5d / CL5.
- Auto-grading (EDU5) and simulation (EDU6) remain post-MVP.

## 15. Boundaries

**EDU0–EDU6 stay locked** until an explicit implementation release. No assignment system code, no web deploy, no schema change from this acceptance alone.
