# ADR — Executable Python block diagrams (future)

**Status:** **Architecturally accepted** (user review, 27 Nov 2026). Strategic guidance only — **not** an implementation release. **Not** a D-series / A2 / S5b / D5d / HDL-Maker milestone.  
**Strategic vision:** [diagram-lab-strategic-vision.md](diagram-lab-strategic-vision.md) (§3.7, related F-stages).  
**Related:** [adr-diagram-geometry-routing-style.md](adr-diagram-geometry-routing-style.md), [adr-diagram-animation-runtime.md](adr-diagram-animation-runtime.md), [diagram-lab-pilot-a2-findings.md](diagram-lab-pilot-a2-findings.md) (BPSK sketch as possible later executable pilot).

---

## 1. Decision

Diagram-Lab remains a **general-purpose diagram editor**. A possible future specialised host — working title **Python Simulation Studio** — may attach **executable semantics** to some symbols and designs.

| Preserve in Diagram-Lab core | Belong in application / backend |
| --- | --- |
| Geometry, symbols, ports, nets, hierarchy, history, libraries, styling, (optional) animation presentation | Python implementations, parameters for execution, model compile, schedule, runtime process, signal records, plots |

**Hard rules:**

- Graphical representation stays separate from executable semantics.  
- Not every symbol must have an implementation.  
- Executable fields must **not** become mandatory on every Lab object.  
- Simulation **runtime state** must not mutate the canonical editable document each step.  
- Simulation execution must **not** create document history entries.  
- Opening or importing a diagram must **never** auto-execute Python.  
- This ADR adds **no** dependencies, schema, UI, or simulator code.

---

## 2. Strategic motivation

HDL-Maker Studio and a Python block-diagram simulator share the same *graphical* problems (blocks, ports, wires, hierarchy, libraries) and differ mainly in **block semantics and execution backend**:

| HDL-Maker Studio | Python Simulation Studio (concept) |
| --- | --- |
| VHDL inside blocks | Python inside blocks |
| HDL types on ports | Python / NumPy types on ports |
| Digital signal nets | Values, signals, arrays |
| GHDL / GTKWave / Vivado | Python runtime / plots / local compute |

One Diagram-Lab core can therefore support **HDL Studio**, **Python Studio**, and **Education Studio** without three editors — provided simulation complexity stays in specialised backends.

Educational value: students edit parameters, probe signals, and optionally edit algorithms inside blocks (e.g. Digital Modulation Techniques), including embedding interactive models in teaching material later.

---

## 3. Compatibility with existing architecture

Reusable today (no change required for this ADR):

| Lab capability | Role for Python Studio |
| --- | --- |
| Blocks / symbols / instances | Model nodes |
| Ports | Function interfaces |
| Nets / junctions / by-name identity | Data dependencies |
| Hierarchy / components | Subsystems |
| Symbol libraries (embed + explicit update) | Reusable function blocks; portable teaching packs |
| JSON documents | Persistent models |
| Vue properties / FastAPI host (Studio) | Parameters, run controls, result UI |
| Planned code editor / animation | Implementation editing / playback of recorded signals |

A2’s BPSK + AWGN diagram is a natural **future** executable-model pilot once a dataflow runtime exists — **after** A2 symbol-library findings, not instead of them.

Optional later: same component **interface** with both a Python reference model and a VHDL implementation for teaching or automated comparison — not required by this ADR.

---

## 4. Related external systems (investigation only)

| System | Relevance | Notes |
| --- | --- | --- |
| **BDSim** + **bdedit** (Peter Corke) | Closest Python teaching Simulink analogue; continuous/discrete/hybrid; JSON `.bd`; MIT | Strong **adapter** candidate; no dependency added now |
| **GNU Radio Companion** | Streaming DSP / SDR; Embedded Python Blocks | Powerful; heavier streaming semantics |
| **Scilab Xcos** | Free dynamic-system GUI | Scilab-centric, not Python-first |
| **Ptolemy II** | Multiple models of computation | Research reference for MoC design |
| **MATLAB/Simulink** | Commercial reference | Feature ceiling — do **not** clone wholesale |

Licensing and API fitness of BDSim/GNU Radio must be re-checked before any prototype. **Do not** add packages during this investigation.

---

## 5. Execution models (progressive)

| Model | Example | Complexity | Early priority |
| --- | --- | --- | --- |
| Array-based acyclic dataflow | BPSK, QPSK, FIR, FFT | Low | **Yes — first prototype class** |
| Sample-based discrete time | Digital control, counters | Medium | Later |
| Stateful blocks | IIR, delay, registers | Medium | With discrete time |
| Continuous time | Analog / plant dynamics | Higher | Prefer BDSim study |
| Discrete event | Protocols, FSMs | Higher | Later |
| Hybrid | Mixed analog/digital | High | Later |
| Streaming / real-time / SDR | Live I/O | High | GNU Radio-class |

