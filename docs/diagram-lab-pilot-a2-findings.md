# Application Pilot A2 — Findings and execution kit

**Status:** **A2.1 BPSK demonstrator accepted** (28 Nov 2026) — [close-out](diagram-lab-pilot-a2-bpsk-demonstrator.md). A2.2–A2.3 library lifecycle remain optional.  
**Baseline:** A1 closed @ `730dfb6`. Prep accepted — [a2-preparation](diagram-lab-pilot-a2-preparation.md).  
**Related:** [application pilots](diagram-lab-application-pilots.md), [D5d handoff](status-handoff-2026-11-26-d5d.md).

**Focus:** Symbol definitions, primitives, import/export, instance behaviour, persistence, reuse — **not** new drawing features.  
**Later (not this pilot):** the same BPSK sketch is a candidate for an executable Python dataflow prototype — [Python ADR](adr-executable-python-block-diagrams.md) — only after a separate freigabe; A2 stays graphics/library-first.

**A2.1 presentation limits (user):** port–graphic gaps; missing scientific math — [investigation](diagram-lab-pilot-a2-scientific-presentation-investigation.md). **A2-P1 + A2-P2 closed** — [p1](diagram-lab-pilot-a2-p1-symbol-connections.md), [p2](diagram-lab-pilot-a2-p2-display-labels.md). **A2-P3/P3a** LaTeX **closed** (wire 14/14; block aggregate regression) — [p3](diagram-lab-pilot-a2-p3-latex-labels.md), [p3a](diagram-lab-pilot-a2-p3a-block-latex.md). **A2-P4 closed** — [p4](diagram-lab-pilot-a2-p4-markdown-math.md) (Markdown+Math, visual accept). Object Snap deferred.

---

## 1. Part trials

| Part | Focus | Artefact |
| --- | --- | --- |
| **A2.1** | BPSK + AWGN with **existing** builtins | §2 manual instructions |
| **A2.2** | Import **Communication Systems** test library | §3 library + import steps |
| **A2.3** | Lifecycle: instances, embed, update, conflicts | §4 checklist |

Classify observations as: functional defect / essential missing capability / useful convenience / future architecture / application-specific. **Do not auto-implement.**

---

## 2. A2.1 — Manual drawing (existing catalog only)

### 2.1 Target topology

```text
Bit Source → Mapper → Multiplier ──→ Adder → Channel out (free end or stub)
                         ↑              ↑
                 Carrier (Pictures)   Noise (Generic)
```

### 2.2 Recommended catalog entries

| Role | Library | Symbol | Id | Pins to use |
| --- | --- | --- | --- | --- |
| Bit Source | General | Generic block *or* Rectangle | `sym_block` / `sym_rectangle` | Create right port or use template ports; rename / P2 text “Bits” |
| Mapper | General / Flowchart | Generic block *or* Process | `sym_block` / `sym_process` | in←left, out→right; display text “Mapper” |
| Multiplier | Signal Processing | **Multiplier** | `sym_multiplier` | `a` = baseband, `b` = carrier, `y` = RF |
| Carrier | **Pictures** | **Oscillator** | `sym_oscillator` | `out` → Multiplier `b`; `gnd` optional / unused |
| Adder | Signal Processing | **Adder** | `sym_adder` | `a` = mixer out, `b` = noise, `y` = channel |
| Noise | General | Generic block | `sym_block` | right port → Adder `b`; display text “AWGN” |

Sizes (after A2-P1 catalog fix): Adder/Multiplier **120×120**; Oscillator **160×120**; Generic block **160×80**; Process **200×120**. Older sheets need Compare → Update.

### 2.3 Drawing steps

1. Open Diagram-Lab; empty or new sheet.  
2. From palette **Signal Processing**: place Multiplier, Adder.  
3. From **Pictures**: place Oscillator.  
4. From **General**: place two Generic blocks (Bit Source, Noise) and one Mapper (or Process).  
5. Arrange left→right: Source → Mapper → Multiplier → Adder.  
6. Place Oscillator below Multiplier; Noise below Adder.  
7. Draw Port↔Port (or stubs + join by name) wires:  
   - Source → Mapper → Multiplier.`a`  
   - Oscillator.`out` → Multiplier.`b`  
   - Multiplier.`y` → Adder.`a`  
   - Noise → Adder.`b`  
   - Adder.`y` → free stub “channel”  
