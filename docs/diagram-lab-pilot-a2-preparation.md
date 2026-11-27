# Application Pilot A2 — Preparation (symbol library & reuse)

**Status:** Preparation **accepted**; execution kit released — see [a2-findings](diagram-lab-pilot-a2-findings.md). No editor/catalog/schema code changes.  
**Depends on:** A1 formally closed — [final evaluation](diagram-lab-pilot-a1-final-evaluation.md).  
**Related:** [application pilots](diagram-lab-application-pilots.md), [strategic vision](diagram-lab-strategic-vision.md), [D5d handoff](status-handoff-2026-11-26-d5d.md), [a2-findings](diagram-lab-pilot-a2-findings.md).

**Strategic contrast**

| A1 | A2 |
| --- | --- |
| How do I edit a diagram? | How do I create and manage reusable symbols? |
| Geometry / routing / presentation | Symbol definition / libraries / reuse |
| Counter block diagram | Domain-specific symbol extensibility |

---

## 1. Proposed target diagram

**A2 — BPSK modulator with AWGN channel** (small teaching sketch; not yet drawn in the editor).

Suggested signal flow:

```text
Bit Source → Mapper → Multiplier ──→ Adder → (channel out)
                         ↑              ↑
                   Carrier OSC     Noise Generator
```

| Element | Role | Availability (code inventory) |
| --- | --- | --- |
| Bit Source | Binary data | **Generic block** / Rectangle / Text box |
| Mapper | Bits → bipolar symbols (±1) | **Generic block** (or Process) |
| Multiplier | Mix with carrier | **Builtin** `sym_multiplier` (`lib_signal`) |
| Carrier oscillator | Local oscillator | **Builtin Pictures** `sym_oscillator` (sine SVG) *or* custom user-library vector / Generic block |
| Adder | Signal + noise | **Builtin** `sym_adder` (`lib_signal`) |
| Noise generator | AWGN source | **Generic block** or custom symbol |

Keep the sheet small so **D5d performance** is not confounded with library UX. Prefer existing symbols; custom definitions only where teaching value requires them.

---

## 2. Existing symbol inventory

### 2.1 Built-in libraries (`catalog.ts` / `pictures.ts`)

| Library | Symbols |
| --- | --- |
| General | Rectangle, Rounded rectangle, Ellipse, Generic block, Text box |
| Flowchart | Start/End, Process, Decision, Input/Output |
| Digital Logic | AND, OR, NOT, NAND, NOR, XOR, Multiplexer, D flip-flop, Register, Counter |
| Signal Processing | Gain, Adder, Multiplier, Integrator, Delay, Filter |
| Pictures | LED, Switch, Meter, FPGA board, **Oscillator** |

Default teaching box ≈ **88×64**; Register **128×64**; Pictures **160×108**.

**Correction vs earlier pilot notes:** “Oscillator” is **not missing from the product** — it exists under **Pictures** (`sym_oscillator`) with an embedded SVG sine. It is **not** in `lib_signal` and uses picture pins (`out`, `gnd`), which may be awkward for a clean BPSK mixer diagram. Treat that as a **reuse / categorization** finding, not a missing primitive.

### 2.2 Graphical primitives (`SymbolShape`)

| Kind | Notes |
| --- | --- |
| `rect` | Optional `rx` |
| `ellipse` | Axis-aligned |
| `line` | Straight segments only |
| `polygon` | Closed point list |
| `text` | `x, y, text` |
| `image` | Embedded `ImageAsset` (SVG/PNG/JPEG/WebP) |

**No** path / arc / cubic Bezier shape kind. Per-shape stroke/fill/dash **not** in the definition model; instance paint uses `Block.style` (P3).

### 2.3 Symbol definition model (`SymbolDefinition`)

Fields: `id`, `name`, `width`, `height`, `ports[]`, `shapes[]`, `labels[]`, optional `libraryId`, `libraryVersion`, `categoryId`, `revision`, `bodyChecksum`.

**Ports:** side + `t` ∈ [0,1], or free pins with fractional `x`/`y`.  
**Labels:** symbol-local `{ id, text, x, y }` — not instance-overridable.  
**Coordinates:** artwork in symbol-local units; placed via `fitSymbolShapes` into the instance box.

### 2.4 Instance overrides (`Block`)