Do **not** design a universal simulation kernel prematurely. Feedback (e.g. A1 counter in Python) needs explicit state update ordering (old Q out → compute D → commit), analogous to sequential vs combinational HDL.

---

## 6. Backend architecture (conceptual)

```text
Diagram Document (JSON)
  → Model compiler / validator (connectivity, optional types, hierarchy)
  → Execution plan / scheduler
  → Controlled Python process (timeouts, cancel, limits)
  → Signal recorder
  → Visualisation (scope, FFT, constellation, animation overlays)
```

Separate:

1. Application-specific executable model (extensions / side documents — TBD when released).  
2. Graph compiler and validator.  
3. Runtime adapter (native dataflow **or** BDSim **or** GNU Radio).  
4. Isolated worker process.  
5. Result / visualisation interface (may reuse animation/runtime presentation layer).

### Backend options (compare later with a tiny prototype)

| Option | Advantage | Risk |
| --- | --- | --- |
| Minimal native Python dataflow | Full control; clear teaching semantics; owns Lab port/param contract | Must implement scheduler, state, probes |
| BDSim adapter | Rich dynamics already exist | External model/API coupling |
| GNU Radio adapter | High-performance DSP/SDR | System weight; streaming MoC |

**Recommendation (guidance only):** start with a **small native array dataflow** executor to learn interfaces; study BDSim in parallel for continuous/hybrid needs; consider GNU Radio only for SDR-scale work.

---

## 7. Security and reliability

| Requirement | Rule |
| --- | --- |
| Explicit run | User must approve execution |
| Trust | Distinguish trusted course packs vs untrusted imports |
| Isolation | Separate process; editor UI must not hang on infinite loops |
| Limits | Timeouts, cancellation, memory/CPU caps |
| Diagnostics | Surface Python tracebacks without crashing the host |
| Reproducibility | Pin environments for teaching examples where practical |
| Open / import | **Never** auto-run on load |

Public teaching platforms need stronger isolation than a local lab install.

---

## 8. Educational application examples (non-goals today)

Nachrichtentechnik (BPSK/QPSK/QAM, AWGN, BER, OFDM); DSP (FIR/IIR/FFT); Regelungstechnik; Digitaltechnik reference models; Bildverarbeitung; Robotik; interactive scriptum embeds.

---

## 9. Open architectural questions

1. Where do Python implementations live — document extension, side-by-side artefact, or library-only?  
2. How are port/runtime types checked without forcing HDL types onto Lab?  
3. Multi-rate and feedback: how much belongs in native runtime vs BDSim?  
4. Can Symbol Designer / Lab geometry infrastructure author “sim blocks” without a second engine?  
5. How do Python reference models share interfaces with VHDL components?  
6. What minimal probe/plot UI belongs in Studio vs external notebooks?

---

## 9a. Deferred to a future implementation specification

Recorded at ADR acceptance; **not** acceptance blockers and **not** current work:

| Aspect | Later questions |
| --- | --- |
| **Data contracts** | Element type, array shape, sample rate, physical units (a bare NumPy array is not a full signal description) |
| **Reproducibility** | RNG seeds, parameters, Python and library versions for teaching packs |
| **Implementation versions** | Binding between Python bodies and symbol / component revisions |
| **Execution security** | Filesystem/network policy, process privileges, resource limits beyond “separate process” (isolation ≠ sandbox) |

Python-as-VHDL-reference (shared ports/parameters → NumPy reference vs GHDL → compare → FPGA) remains a high-value **didactic** option for a later freigabe — not part of A2.

---

## 10. Risks and limitations

- Scope creep toward “open Simulink” — reject; keep MoC ladder.  
- Security of executable teaching content.  
- Dual maintenance if adapters drift from Lab connectivity rules.  
- Student confusion between illustrative Education diagrams and executable models — product UX must label modes.  
- Premature schema pollution of Diagram-Lab core.

---

## 11. Explicit non-goals (this ADR)

No Python simulator, scheduler, executable block schema, code-editor changes, UI, dependencies, catalog changes, roadmap renumbering, commit, or push.

Must **not** delay A2, S5b, D5d, or HDL-Maker Studio gates.

---

## 12. Guiding statement

**One diagram core; specialised backends for meaning and execution.**  
Build HDL and teaching diagrams today; keep the door open for a Python Simulation Studio tomorrow — through separation of concerns, not through speculative infrastructure.
