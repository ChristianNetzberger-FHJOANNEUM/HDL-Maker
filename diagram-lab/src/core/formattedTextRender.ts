/**
 * A2-P4 — shared formatted text layout → SVG fragment (prose + mathRender).
 * Layout cache keys: source + em + align (colour via currentColor on host).
 */

import {
  countMathSegments,
  parseFormattedText,
  parsePlainDisplayText,
  type DisplayMathBlock,
  type FormattedBlock,
  type FormattedLine,
  type FormattedRun,
} from './formattedTextParse'
import { renderMath, rewriteSvgIds, type MathRenderOk, type MathRenderResult } from './mathRender'
import { lineAlignOffset, type TextAlign } from './textTypography'

export type FormattedTextResult =
  | {
      ok: true
      /** <g>…</g> placed with baseline at y=0 inside parent (wire) or centred in block host */
      svg: string
      width: number
      height: number
      ascent: number
      source: string
      em: number
      align: TextAlign
      warnings: string[]
    }
  | { ok: false; error: string; source: string; em: number; warnings: string[] }

export type FormattedTextLayoutConfig = {
  em: number
  /** Prefix for nested MathJax id rewriting */
  idPrefix?: string
  /** Line alignment inside the text group (A2-P5a). Default left. */
  align?: TextAlign
}

const LAYOUT_CACHE_LIMIT = 32
const MAX_MATH_SEGMENTS = 32

type LayoutCacheEntry = FormattedTextResult

const layoutCache = new Map<string, LayoutCacheEntry>()

function layoutCacheKey(source: string, em: number, align: TextAlign): string {
  return `${em}|${align}|${source}`
}

function touchLayoutCache(key: string, value: LayoutCacheEntry): void {
  if (layoutCache.has(key)) layoutCache.delete(key)
  layoutCache.set(key, value)
  while (layoutCache.size > LAYOUT_CACHE_LIMIT) {
    const oldest = layoutCache.keys().next().value
    if (oldest === undefined) break
    layoutCache.delete(oldest)
  }
}

export function clearFormattedTextLayoutCache(): void {
  layoutCache.clear()
}

type PlacedRun = {
  x: number
  width: number
  ascent: number
  descent: number
  html: string
}

function proseMetrics(em: number, code: boolean): { ascent: number; descent: number } {
  const ascent = em * (code ? 0.78 : 0.72)
  const descent = em * (code ? 0.22 : 0.28)
  return { ascent, descent }
}