Independent of the shared definition copy: `name`, geometry, `suppressedPins`, `showName` / `showPortNames`, `displayText` / offset / visibility, `style` (fill/stroke/text). Ports may be `placed` with local `side`/`t`.

---

## 3. Current library workflow (actual)

| Step | Behaviour |
| --- | --- |
| Place from palette | `placeLibrarySymbol` → **copies** definition (+ assets) into `doc.symbols` / `doc.assets` |
| Save / load diagram | Symbols travel **inside** the document JSON — **no original `.json` library required** to reopen |
| User library | `lib_user`; Save / Publish revision / Duplicate / Delete; Import / Export JSON (`schemaVersion: 1`) |
| Built-ins | Not overwritten by import (`builtin: true`) |
| Duplicate id, different body | **Refused** (`duplicate-id`) — no silent overwrite |
| Same id, same body | Allowed (category touch) |
| Publish revision | Explicit bump when body differs |
| Compare / Update all instances | Manual; **does not** auto-pull library changes on open |
| Detach instance | New definition id for one block; others keep the shared copy |

**UI present today:** `SymbolPalette.vue`, `SymbolEditor.vue` (rect/ellipse/line/polygon/text/pin/free pin/image), import/export, compare/update, detach.  
**Dedicated Library Manager app:** **absent** (multi-library browser, conflict UI beyond diagnostics, server sync, etc.).

Relevant code: `library.ts`, `symbols.ts`, `migration.ts`, `compare.ts`, `catalog.ts`, `pictures.ts`.

---

## 4. Definition change vs instances (architecture)

| Question | Implemented answer |
| --- | --- |
| Do library edits auto-update open diagrams? | **No.** Document holds its own copy. |
| How to apply a newer library body? | Explicit **Compare → Update all instances** (`commitSymbolUpdate`) |
| How to keep one instance on an old body? | Leave un-updated, or **Detach** before updating the shared definition |
| What about wired pins removed in a new body? | Update reports **conflicts**; orphan ports → `symbolDiagnostics`; repair via rebind / drop wires |

This is the ownership model A2 should exercise and document with findings — **investigate, do not redesign** during the pilot.

---

## 5. Minimal oscillator proposals (no catalog change)

### 5.1 Prefer existing Pictures Oscillator

Already ships a sine via `image` + SVG path (cubic Bezier in the asset). Sufficient to prove “sine is drawable” **without** new primitives.

Limitation for BPSK: pin set (`out`/`gnd`) and Pictures sizing/category may not match Signal Processing mixer idioms. A2 should record whether users accept it or prefer a custom carrier.

### 5.2 Vector approximation without `image` / without new primitives

Straight `line` segments can approximate one period of a sine inside a box; `text` “OSC” as fallback. Quality is limited (no true curves). `polygon` is a poor fit for an open waveform.

### 5.3 Proposed minimal **user-library** carrier (import-compatible sketch)

Illustrative fragment only — **do not** add to builtins in this prep. Compatible with `LIBRARY_SCHEMA = 1` / `parseLibrary`:

```json
{
  "schemaVersion": 1,
  "id": "lib_a2_comms",
  "name": "A2 Comms (draft)",
  "description": "Pilot symbols for BPSK sketch — not a product catalog.",
  "version": 1,
  "origin": "a2-prep",
  "builtin": false,
  "categories": [{ "id": "cat_a2", "name": "Comms" }],
  "symbols": [
    {
      "id": "sym_a2_carrier",
      "name": "Carrier OSC",
      "width": 88,
      "height": 64,
      "categoryId": "cat_a2",
      "revision": 1,
      "ports": [
        { "id": "pin_a2_osc_out", "name": "out", "side": "right", "t": 0.5 }
      ],
      "shapes": [
        { "kind": "rect", "x": 4, "y": 4, "width": 80, "height": 56, "rx": 4 },
        { "kind": "line", "x1": 16, "y1": 32, "x2": 24, "y2": 20 },
        { "kind": "line", "x1": 24, "y1": 20, "x2": 32, "y2": 44 },
        { "kind": "line", "x1": 32, "y1": 44, "x2": 40, "y2": 20 },
        { "kind": "line", "x1": 40, "y1": 20, "x2": 48, "y2": 44 },
        { "kind": "line", "x1": 48, "y1": 44, "x2": 56, "y2": 32 },
        { "kind": "line", "x1": 56, "y1": 32, "x2": 72, "y2": 32 }
      ],
      "labels": [{ "id": "lbl_a2_osc", "text": "OSC", "x": 34, "y": 14 }]
    }
  ],
  "assets": []
}
```

