# D5d — Large diagrams & performance (final prep specification)

**Status:** Specification complete for D5d.0 planning. **D5d.0-A (generator) released for implementation**; D5d.0-B–D not released.  
**Baseline:** `d68b185`.  
**Not** a binding roadmap reorder until explicitly accepted into `roadmap.md` / `diagram-editor-roadmap.md`.

Context: After D5b.5 and D5c.6 acceptance (26 Nov 2026), the lab has a stable interactive baseline. The HDL-Designer inventory (§5) is **accepted as the basis for further specification**, subject to documented extraction limitations. §11 residual questions are **decided** below. Generators may be implemented under D5d.0-A; harnesses, Benchmark Center, mapper, extractor fixes, and optimisations stay closed until separately freigegeben.

## 1. Intent

| Phase | Goal |
| --- | --- |
| **D5d.0 (prep / measure)** | Reproducible cost vs size; Class A + synthetic Class B (topologies A/B/C); Benchmark Center prepared for three source classes; Class C real docs deferred; go/no-go on architecture changes |
| **D5d.1+ (later, only if warranted)** | Targeted fixes — only after measurement acceptance |
| **Separate integration (not D5d.0)** | Studio→Lab mapper with correct net semantics; then real HDL diagrams in Benchmark Center |

**Out of scope until freigabe:** premature virtualisation, canvas rewrite, dual history, CL/EDU, D5b.6, D5c.7a, detachable toolbar, Studio→Lab mapper, HDS extractor fixes, production editor behaviour changes, roadmap reorder.

## 2. Architecture invariants (must hold)

Same four rules as the consolidation baseline:

1. One shared history (Variant A).  
2. Gesture preview from baseline each frame.  
3. Sheet net-name identity (D5c.5).  
4. Toolbar = chrome, not viewport content.

Additional constraints for benchmark infrastructure:

- The generic diagram editor must not know whether a document came from HDL Designer, a synthetic generator, or another app.  
- Original `libs/sbus_rtc_lib` stays unmodified; edits only on working copies.  
- Synthetic benchmarks must run without an installed HDL library (optional library must not become a mandatory dependency).  
- No second diagram editor for benchmarks — reuse Diagram-Lab and existing document operations.  
- Benchmark tooling should remain usable after a later Vue-library extraction (D5f).  
- Do not auto-bundle the legacy library into Git or the portable distribution.

## 3. Proposed D5d.0 work packages

| Package | Content | Status for this prep |
| --- | --- | --- |
| **D5d.0-A0** | HDL-Designer library inventory (§5–§6) | Analysis complete |
| **D5d.0-A** | Deterministic synthetic generator (sizes + topologies A/B/C) | **Released for implementation** |
| **D5d.0-B** | Node / core-document benchmark harness | Spec only |
| **D5d.0-C** | Browser paint / interaction benchmark harness | Spec only |
| **D5d.0-C2** | Permanent Diagram-Lab **Benchmark Center** + Performance monitor | Spec only |
| **D5d.0-D** | Baseline measurement report and go/no-go | Spec only |

None of A–D is released for implementation by this update.

---

## 4. Benchmark source policy

The three classes **complement** each other; none replaces another. The Benchmark Center architecture is prepared for all three from day one; Class C documents stay **marked unavailable** until a separately approved mapper exists.

| Class | Data basis | D5d.0 policy |
| --- | --- | --- |
| **A – Baseline** | Existing `benchSheet` | Unchanged; historical reference |
| **B – Synthetic** | Deterministic generators, 50–1 000 blocks, topologies A/B/C | **Primary measurement surface** for D5d.0 |
| **C – Real world** | `libs/sbus_rtc_lib` statistics → topology C; later real lab docs via mapper | **Statistics-only** in D5d.0; no Studio→Lab mapper in D5d.0 |

**Studio→Lab mapper:** needed eventually for Studio adoption of the generic editor, but **not** a D5d.0 blocker. Treat as a separately approved integration task. Wrong net-semantics decisions under benchmark time pressure are worse than delayed Class C interactivity.

