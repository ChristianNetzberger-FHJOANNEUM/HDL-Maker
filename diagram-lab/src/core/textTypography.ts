/**
 * A2-P5a — shared display typography (block captions + wire labels).
 * Diagram-space em; zoom-independent.
 */

import { blockTextFormat, type BlockTextFormat } from './edit'

export type TextAlign = 'left' | 'center' | 'right'

export const BLOCK_DISPLAY_DEFAULT_EM = 12
export const LABEL_DISPLAY_DEFAULT_EM = 13
export const MIN_DISPLAY_FONT_EM = 8
export const MAX_DISPLAY_FONT_EM = 48

export function normalizeDisplayEm(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback
  return Math.min(MAX_DISPLAY_FONT_EM, Math.max(MIN_DISPLAY_FONT_EM, value))
}

export function blockDisplayEm(block: { fontSize?: number }): number {
  return normalizeDisplayEm(block.fontSize, BLOCK_DISPLAY_DEFAULT_EM)
}

export function blockDefaultTextAlign(format: BlockTextFormat): TextAlign {
  return format === 'plain' ? 'center' : 'left'
}

export function blockDisplayTextAlign(
  block: { textAlign?: TextAlign; displayText?: string; textFormat?: 'plain' | 'latex' | 'markdown' },
): TextAlign {
  if (block.textAlign === 'center' || block.textAlign === 'right' || block.textAlign === 'left') return block.textAlign
  return blockDefaultTextAlign(blockTextFormat(block))
}

export function labelDisplayEm(label: { fontSize?: number }): number {
  return normalizeDisplayEm(label.fontSize, LABEL_DISPLAY_DEFAULT_EM)
}

export function labelDisplayTextAlign(label: { textAlign?: TextAlign }): TextAlign {
  if (label.textAlign === 'center' || label.textAlign === 'right' || label.textAlign === 'left') return label.textAlign
  return 'left'
}

/** Horizontal offset for a line inside a group of width W (layout space). */
export function lineAlignOffset(groupWidth: number, lineWidth: number, align: TextAlign): number {
  if (align === 'center') return (groupWidth - lineWidth) / 2
  if (align === 'right') return groupWidth - lineWidth
  return 0
}

export function wireLabelAnchorDx(width: number, align: TextAlign): number {
  if (align === 'center') return -width / 2
  if (align === 'right') return -width
  return 0
}