# A2-P5c — Wire arrowheads (implementation)

**Status:** **Canonical semantics implemented** — manual **14/14 pending** (28 Nov 2026). Unique Net Naming closed 12/12. §6 resolved.  
**Depends on:** [A2-P5b closed](diagram-lab-pilot-a2-p5b-port-direction.md).  
**Status (28 Nov 2026):** **Accepted — 18/18** manual; P5c-DEL **10/10**; DEL10 regression **7/7**.  
**Out of scope:** P5d (after S5b.2 + DEL10), bus width, HDL validation, D5e export, D5d perf work.

---

## 1. Presentation model

**Diagram** (`presentation.arrowheadDefault` on the sheet document):

| Value | Meaning |
| --- | --- |
| omitted / `none` | Legacy: no arrowheads |
| `automatic` | Derive from P5b port directions per net |

**Segment** (`arrowheads` optional):

| Value | Meaning |
| --- | --- |
| `inherit` / omitted | Use diagram default |
| `none` | Force off |
| `automatic` | Force automatic on this segment |
| `start` / `end` / `both` | Manual geometric markers (first/last polyline vertex order) |

Manual modes ignore port semantics. Automatic uses `resolvePortDirection` and **net id** (not net name alone).

**Split segments:** junction split copies the parent override to both children; geometry unchanged.

---

## 2. Automatic rules (v1, aligned with P5b doc)

Per **canonical `netId`** (all segments on that id), **one** analysis pass (`buildNetArrowAnalyses` → `analyzeNet`):

- Distinct **port ids** only (a port on multiple segments is counted once).
- Geometric `connectedSegmentGroups` is used for **inspector hints** only, not for automatic eligibility (corrected 28 Nov 2026).

- Require all ports on the net to resolve to **in** or **out** only (no `inout` / `unspecified`).
- Exactly **one** `out` and **at least one** `in` → arrows at each **input port** endpoint (start or end of the owning segment).
- **Output→free** stub (one `out`, no `in`): arrow at the free end.
- **Free→input** stub (no `out`, one `in`): arrow at the input port.
- **Multiple outputs**, **no output**, **inout/unspecified**, or intermediate **junction-only** spans → **no** automatic arrows on that net.

### Single-port stub table (B1 — accepted 28 Nov 2026)

Evaluated on the **full canonical `netId`** (not per geometric fragment):

| Canonical ports on `netId` | Automatic arrows |
| --- | --- |
| Single **output** stub (1× out, 0× in) | Away from port (free end) |
| Single **input** stub (0× out, 1× in) | Toward input port |
| Any **unspecified** / **inout** on net | None |
| 1× out, ≥1× in | Toward each input (fan-in / branches) |
| >1× out | None on all segments of that `netId` |

Independent stubs on **different** net ids (Unique Net Naming) each get their own row in this table.

Arrows render as `marker-start` / `marker-end` on the visible wire polyline (`orient="auto"`), diagram-unit markers in shared `<defs>`.

---

## 3. Inspector (wire selected)

- **Diagram default** — None / Automatic (persisted on document).
- **Segment arrowheads** — inherit + manual + automatic override.
- **Effective mode** readout; **Reset to inherit** clears segment override.

History: one entry per commit; derived automatic visuals do not create history.

---

## 4. Code

- `diagram-lab/src/core/wireArrowheads.ts` — model, net analysis, markers, setters.
- `DiagramStage.vue` — SVG markers + inspector.
- No change to net geometry, routing, or validation.

---

## 5. Verification

| Check | Result |
| --- | --- |
| `npm run selfcheck` | **Green** (`A2-P5c:*`) |
| `npm run check` | **Green** |
| Browser SVG | **Pending** (manual) |

### Manual acceptance

**BPSK**

1. Set port directions (sources `out`, sinks `in`).
2. Diagram default → **Automatic** → arrows toward inputs on signal paths.
3. Undo/redo diagram default; save/load.

**Branched / stub**

4. Branched net: arrows on input branches only, not on trunk junction span.
5. Manual **End** on one segment overrides inherit; reset inherit.

**Legacy**

6. Open old JSON → no arrows until defaults changed.

---

## 6. Semantic review — resolved (28 Nov 2026)

**Original issue:** `connectedSegmentGroups` could grant automatic arrows to a geometric subset while the canonical `netId` was logically ambiguous (e.g. two outputs on rename-joined disjoint stubs).

**Resolution (implemented):** `buildNetArrowAnalyses` and `automaticNetStatus` use **all segments** on the `netId`. Ambiguity suppresses automatic markers on **every** segment of that net. Manual `arrowheads` overrides unchanged. Inspector and renderer share the same `buildNetArrowAnalyses` map.

