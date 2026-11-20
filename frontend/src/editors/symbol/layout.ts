import type { Port } from '../../models/design'

export const SYMBOL_WIDTH = 280
const HEADER_HEIGHT = 36
const GENERIC_LINE = 16
const ROW_HEIGHT = 28

export function leftPorts(ports: Port[]): Port[] {
  return ports.filter((port) => port.direction !== 'out')
}

export function rightPorts(ports: Port[]): Port[] {
  return ports.filter((port) => port.direction === 'out')
}

export function symbolHeight(genericCount: number, ports: Port[]): number {
  const rows = Math.max(leftPorts(ports).length, rightPorts(ports).length, 1)
  return headerBlock(genericCount) + rows * ROW_HEIGHT + 12
}

export function rowCenter(index: number, genericCount: number): number {
  return headerBlock(genericCount) + index * ROW_HEIGHT + ROW_HEIGHT / 2
}

function headerBlock(genericCount: number): number {
  if (genericCount === 0) return HEADER_HEIGHT
  return HEADER_HEIGHT + 8 + genericCount * GENERIC_LINE
}