### 4.1 Class A — `benchSheet` (already in tree)

From `diagram-lab/src/core/acceptance.ts` / selfcheck:

| Element | Count |
| --- | --- |
| Blocks | 50 (49 × Cell + 1 × Wide) |
| Segments | 350 |
| Ports | ≥300 (Wide alone has 86) |
| Labels | 350 |
| Nets | 40 |
| Junctions | 8 |

Rough density: **7.0 segments per block**, **0.8 nets per block**. Topology is regular grid + one high-port “Wide” sink — useful as history baseline, not as a model of HDS density.

### 4.2 Class B — Synthetic sizes and topologies

**Sizes:** 50 / 100 / 250 / 500 / 1 000 blocks.  
**Initial recipes** (generator targets, not exact measured equivalences):

| Parameter | A — Regular | B — High Connectivity | C — HDL-derived |
| --- | --- | --- | --- |
| Segments / block | ≈ 7 | ≈ 20–25 | ≈ 15 |
| Nets / block | ≈ 0.8 | Depends on branching (stress) | ≈ 8.5 |
| Ports / block | ≈ 10 | ≈ 20–30 | ≈ 14–16 |
| Label density | High | High | Near 100 % (≈1 name label per segment) |
| Branching / junctions | Low | Deliberately high | HDS-oriented moderate |
| By-name / stubs | Low | High | Variable |
| Role | Bench-comparable | Constructed stress | Statistical approach to `top_rtc_app` |

Topology B parameters are **proposed stress values**, not library measurements. Topology C parameters are **derived from §5 inventory** (especially `top_rtc_app`), still fully synthetic/generic geometry.

#### Linear scale sketch at ≈15 segments/block (topology C density)

| Blocks | ≈ Segments | ≈ Nets (×8.5) | ≈ Labels | ≈ Ports (×15) |
| --- | --- | --- | --- | --- |
| 50 | 750 | 425 | 750 | 750 |
| 100 | 1 500 | 850 | 1 500 | 1 500 |
| 250 | 3 750 | 2 125 | 3 750 | 3 750 |
| 500 | 7 500 | 4 250 | 7 500 | 7 500 |
| 1 000 | 15 000 | 8 500 | 15 000 | 15 000 |

Linear extrapolation of chosen density — **not** measured performance. A 1 000-block HDL-oriented sheet is a demanding DOM/SVG test size.

**Preliminary interactive observations (D5d.0-A acceptance, not a quantified campaign):** ~50 blocks still usable for block drag; above ~50 drag feels insufficient; 1 000 blocks failed to load. Cause unknown (model / preview / Vue / SVG / Vue Flow / memory). Proposed later size densification for the campaign: add **10, 25, 75** between the existing steps. Details: [d5d0a-stub-block-move.md](d5d0a-stub-block-move.md).

#### Generator documentation requirements (when implemented)

Each recipe must record: **seed**, layout algorithm, connectivity model, polyline complexity, symbol-geometry profile, and exact counts produced (blocks, ports, nets, segments, junctions, labels, stubs).

**Fan-out metrics — keep separate:**

| Metric | Meaning |
| --- | --- |
| Wires / segments per `net_object` (or lab `netId`) | How many polylines share one net identity (inventory fan-out max 24 on `top_rtc_app`) |
| Sink-pin fan-out | How many distinct input/sink ports attach to one net |

Do not conflate the two in reports or generator knobs.

**Polyline complexity:** prefer short polylines (median ≈2–3 points) for HDL-derived profiles; optional longer manual routes as a separate knob.

**Symbol geometry (synthetic):** two profiles — **simple** (rect / few shapes) and **complex** (multi-shape symbols, more ports). Real `.sb` mapping deferred to the future adapter.

### 4.3 Class C — Real HDL-Designer diagrams

- Source library remains optional and read-only.  
- D5d.0 uses inventory **statistics only** (feeds topology C).  
- Benchmark Center UI reserves a Class C source selector that stays **disabled / unavailable** until mapper freigabe.  
- Absence of the library must not break Class A/B or CI smoke benches.

---