**Output-only stub (unchanged P5c rule):** Exactly **one** `out` and **zero** `in` on the net → arrow on the free end of the output stub (`stubReceivers`); no change to the accepted minimum for driver+receiver fan-in nets (≥1 `in`).

### Historical review notes (pre-correction)

**Principle (user):** Canonical **`netId`** defines logical signal-flow ambiguity for automatic mode. Geometric partitioning must **not** mask logical ambiguity on a shared id.

### Current behaviour

| Layer | Rule |
| --- | --- |
| `buildNetArrowAnalyses` | Partitions segments by **`netId`**, then **`connectedSegmentGroups`**, then `analyzeNet` **per group** |
| `automaticNetStatus` (wire selected) | Often evaluates **only the selected segment’s group** (`segmentsForAutomatic`) |
| Manual segment overrides | Unaffected — `start` / `end` / `both` bypass automatic rules |

### Conformance matrix

| Scenario | Canonical rule | Current implementation | Conforms? |
| --- | --- | --- | --- |
| 1× out, 1× in, one connected piece | Arrows at in | Per-group = full net | **Yes** |
| 1× out, 2× in, one connected tree | Arrows at each in | Full net in one group | **Yes** |
| 1× out, 2× in, **intentional** rename-join, **disjoint** stubs (same `netId`) | Arrows (one driver, two receivers logically) | Group per stub may see 1 out + 0 in or 0 out + 1 in; **stub rules** may still place arrows | **Partial** — can match intent on stubs |
| 2× out, same `netId` (ambiguous) | **No** automatic arrows | **Each** disconnected group may be 1× out stub → **arrows on both** | **No** |
| `inout` / `unspecified` on net | Suppress | `analyzeNet` returns empty per group; unspecified on **other** group ignored if not in that group’s ports | **No** if ambiguity lives on another fragment |
| Legacy accidental mega-net (pre–Unique Net Naming) | User preference: suppress if logically ambiguous | Component split **reduces** arrows on simple out→in **fragments** | **No** (masks canonical ambiguity) |
| Same display name, **different** `netId` (e.g. duplicate copy) | Independent | Separate analyses per id | **Yes** |
| Manual arrow override | Forced markers | Honoured | **Yes** |

### Conclusion

The **`connectedSegmentGroups` fallback does not fully conform** to canonical-net ambiguity: it can show automatic arrows on subsets of a logically ambiguous or incomplete **`netId`** (notably **multiple outputs** split across disconnected geometry, and **missing direction** on ports attached only to other fragments).

After **Unique Net Naming**, unintentional disjoint same-id nets are rarer; the fallback mainly helps **legacy sheets** and **intentional by-name merge** of spatially separated stubs.

### Implemented correction

1. **`buildNetArrowAnalyses`** — one `analyzeNet` per `netId`; same result keyed on every segment id.
2. **`automaticNetStatus`** — canonical ports/analysis; optional geometric group text for the selected wire only.
3. **Selfcheck:** `A2-P5c canonical:*` (two outs suppress; fan-out ok; manual override; inspector agreement).

**Status:** Implemented — **manual acceptance pending** (browser).

---

## 7. Manual acceptance checklist (final — 14 cases)

**Prerequisite:** [Unique Net Naming](diagram-lab-unique-net-naming.md) closed (12/12).

| # | Case | Pass |
| --- | --- | --- |
| 1 | BPSK demonstrator: Automatic with independent nets | |
| 2 | Arrows toward input ports | |
| 3 | Branch: arrows at all inputs, not junction trunk | |
| 4 | Output→free stub per documented rule | |
| 5 | Intentional same-`netId` stubs: 1 out, multiple ins | |
| 6 | Two outputs, one `netId`: **no** automatic arrows | |
| 7 | InOut / Unspecified on any fragment of `netId`: no automatic | |
| 8 | Port direction change updates arrows | |
| 9 | Manual None / Start / End / Both | |
| 10 | Segment override + Reset inherit | |
| 11 | Diagram default + Undo/Redo | |
| 12 | Save/Load | |
| 13 | Legacy diagram: no arrows until Automatic set | |
| 14 | Inspector status matches visible markers | |
| DEL1–DEL10 | Wire deletion | **Accepted 10/10** |
| DEL10-R1–R7 | Regression after net-split fix | **Accepted 7/7** — [record](diagram-lab-del10-fix-acceptance.md) |

| Automated (28 Nov 2026) | Result |
| --- | --- |
| `npm run selfcheck` | **Green** |
| `npm run check` | **Green** |

---

## 8. Gates

- **S5b.2** after P5c + DEL manual sign-off — [spec](d5d0a-s5b2-endpoint-snap-connect.md).
- **A2-P5d** after S5b.2 manual 12/12.
- Git checkpoint **Unique Net Naming + P5c** when user requests commit.