function measureProse(text: string, em: number, bold: boolean, code: boolean, italic: boolean): number {
  const factor = code ? 0.58 : bold ? 0.56 : 0.52
  const len = [...text].length
  const pad = italic ? 0.02 * em * len : 0
  return len * em * factor + pad
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function proseSvg(
  text: string,
  x: number,
  y: number,
  em: number,
  bold: boolean,
  italic: boolean,
  code: boolean,
): string {
  const weight = bold ? 'font-weight:700' : ''
  const style = italic ? 'font-style:italic' : ''
  const family = code ? "font-family:ui-monospace,Consolas,monospace" : ''
  const inner = escapeXml(text)
  return `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-size="${em}" dominant-baseline="alphabetic" style="color:currentColor;${weight};${style};${family}">${inner}</text>`
}

/**
 * Embed a full MathJax <svg> (same contract as wire/block LaTeX) at a baseline anchor.
 * Do not strip the outer tag or apply scale(1,-1) — that broke glyph visibility in HTML/SVG hosts.
 */
function embedMathAtBaseline(result: MathRenderOk, x: number, baselineY: number, idPrefix: string): string {
  const svg = idPrefix ? rewriteSvgIds(result.svg, idPrefix) : result.svg
  return `<g transform="translate(${x.toFixed(3)},${baselineY.toFixed(3)})" pointer-events="none">${svg}</g>`
}

function inlineMathFragment(result: MathRenderOk, x: number, baselineY: number, prefix: string): PlacedRun {
  const ascent = result.ascent
  const descent = Math.max(0, result.height - ascent)
  const html = embedMathAtBaseline(result, x, baselineY, `${prefix}mi${hash(String(result.source))}_`)
  return { x, width: result.width, ascent, descent, html }
}

function displayMathFragment(result: MathRenderOk, x: number, topY: number, prefix: string): { html: string; width: number; height: number } {
  const baselineY = topY + result.ascent
  const html = embedMathAtBaseline(result, x, baselineY, `${prefix}md${hash(String(result.source))}_`)
  return { html, width: result.width, height: result.height }
}

function layoutLine(
  line: FormattedLine,
  yBaseline: number,
  em: number,
  math: Map<string, MathRenderResult>,
  prefix: string,
  xShift = 0,
): { placed: PlacedRun[]; width: number; ascent: number; descent: number } {
  const placed: PlacedRun[] = []
  let x = 0
  let lineAscent = em * 0.72
  let lineDescent = em * 0.28

  for (const run of line) {
    if (run.kind === 'text') {
      const w = measureProse(run.text, em, run.bold, false, run.italic)
      const m = proseMetrics(em, false)
      lineAscent = Math.max(lineAscent, m.ascent)
      lineDescent = Math.max(lineDescent, m.descent)
      placed.push({
        x,
        width: w,
        ascent: m.ascent,
        descent: m.descent,
        html: proseSvg(run.text, x + xShift, yBaseline, em, run.bold, run.italic, false),
      })
      x += w
    } else if (run.kind === 'code') {
      const w = measureProse(run.text, em, false, true, false)
      const m = proseMetrics(em, true)
      lineAscent = Math.max(lineAscent, m.ascent)
      lineDescent = Math.max(lineDescent, m.descent)
      placed.push({
        x,
        width: w,
        ascent: m.ascent,
        descent: m.descent,
        html: proseSvg(run.text, x + xShift, yBaseline, em, false, false, true),
      })
      x += w
    } else if (run.kind === 'math') {
      const hit = math.get(`i:${run.source}`)
      if (hit?.ok) {
        const frag = inlineMathFragment(hit, x + xShift, yBaseline, `${prefix}mi${hash(run.source)}_`)
        lineAscent = Math.max(lineAscent, frag.ascent)
        lineDescent = Math.max(lineDescent, frag.descent)
        placed.push(frag)
        x += frag.width
      } else {
        const err = hit && !hit.ok ? hit.error : 'Math error'
        const w = measureProse(err, em, false, false, true)
        const m = proseMetrics(em, false)
        placed.push({
          x,
          width: w,
          ascent: m.ascent,
          descent: m.descent,
          html: proseSvg(err, x + xShift, yBaseline, em, false, true, false),
        })
        x += w
      }
    }
  }
  return { placed, width: x, ascent: lineAscent, descent: lineDescent }
}

function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0'
}

/** Self-contained <svg> for HTML hosts and nested wire labels (same contract as mathRender). */
function wrapFormattedSvg(inner: string, width: number, height: number, ascent: number): string {
  const w = Math.max(width, 1)
  const h = Math.max(height, 1)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(h)}" overflow="visible" y="${fmt(-ascent)}" style="color:currentColor">${inner}</svg>`
}

function buildLayout(
  blocks: FormattedBlock[],
  em: number,
  math: Map<string, MathRenderResult>,
  prefix: string,
  align: TextAlign,
): { parts: string[]; width: number; height: number; ascent: number } {
  const PARA_GAP = em * 0.45
  const LINE_GAP = em * 0.12
  let yTop = 0
  let maxW = 0
  let firstAscent = em * 0.72

  for (const block of blocks) {
    if (block.kind === 'gap') {
      yTop += PARA_GAP
      continue
    }
    if (block.kind === 'display-math') {
      const hit = math.get(`d:${block.source}`)
      const w = hit?.ok ? hit.width : measureProse(hit && !hit.ok ? hit.error : 'Math error', em, false, false, true)
      maxW = Math.max(maxW, w)
      if (hit?.ok) yTop += hit.height
      else yTop += em
      yTop += em * 0.15
      continue
    }
    for (const line of block.lines) {
      const probe = layoutLine(line, 0, em, math, prefix)
      const baseline = yTop + probe.ascent
      maxW = Math.max(maxW, probe.width)
      yTop = baseline + probe.descent + LINE_GAP
    }
    yTop += em * 0.08
  }

  maxW = Math.max(maxW, 1)
  const parts: string[] = []
  yTop = 0
  firstAscent = em * 0.72

  for (const block of blocks) {
    if (block.kind === 'gap') {
      yTop += PARA_GAP
      continue
    }
    if (block.kind === 'display-math') {
      const hit = math.get(`d:${block.source}`)
      if (hit?.ok) {
        const dx = lineAlignOffset(maxW, hit.width, align)
        const frag = displayMathFragment(hit, dx, yTop, `${prefix}md${hash(block.source)}_`)
        yTop += frag.height
        parts.push(frag.html)
      } else {
        const err = hit && !hit.ok ? hit.error : 'Math error'
        const m = proseMetrics(em, false)
        const baseline = yTop + m.ascent
        const w = measureProse(err, em, false, false, true)
        const dx = lineAlignOffset(maxW, w, align)
        if (parts.length === 0) firstAscent = m.ascent
        parts.push(proseSvg(err, dx, baseline, em, false, true, false))
        yTop = baseline + m.descent
      }
      yTop += em * 0.15
      continue
    }
    for (const line of block.lines) {
      const probe = layoutLine(line, 0, em, math, prefix)
      const baseline = yTop + probe.ascent
      const dx = lineAlignOffset(maxW, probe.width, align)
      const laid = layoutLine(line, baseline, em, math, prefix, dx)
      if (parts.length === 0) firstAscent = laid.ascent
      for (const p of laid.placed) parts.push(p.html)
      yTop = baseline + laid.descent + LINE_GAP
    }
    yTop += em * 0.08
  }

  return { parts, width: maxW, height: Math.max(yTop, em), ascent: firstAscent }
}