## 5. D5d.0-A0 — HDL-Designer library inventory (read-only, accepted)

**Scope inspected:** `libs/sbus_rtc_lib` (unchanged).  
**Method:** existing `backend/app/importers/hds/extract.extract_graphical` (Studio `DiagramDocument`), plus file/workspace counts. No import fixes.

### 5.1 Library file inventory

| Artefact | Count | Notes |
| --- | --- | --- |
| Block diagrams (`*.bd` / `struct.bd`) | **8** | Under `hds/*/struct.bd` |
| Symbols (`*.sb`) | **46** | Confirms M1.5 |
| State diagrams (`*.sm`) | **14** | Confirms M1.5; **out of scope for D5d.0** |

### 5.2 Per–block-diagram statistics (HDS → Studio extract)

Counts are **Studio `DiagramDocument` fields**. Column “Fan-out” = **wires sharing the same `net_object`**, not sink-pin fan-out.

| Diagram | Parse | Inst. | Diag. ports | Inst. ports | Nets | Wires | Wires/inst | Fan-out avg | Fan-out max | BdJunction records | Junctions extracted | Wire labels | Embedded HDL | Source bytes | Preserved types |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `audio_dsp` | parsed | 3 | 14 | 22 | 21 | 30 | 10.0 | 1.43 | 4 | 2 | **0** | 30 | 3 | ~80 KB | — |
| `audio_gain` | parsed | 2 | 14 | 14 | 19 | 25 | 12.5 | 1.32 | 2 | 5 | **0** | 25 | 3 | ~71 KB | — |
| `codec_interface` | partial | 3 | 24 | 39 | 57 | 64 | 21.33 | 1.12 | 4 | 1 | **0** | 64 | 5 | ~135 KB | `PageSetupInfo` |
| `fxgen` | partial | 2 | 12 | 12 | 22 | 26 | 13.0 | 1.18 | 3 | 1 | **0** | 26 | 5 | ~78 KB | `CommentGraphic`, `Mux`, `PageSetupInfo` |
| `i2c_interface` | parsed | 2 | 20 | 33 | 43 | 45 | 22.5 | 1.05 | 2 | 1 | **0** | 45 | 1 | ~98 KB | — |
| `tb_audio1` | partial | 11 | 0 | 102 | 50 | 65 | 5.91 | 1.30 | 6 | 5 | **0** | 65 | 3 | ~156 KB | `FFT` |
| **`top_rtc_app`** | partial | **23** | **45** | **329** | **195** | **347** | **15.09** | **1.78** | **24** | 2 | **0** | **347** | 19 | **~571 KB** | `FFT`, `Mux` |
| `vga_txt_core` | partial | 5 | 14 | 34 | 27 | 32 | 6.4 | 1.19 | 3 | 1 | **0** | 32 | 1 | ~90 KB | `FFT` |

**Wires per instance (hypothesis HDS-Wire ≈ lab Segment, not finally validated):**

| Diagram | Wires / inst |
| --- | --- |
| `i2c_interface` | 22.5 |
| `codec_interface` | 21.3 |
| `top_rtc_app` | 15.1 |
| `fxgen` | 13.0 |
| `audio_gain` | 12.5 |
| `audio_dsp` | 10.0 |
| `benchSheet` (lab) | 7.0 |
| `vga_txt_core` | 6.4 |
| `tb_audio1` | 5.9 |

#### `benchSheet` vs `top_rtc_app`

| Property | benchSheet | top_rtc_app |
| --- | --- | --- |
| Blocks / instances | 50 | 23 |
| Segments / wires | 350 | 347 |
| Nets | 40 | 195 |
| Labels | 350 | 347 |
| Ports | ≥300 | 374 (329 instance + 45 diagram) |
| Segments per block | 7.0 | 15.1 |
| Nets per block | 0.8 | 8.5 |

Wire density differs; **independent logical nets per block** differ even more — relevant for net resolution, history, labels, and by-name semantics.

**Polyline complexity:** typically min/median **2** points, max 3–6.  
**Every diagram:** `GlobalConnector` count 1; named nets ≈ net count.