8. Apply **A1** presentation: display text, colours, hide instance names if noisy, free label positions, grid/snap prefs.  
9. Save JSON; reload; confirm symbols still draw.

### 2.4 Evaluation prompts (user)

- Do builtin symbols resize / recolour / caption as well as plain blocks?  
- Is Pictures Oscillator usable as a mixer carrier despite size and `gnd` pin?  
- Port `t` / instance placement: any friction vs A1 stubs?  
- Record defects vs “needs domain library” vs “needs Designer”.

*(User results: fill after execution — leave blank until then.)*

---

## 3. A2.2 — Communication Systems test library

### 3.1 Files

| File | Purpose |
| --- | --- |
| `diagram-lab/libraries/lib_communication_systems.json` | **Primary** import — 6 symbols, `version: 1` |
| `diagram-lab/libraries/lib_communication_systems_rev2.json` | Carrier-only **rev 2** for conflict / re-import tests |

**Path (absolute):** `c:\_Git\HDL-Maker\diagram-lab\libraries\lib_communication_systems.json`

### 3.2 Symbols (vector primitives only)

| Id | Name | Ports | Artwork idea |
| --- | --- | --- | --- |
| `sym_comms_carrier` | Carrier | `out` | Box + polyline “sine” |
| `sym_comms_noise` | Noise | `out` | Box + jagged polyline |
| `sym_comms_mapper` | Mapper | `in`, `out` | Box + step glyph |
| `sym_comms_adc` | ADC | `in`, `out` | Box + circle / bars |
| `sym_comms_dac` | DAC | `in`, `out` | Box + bars / circle |
| `sym_comms_amplifier` | Amplifier | `in`, `out` | Triangle polygon |

Category: `cat_comms` / “Communication Systems”. Library id: `lib_comms_systems`. No assets. No builtin catalog edits.

### 3.3 Import instructions

1. Lab → Symbol palette → **Import library**.  
2. Choose `diagram-lab/libraries/lib_communication_systems.json`.  
3. Status should report import OK (diagnostics empty).  
4. Palette shows category **Communication Systems** with the six names.  
5. Place Carrier, Noise, Mapper (and optionally ADC/DAC/Amplifier for inventory).  
6. Rebuild BPSK sketch using **library** Carrier/Noise/Mapper + builtin Multiplier/Adder (or all-comms where applicable).  
7. Export user library (`lib_user.json`) and confirm the six ids are present.

### 3.4 Automated validation (initial)

```text
parseLibrary → ok, 6 symbols, all validateSymbol true
mergeLibrary(emptyUserLibrary, lib) → ok, 6 symbols
merge identical again → ok (no diagnostics)
merge changed Carrier body → duplicate-id (stored body kept)
```

Also: full `selfcheck ok`, `vue-tsc` exit 0 (no editor changes in this kit).

---

## 4. A2.3 — Symbol lifecycle acceptance checklist

Mark each row during the manual pilot.

| # | Test | Expected (documented architecture) | Result |
| --- | --- | --- | --- |
| 1 | Import user library | Symbols appear in palette under Communication Systems | |
| 2 | Find imported symbols | Search/browse by category/name | |
| 3 | Multiple instances of Carrier | Two+ independent positions | |
| 4 | Instance appearance | P3 colours / P2 text differ per instance; shared artwork | |
| 5 | Ports and wires | Connect Carrier.`out` → Multiplier.`b`; nets stable | |
| 6 | Resize instance | Artwork scales via fit; pins follow | |
| 7 | Copy / duplicate / Shift+Drag | New instance; same `symbolId` / embedded def | |
| 8 | Undo / Redo | Place, delete, style, wire | |
| 9 | Save / reopen document | Symbols draw; `doc.symbols` still holds defs | |
| 10 | Reopen **without** external library file | Still draws (embedded definitions) | |
| 11 | Export / reimport library | Round-trip JSON; second merge of same body is no-op | |
| 12 | Duplicate id, **different** body | Merge refuses overwrite (`duplicate-id` / version-conflict) | |
| 13 | Explicit definition update | Edit in Symbol Editor → Publish → Compare library → Update all instances | |
| 14 | After update | All non-detached instances show new artwork; wires keep port ids | |
| 15 | Detach then update | Detached instance keeps old body; others update | |