Noise generator / Bit source / Mapper can remain Generic blocks with P2 display text for the first pass.

**Missing capability if a native editable sine is required:** a `path` / Bezier shape kind (or always use `image` assets). Prefer documenting that gap over implementing primitives mid-pilot.

---

## 6. Future Library Manager / Symbol Designer (requirements only)

### Essential (for A2-class work)

- Create / edit symbol body with existing primitives + pins  
- Save to user library; import / export JSON  
- Place instances; embed definition in document  
- Understand update vs detach when definitions change  

*(Much of this already exists via Symbol Editor + palette.)*

### Useful convenience

- Domain libraries (e.g. “Comms”) as first-class catalogs  
- Clearer category browsing; rename / reorganize without raw JSON  
- Safer conflict messages when ids collide  
- Preview of pin/wire impact before “Update all instances”  

### Application-specific

- Teaching packs (BPSK, QPSK, modulators) as shareable `.json` libraries  
- Pin naming conventions for signal-flow (+ carrier / noise ports)  

### Deferred / advanced

- Full standalone Library Manager product  
- Server-backed catalogs / multi-user versioning  
- Auto-update policies on document open  
- New shape engines (paths, arrows, wire styles)  
- Symbol Designer as a **separate** app — preference: **reuse Lab editor surface** if A2 shows it is viable  

Investigate during A2; **do not implement** in this preparation.

---

## 7. Identified limitations (factual)

1. No native curve/path primitive — sine via **image** or polyline.  
2. No per-shape stroke style in definitions.  
3. Oscillator lives under Pictures, not Signal Processing.  
4. No dedicated Bit Source / Mapper / Noise / ADC / DAC symbols.  
5. No Library Manager beyond palette + JSON I/O + Symbol Editor.  
6. Library revisions never silently rewrite embedded document copies.  
7. Free-angle wires / arrows / bus marks remain out of scope (A1 deferred list).  

---

## 8. Proposed manual A2 pilot procedure (when released)

1. Draw BPSK+AWGN with **only** builtins + Generic blocks; note friction.  
2. Place **Pictures Oscillator**; wire into Multiplier; record pin/layout issues.  
3. Optionally import a **user-library** carrier (e.g. §5.3); place two instances.  
4. Edit the library definition (or Publish revision); reopen / Compare / Update — observe instance behaviour.  
5. Detach one instance; update others; confirm independence.  
6. Save diagram, remove library file from the session, reload — confirm symbols still draw.  
7. Export user library; import into a fresh session; place again.  
8. File findings: defects vs enhancements vs architecture limits.  
9. List **essential** vs **deferred** Library Manager / Designer needs.  
10. Stop — no mid-pilot implementation of missing primitives or managers.

---

## 9. Open architectural questions

1. Should teaching oscillators live in **Signal Processing** or stay as **Pictures**?  
2. When is **Update all instances** the right default vs **detach / pin version**?  
3. Should Symbol Designer remain an in-Lab mode, or become a filtered “definition-only” workspace on the same engine?  
4. How should domain packs version (`library.version` vs per-symbol `revision`)?  
5. When is an `image` asset acceptable vs requiring editable vectors?  
6. What minimal validation belongs in merge/import UX for course distribution?  

---

## 10. Scope restrictions (this deliverable)

Investigation and documentation only.

No editor implementation, catalog changes, new primitives, Library Manager, Symbol Designer features, schema changes, refactoring, performance work, roadmap renumbering, staging, commit, or push.

Preserve S5b and D5d gates. **A2 execution requires a separate freigabe.**

---

## 11. Execution hand-off

A2 execution kit: [diagram-lab-pilot-a2-findings.md](diagram-lab-pilot-a2-findings.md).

Test library: `diagram-lab/libraries/lib_communication_systems.json` (+ optional rev2).

User runs A2.1–A2.3 manually; findings logged there. No automatic implementation. Keep **D5d** independent. No commit unless asked.  
