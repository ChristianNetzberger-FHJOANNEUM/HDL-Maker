# D5d.0-A — Deterministic benchmark document generator

**Status:** Implemented for user acceptance (Fix1–4 generator/wiring; stub-move correction in [d5d0a-stub-block-move.md](d5d0a-stub-block-move.md)).  
**Baseline:** `d68b185`.  
**Governing spec:** [d5d-large-diagrams-prep.md](d5d-large-diagrams-prep.md).  
**Recipe version:** `d5d0a-5` (stub mode: wider pitch + compact 9px net labels; optional routed corridors).

## Scope

- Deterministic synthetic Class B documents (topologies A / B / C).  
- Sizes 50, 100, 250, 500, 1 000.  
- Geometry profiles `simple` and `complex`.  
- Wiring modes `stubs` (default) and `routed`.  
- Σ dialog in Diagram-Lab (session-remembered settings).  
- Orthogonal polylines only (HVH / VHV / straight).  
- Correctness tests in `selfcheck`.  

**Not in this slice:** Node/browser harness, full Benchmark Center, mapper, extractor fixes, performance optimisations, `benchSheet` changes.

## Wiring modes

| Mode | Behaviour | Use |
| --- | --- | --- |
| **`stubs`** (default) | Logical connectivity assigned by name; only short Port→free stubs with compact net labels are drawn. No long routes, no junctions. Wide pitch so opposing stubs do not collide. | Readable HDL Designer–like sheets |
| **`routed`** | Full exclusive-corridor polylines between ports (plus a few stubs). Wide pitch for track bands. | Wire-routing / density stress |

## How to open (UI)

1. `cd diagram-lab && npm run dev`  
2. Toolbar **Σ** → dialog **Generate benchmark diagram**.  
3. Choose topology, block count, seed, geometry, **wiring** → **Generate**.  
4. Settings persist for the browser session (not across reload).

## How to generate (API)

```ts
import { generateBenchDocument, estimateBenchCounts } from './benchgen'

estimateBenchCounts({ topology: 'C', blocks: 250, wiring: 'stubs' })
const result = generateBenchDocument({
  topology: 'C',
  blocks: 250,
  seed: 1,
  geometry: 'simple',
  wiring: 'stubs', // or 'routed'
})
```

CLI inventory:

```bash
cd diagram-lab
npx tsx src/core/benchgen-inventory.ts
```

## Recipes (`d5d0a-2` density targets for routed mode)

| Topology | Segments/block | Nets/block | Ports/block | Stubs/block | Layout |
| --- | --- | --- | --- | --- | --- |
| A — Regular | 7 | 0.8 | 10 | 0.1 | Neighbour hops, wide corridors |
| B — High Connectivity | 22.5 | 2 | 24 | 3 | Local + long reaches, junctions in channels |
| C — HDL-derived | 15 | 8.5 | 15 | 6 | Size variants; stub mode ≈ one stub per connected port |

In **routed** mode, each port–port net gets an exclusive track in the inter-row or inter-column corridor. In **stubs** mode, the same logical links become short named stubs only.

## Inventory — seed 1, geometry `simple`

Run `npx tsx src/core/benchgen-inventory.ts` for the current hash table (`d5d0a-5`, default wiring `stubs`). Hashes change with recipe version, pitch, or wiring mode.

## Manual acceptance

1. Wheel zoom over empty space, blocks, wires, labels (Fix1).  
2. **Σ** opens the dialog (not a browser `prompt`).  
3. Generate **C/50** with **Stubs + name labels** — short stubs + net names, no striped long wires.  
4. Generate the same with **Full routed corridors** — dense orthogonal corridors (stress).  
5. Existing **Bench** button still loads unchanged `benchSheet`.

## Verify

```bash
cd diagram-lab
npx tsx src/core/selfcheck.ts
npx vue-tsc --noEmit
```