### 5.3 Wire vs segment (mapping clarification)

| Layer | Object | Meaning |
| --- | --- | --- |
| HDL Designer | `Wire` record | One named polyline; `start`/`end`/`on` refs; optional label; `shape.pts` |
| Studio importer | `DiagramWire` | ≈1:1 with extracted `Wire` (`record_counts["Wire"]` consistently **extracted + 2** in this library) |
| Diagram-Lab | `Segment` | One routed polyline bound to a `netId` |

**Working hypothesis:** **1 HDS `Wire` ≈ 1 Studio `DiagramWire` ≈ 1 lab `Segment`** for density comparisons — not “one orthogonal corner edge.” Final validation waits for a real mapper.

### 5.4 Junctions, labels, symbols, hierarchy, extent

| Parameter | Finding / policy |
| --- | --- |
| **Junctions** | `BdJunction` records exist but are not reached by `_descendants(model)` → **0 extracted**. **Do not** reconstruct junctions from geometric endpoint coincidence (crossing ≠ electrical join). Fix later at the extractor under separate approval. |
| **Labels** | Near-100 % wire-label density in extract → synthetic recipes should match. |
| **By-name / GlobalConnector** | Present in HDS; semantic mapping to D5c.5 / stubs belongs to the **future adapter** specification. |
| **Symbol geometries** | Synthetic simple/complex profiles in D5d.0; real `.sb` conversion deferred. |
| **Hierarchy depth** | Project-graph property; not a single integer per `struct.bd` in this pass. |
| **Extent / coordinates** | Large HDS units (e.g. `top_rtc_app` ~226 000 × 192 000). Uniform transform preserving relative geometry belongs to the future adapter. |
| **Document size** | `.bd` ~571 KB; Studio editable ~601 KB; lab JSON unknown until mapper exists. |

### 5.5 Workspace / Studio materialisation

Local `workspace/diagrams` currently has block editables for `top_rtc_app`, `audio_gain`, `fxgen` (+ three FSMs). Five of eight BDs lack a local editable copy. Studio extract of all eight `.bd` files still works. **Diagram-Lab has no Studio/HDS loader.**

---

## 6. Import feasibility — decisions for D5d.0

| Situation | Decision |
| --- | --- |
| Studio HDS → `DiagramDocument` | Use for **statistics** only in D5d.0 |
| Extractor gaps (junctions, preserved Mux/FFT/…) | Document; **separate freigabe** to fix — not D5d.0 |
| Studio→Lab mapper | **Out of D5d.0**; separate integration step |
| Class C interactive benches | After mapper acceptance |
| Unsupported / missing elements | Never drop silently; call out in reports |

Do **not** turn D5d into an HDL-import milestone.

---

## 7. Decisions on former open questions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Class C import | **Stats-only** for D5d.0; mapper separately approved |
| 2 | Junctions | **No** geometric inference; fix extractor later at source |
| 3 | Coordinate scaling | Future adapter: uniform transform, preserve relative geometry |
| 4 | Symbol geometries | Synthetic simple + complex profiles; real `.sb` later |
| 5 | GlobalConnector / stubs | Semantic mapping in future adapter spec |
| 6 | FSM diagrams | **Out of scope** for D5d.0 (block diagrams only) |
| 7 | Instrumentation overhead | **Monitor on/off** comparison required |
| 8 | Benchmark Center location | **Permanent separate Diagram-Lab view** |
| 9 | CI | Small functional benchmark **smoke** in CI; full performance campaign separate; library optional |

---

## 8. Permanent Benchmark Center (Diagram-Lab)

**Role:** durable developer / QA infrastructure for D5d and later editor changes — not a one-off script. Own lab view; editor chrome stays clean.

### 8.1 Capabilities

| Action | Purpose |
| --- | --- |
| **Open in Editor** | Load selected bench document into the **existing** editor |
| **Reset** | Restore exact baseline document, **history**, and **viewport** |
| **Run Benchmark** | Reproducible automated measurement sequence |
| **Performance Monitor** | Optional live metrics during interactive edits (fully disableable) |
| **Save Results** | Machine-readable JSON |
| **Compare Results** | Compatible runs across Git revisions / builds |