**Rev2 helper:** To force a file-based body change: delete Carrier from the user library (or start fresh), import `lib_communication_systems_rev2.json`, then Compare/Update on a sheet that still embeds rev1 Carrier — *or* prefer Symbol Editor Publish (cleaner for one session).

### Verified by automation (this kit)

| Behaviour | Status |
| --- | --- |
| Library parses / symbols valid | **Verified** |
| Merge into empty user lib | **Verified** |
| Idempotent re-merge | **Verified** |
| Changed body refused on merge | **Verified** |
| Embedded defs / Compare-Update / detach | **Documented in code**; **manual** in checklist §4 |

Do not treat manual rows as passed until the user executes them.

---

## 5. Known limitations

1. Polyline sine ≠ true Bezier (Pictures OSC uses SVG `image` for a better wave).  
2. No per-shape stroke colour in definitions.  
3. Amplifiers similar to builtin Gain — intentional domain pack demo.  
4. Merge never silently overwrites differing bodies — good for teaching packs; awkward without Delete + reimport or Publish UX.  
5. No Library Manager / multi-pack browser.  
6. Symbol Editor exists but is **not** extended in this pilot.  
7. **A2-P1 closed:** Guides + 120×120 circular Adder/Multiplier; OSC 160×120; grid-compatible Generic/Process. Manual OSC–Adder–AWGN HV wiring confirmed. Object Snap deferred.  
8. **A2.1:** Plain/Unicode wire display labels done (A2-P2); LaTeX implemented awaiting accept (**A2-P3**); Markdown gated (**A2-P4**).

---

## 6. Future Symbol Designer / Library Manager (initial)

### Three conceptual layers (not implemented)

| Layer | Responsibility |
| --- | --- |
| **Library Manager** | Packs, categories, import/export, conflicts, versioning |
| **Symbol Designer** | Geometry, primitives, text, ports, defaults |
| **Diagram Editor** | Instances, overrides, wires, nets |

Prefer **one shared geometry/render/history stack** (reuse Lab) over a separate drawing engine — unless A2 uncovers a hard constraint.

### Minimum useful tooling (hypothesis — confirm after A2.1–A2.3)

| Essential | Convenience | Deferred |
| --- | --- | --- |
| Edit body + pins; save to user lib | Domain pack browser | Server catalogs |
| Import/export JSON | Clearer conflict UI | Auto-update on open |
| Place + embed in document | Pin-impact preview before Update | New primitives (path) |
| Explicit Update / Detach | Rename/reorganize categories | Full standalone Designer app |

Distinguish **definition editing** (shared body) from **instance editing** (P1–P3 presentation, placed ports).

---

## 7. Findings log (user / agent after runs)

| ID | Observation | Class |
| --- | --- | --- |
| A2.1-G1 | Port/wire gaps; static leads fail when ports move | **Closed in A2-P1** — guides + derived leads — [p1](diagram-lab-pilot-a2-p1-symbol-connections.md) |
| A2.1-G2 | Adder/OSC ports not on snap grid | **Closed in A2-P1** — catalog geometry; Object Snap not required |
| A2.1-T1 | Scientific glyphs on wires / blocks | **P2–P3a closed**; LaTeX via `mathRender`; multiline via AMS; **P4** Markdown spec |
| *(A2.2/A2.3)* | Fill during remaining manual runs | … |

---

## 8. Scope honoured

A2 execution kit + **A2-P1…P4 closed**. Library Manager, Symbol Designer, polygon guides, Object Snap, staging, commit, and push remain out of scope until separately released. S5b / D5d preserved; D5e/D5f on roadmap after BPSK demo.

---

## 9. Stop

**P5c 18/18**, **P5c-DEL 10/10**, **DEL10 R1–R7**, **S5b.2 12/12** accepted. **P5d** preparation approved — [p5d](diagram-lab-pilot-a2-p5d-generic-circle.md); code gated on architecture sign-off. **BPSK demonstrator** accepted; refresh after P5d.