async function typesetMath(blocks: FormattedBlock[], em: number): Promise<Map<string, MathRenderResult>> {
  const map = new Map<string, MathRenderResult>()
  const jobs: Array<{ key: string; source: string; display: boolean }> = []
  for (const block of blocks) {
    if (block.kind === 'display-math') jobs.push({ key: `d:${block.source}`, source: block.source, display: true })
    else if (block.kind === 'paragraph') {
      for (const line of block.lines) {
        for (const run of line) {
          if (run.kind === 'math') jobs.push({ key: `i:${run.source}`, source: run.source, display: false })
        }
      }
    }
  }
  const unique = new Map<string, { source: string; display: boolean }>()
  for (const job of jobs) {
    if (!unique.has(job.key)) unique.set(job.key, { source: job.source, display: job.display })
  }
  if (unique.size > MAX_MATH_SEGMENTS) {
    const first = [...unique.entries()].slice(0, MAX_MATH_SEGMENTS)
    unique.clear()
    for (const [k, v] of first) unique.set(k, v)
  }
  await Promise.all(
    [...unique.entries()].map(async ([key, job]) => {
      const result = await renderMath(job.source, { em, display: job.display })
      map.set(key, result)
    }),
  )
  return map
}

async function renderLayoutTree(
  blocks: FormattedBlock[],
  source: string,
  config: FormattedTextLayoutConfig,
  parseWarnings: string[],
): Promise<FormattedTextResult> {
  const em = config.em > 0 ? config.em : 13
  const align: TextAlign = config.align ?? 'left'
  const key = layoutCacheKey(source, em, align)
  const hit = layoutCache.get(key)
  if (hit) {
    touchLayoutCache(key, hit)
    return hit
  }
  const warnings = [...parseWarnings]
  if (countMathSegments(blocks) > MAX_MATH_SEGMENTS) {
    warnings.push(`Math limited to ${MAX_MATH_SEGMENTS} segments.`)
  }
  try {
    const math = await typesetMath(blocks, em)
    const prefix = config.idPrefix ?? `fmt${hash(source)}_`
    const layout = buildLayout(blocks, em, math, prefix, align)
    const inner = `<g class="formatted-text" pointer-events="none">${layout.parts.join('')}</g>`
    const svg = wrapFormattedSvg(inner, layout.width, layout.height, layout.ascent)
    const result: FormattedTextResult = {
      ok: true,
      svg,
      width: layout.width,
      height: layout.height,
      ascent: layout.ascent,
      source,
      em,
      align,
      warnings,
    }
    if (result.ok) touchLayoutCache(key, result)
    return result
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      source,
      em,
      warnings,
    }
  }
}

export async function renderPlainDisplayText(
  source: string,
  config: FormattedTextLayoutConfig = { em: 12 },
): Promise<FormattedTextResult> {
  const parsed = parsePlainDisplayText(source)
  return renderLayoutTree(parsed.blocks, source, config, parsed.warnings)
}

export async function renderFormattedText(
  source: string,
  config: FormattedTextLayoutConfig = { em: 13 },
): Promise<FormattedTextResult> {
  const parsed = parseFormattedText(source)
  return renderLayoutTree(parsed.blocks, source, config, parsed.warnings)
}

/** Exposed for selfcheck — parse only */
export { parseFormattedText } from './formattedTextParse'