### 8.2 Shared definitions

Benchmark **definitions** (source, size, topology, gesture scripts, correctness checks) live independent of UI and are shared by:

- Benchmark Center (interactive + automated),  
- Node harness (D5d.0-B),  
- Browser automation (D5d.0-C),  
- later CI smoke tests.

This prevents the three measurement paths from drifting apart.

### 8.3 Operating modes

| Mode | Behaviour |
| --- | --- |
| **Interactive** | Open sheet in existing editor; optional Performance monitor |
| **Automated** | Scripted gestures; JSON export; compare across revisions |

### 8.4 Result metadata (every run)

Configuration (class, topology, size, viewport, gesture set), document hash, generator version, seed, Git revision, **working-tree dirty state**, Node/browser versions, hardware note, instrumentation on/off, sample counts.

### 8.5 Illustrative monitor fields

FPS (rAF approximation), frame p95, preview p95, blocks/ports/segments/nets, history depth, serialized bytes, last undo ms — example values only until measured.

---

## 9. Measurement protocol

### 9.1 Principles

- Measure first; **no** performance optimisations in D5d.0.  
- Separate **core/document** (Node) from **Vue / Vue Flow paint** (browser).  
- Browser measurements use a **production build**.  
- **Reset** document, history, and viewport between independent runs.  
- Instrumentation must **not** create extra history entries.  
- Every automated gesture also checks **functional correctness** and history invariants (a fast wrong editor is a failed benchmark).  
- Measure instrumentation overhead via **monitor on vs off**.  
- Keep Diagram-Lab vs Studio streams separate; preserve the four invariants.

### 9.2 Repetitions and gestures

| Environment | Warm-up | Measured runs |
| --- | --- | --- |
| Node | 5 | **20** |
| Browser | 2 | **5** |

- Target **120 defined preview steps** per timed gesture.  
- Record separately: actual pointer-event count, preview count, frame intervals, gesture wall duration.  
- Report **median, p95, maximum**, and sample counts.

### 9.3 Operations and viewports

| Area | Include |
| --- | --- |
| Gestures | Block drag, **block resize**, port drag, pan, zoom |
| Viewports | Fit-to-sheet **and** a defined working zoom |
| History depth samples | 0, 10, 50, 100, 200 (or actual history limit if lower) |
| Memory | Distinguish **serialized document bytes** from **measured heap usage** |
| Load | Parse/build time; first paint separately if measurable |
| Undo / redo | Latency at each history depth sample |

### 9.4 Indicative performance targets (not binding acceptance)

Orientation only for go/no-go discussion after D5d.0-D — **not** pass/fail gates in D5d.0:

| Area | Indicative comfort zone (sketch) |
| --- | --- |
| Interactive preview / frame | Prefer p95 well under one frame budget at working zoom on mid sizes (≈250 blocks, topology C) |
| Undo / redo | Noticeable but usable on mid sizes; document cliff toward 500–1 000 |
| Load / serialize | Document absolute ms and bytes; no hard limit yet |

Binding thresholds, if any, require a later explicit acceptance after the measurement report.

### 9.5 Campaign outputs

- Tables: size × topology × metric × viewport × instrumentation.  
- Machine / OS / CPU notes.  
- `docs/d5d0-measurement-results.md` (or successor) when D5d.0 is implemented and run.  
- Explicit go/no-go: optimise now / adequate / revisit after D5e–D5f.

---

## 10. Acceptance sketch (future D5d.0 implementation release)

1. This specification accepted.  
2. Generators + shared definitions + Node/browser harness + Benchmark Center implemented per packages A–C2.  
3. Class C selector present but unavailable without mapper; A/B run without legacy library.  
4. Results checked into `docs/`; go/no-go written.  
5. `selfcheck` green; no silent product behaviour change.  
6. Roadmap status updated only on release/acceptance.  
7. Mapper / extractor fixes remain **out of** that release unless separately freigegeben.

