/**
 * Print the D5d.0-A size × topology inventory for the default profile.
 * Usage: npx tsx src/core/benchgen-inventory.ts
 */
import { inventoryBenchMatrix, validateBenchDocument } from './benchgen'

const rows = inventoryBenchMatrix(1, 'simple')
console.log('recipe\ttopology\tblocks\tseed\tgeometry\twiring\thash12\tblocks\tports\tnets\tsegments\tjunctions\tlabels\tstubs\tseg/blk\tnets/blk\tports/blk\tvalid')
for (const row of rows) {
  const ok = validateBenchDocument(row.doc)
  const a = row.actual
  console.log(
    [
      row.recipeVersion,
      row.config.topology,
      row.config.blocks,
      row.config.seed,
      row.config.geometry,
      row.config.wiring,
      row.hash.slice(0, 12),
      a.blocks,
      a.ports,
      a.nets,
      a.segments,
      a.junctions,
      a.labels,
      a.stubs,
      a.segmentsPerBlock.toFixed(2),
      a.netsPerBlock.toFixed(2),
      a.portsPerBlock.toFixed(2),
      ok.ok ? 'ok' : 'FAIL',
    ].join('\t'),
  )
  if (!ok.ok) {
    throw new Error(ok.errors.join('\n'))
  }
}