---

## 11. Residual questions — decided

| Topic | Decision |
| --- | --- |
| **Working zoom** | Scale **1.0** (100 %). Automated browser runs use a reference viewport of **1440 × 900** CSS pixels. Always record **actual** viewport width/height. Manual interactive benches may use the real window size. Where cheap, also record counts of blocks/ports/segments currently visible. |
| **Gesture scripts** | Deterministic **standard** and **stress** scenarios; **120 intended preview steps**. Record intended steps, actual pointer events, preview calls, and frame intervals separately. Stress picks are deterministic (e.g. block with most attached segments). Browser automation must drive **real editor interaction paths** (pointer/history/Vue), not internal shortcuts that bypass them. |
| **Gesture matrix** | Block drag, block resize, port drag, pan (H/V + diagonal stress), zoom (working ↔ fit-to-sheet), undo/redo (single + mixed series) — each with standard and stress variants as applicable. |
| **Topology B stubs** | Use **existing supported stub / free-endpoint semantics only** (D5c.5/D5c.6 document state). **No D5c.7a** dependency. |
| **History limit** | Respect the **existing** TransactionManager limit; do not raise it for benches. Report **requested vs effective** depths. |
| **Heap** | Node: `process.memoryUsage()`. Browser heap: **optional**; if unsupported, mark `unavailable` (never fake 0). Track (1) serialized document + history bytes, (2) heap before/after an op series, (3) peak during series when reliable. Browser heap is **not** required for D5d.0 acceptance. |
| **Compare levels** | **Comparable** — same document, protocol, ops, comparable runtime; different Git revisions allowed/desired. **Informational only** — e.g. different hardware/browser/viewport; show but do not treat as regression. **Incompatible** — different document, gesture definition, or metric meaning; no %-compare. Each result embeds a **versioned benchmark-definition fingerprint** (Git commit alone is insufficient). |
| **Class A** | **`benchSheet` mandatory** under the new Node/browser protocol; keep the fixture unchanged and keep existing selfcheck working. |
| **Orientation values** | Remain non-binding until **after the first dry-run review**; no post-hoc beautifying of measured numbers. |

### 11.1 Staged implementation freigabe

| Package | Freigabe |
| --- | --- |
| D5d.0-A0 inventory | Done |
| D5d.0 specification | Done (this document) |
| **D5d.0-A generator** | **Released** — generator + stub/routed wiring accepted in progress |
| **D5d.0-A stub-move** | **Released** — rigid Port↔Free stub translation on block move; see [d5d0a-stub-block-move.md](d5d0a-stub-block-move.md) |
| **Selection / stub-copy** | Investigation: [d5d0a-selection-stub-copy-investigation.md](d5d0a-selection-stub-copy-investigation.md). **S3 accepted** — [d5d0a-s3-stub-aware-copy.md](d5d0a-s3-stub-aware-copy.md). **S4 for acceptance** — [d5d0a-s4-stub-resize-port-drag.md](d5d0a-s4-stub-resize-port-drag.md). S1/S2 after D5d campaign. |
| D5d.0-B Node harness | Not released |
| D5d.0-C / C2 browser + Benchmark Center | Not released |
| D5d.0-D campaign / go-no-go | Not released |
| Performance optimisations | Not released |

Generator recipes and acceptance notes: [d5d0a-generator.md](d5d0a-generator.md).

---

## 12. Relation to roadmap recommendation

User preference (26 Nov 2026, not yet binding): prefer investigating **D5d** next over opening D5b.6 / CL / EDU / D5c.7a. Export (D5e) and Vue library (D5f) after interfaces stabilise. This prep file supports that discussion **without** changing the committed milestone order until freigabe.

**Constraints for slices beyond D5d.0-A:** no Node/browser harness yet; no full Benchmark Center; no mapper or extractor changes; no performance optimisations; no modifications to `libs/sbus_rtc_lib`; no roadmap reorder; D5b.6 / D5c.7 / CL / EDU remain closed or deferred; Diagram-Lab and Studio stay separate; no commit or push without explicit approval.
