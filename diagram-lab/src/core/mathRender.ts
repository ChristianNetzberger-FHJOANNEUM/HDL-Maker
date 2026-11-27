/**
 * Reusable mathematical typesetting service (A2-P3).
 *
 * Consumes LaTeX source → SVG geometry. Independent of nets, wires, and labels.
 * Runtime cache only — never persist generated SVG in the document.
 *
 * MathJax is loaded lazily on first LaTeX typeset so plain-text diagrams pay nothing.
 */

export type MathRenderConfig = {
  /** CSS px size of 1em (matches wire label font size). */
  em: number
  /** Display (block) vs inline. Wire labels use inline. */
  display?: boolean
}

export type MathRenderOk = {
  ok: true
  /** Self-contained <svg>…</svg> with pixel sizing; baseline at y=0 when placed via translate(x,y). */
  svg: string
  width: number
  height: number
  /** Distance from SVG top to baseline (px). */
  ascent: number
  source: string
  em: number
}

export type MathRenderErr = {
  ok: false
  error: string
  source: string
  em: number
}

export type MathRenderResult = MathRenderOk | MathRenderErr

export type MathRenderStats = {
  typesetCount: number
  cacheHits: number
  cacheSize: number
  engineLoads: number
}

type Engine = {
  // MathJax lite adaptor is structurally typed; keep opaque to avoid LiteElement coupling.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adaptor: any
  convert: (tex: string, options: { display: boolean; em: number; ex: number }) => unknown
}

const CACHE_LIMIT = 64
const DEFAULT_EM = 13
/** Restricted TeX packages — no HTML, require, autoload, or remote resources. */
const TEX_PACKAGES = ['base', 'ams'] as const

const cache = new Map<string, MathRenderResult>()
const stats: MathRenderStats = {
  typesetCount: 0,
  cacheHits: 0,
  cacheSize: 0,
  engineLoads: 0,
}

let enginePromise: Promise<Engine> | null = null

function cacheKey(source: string, config: MathRenderConfig): string {
  const em = config.em > 0 ? config.em : DEFAULT_EM
  const display = config.display ? '1' : '0'
  return `${em}|${display}|${source}`
}

function touchCache(key: string, value: MathRenderResult): void {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  stats.cacheSize = cache.size
}

async function loadEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      stats.engineLoads += 1
      const [
        { mathjax },
        { TeX },
        { SVG },
        { liteAdaptor },
        { RegisterHTMLHandler },
      ] = await Promise.all([
        import('mathjax-full/js/mathjax.js'),
        import('mathjax-full/js/input/tex.js'),
        import('mathjax-full/js/output/svg.js'),
        import('mathjax-full/js/adaptors/liteAdaptor.js'),
        import('mathjax-full/js/handlers/html.js'),
        // Side-effect registration for restricted TeX packages (no autoload / remote).
        import('mathjax-full/js/input/tex/base/BaseConfiguration.js'),
        import('mathjax-full/js/input/tex/ams/AmsConfiguration.js'),
      ])

      const adaptor = liteAdaptor()
      RegisterHTMLHandler(adaptor)

      const tex = new TeX({
        packages: [...TEX_PACKAGES],
        // No $ delimiters required — callers pass math source directly.
        inlineMath: [],
        displayMath: [],
        processEscapes: false,
        processEnvironments: true,
        // Bound expansion / buffer to limit pathological input.
        maxMacros: 1000,
        maxBuffer: 5 * 1024,
        formatError(_jax: unknown, err: unknown) {
          throw err instanceof Error ? err : new Error(mathErrorMessage(err))
        },
      })

      // fontCache none → no shared glyph <defs> IDs → safe to embed many formulas in one diagram SVG / future D5e export.
      const svg = new SVG({
        fontCache: 'none',
        internalSpeechTitles: false,
      })

      const html = mathjax.document('', { InputJax: tex, OutputJax: svg })
      return {
        adaptor,
        convert: (math: string, options: { display: boolean; em: number; ex: number }) =>
          html.convert(math, options),
      }
    })().catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise as Promise<Engine>
}

function parseEx(value: string | null | undefined): number {
  if (!value) return 0
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))ex$/i.exec(value.trim())
  return match ? Number(match[1]) : 0
}

function parseVerticalAlignEx(style: string | null | undefined): number {
  if (!style) return 0
  const match = /vertical-align\s*:\s*([+-]?(?:\d+\.?\d*|\.\d+))ex/i.exec(style)
  return match ? Number(match[1]) : 0
}

function finalizeSvg(
  rawSvg: string,
  em: number,
  ex: number,
  widthEx: number,
  heightEx: number,
  valignEx: number,
): Pick<MathRenderOk, 'svg' | 'width' | 'height' | 'ascent'> {
  const width = widthEx * ex
  const height = heightEx * ex
  // CSS vertical-align is typically −depth; ascent = height + valign.
  const ascent = Math.max(0, (heightEx + valignEx) * ex)
  // Prefix IDs defensively in case a future fontCache mode reintroduces defs.
  const prefix = `mjx${Math.abs(hashString(`${em}|${rawSvg.length}|${widthEx}`)).toString(36)}_`
  // Shift so baseline sits at y=0 when the group is translated to the label point.
  const svg = rewriteSvgIds(rawSvg, prefix)
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/\sstyle="[^"]*"/, '')
    .replace(
      /^<svg\b/,
      `<svg y="${fmt(-ascent)}" width="${fmt(width)}" height="${fmt(height)}" overflow="visible" style="color:currentColor"`,
    )
  return { svg, width, height, ascent }
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0'
}

function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h | 0
}

/** Rewrite id="…" / url(#…) / xlink:href="#…" to avoid collisions across formulas. */
export function rewriteSvgIds(svg: string, prefix: string): string {
  if (!prefix || !svg.includes('id="')) return svg
  const ids = new Set<string>()
  for (const match of svg.matchAll(/\bid="([^"]+)"/g)) {
    if (match[1]) ids.add(match[1])
  }
  if (ids.size === 0) return svg
  let out = svg
  for (const id of ids) {
    const next = prefix + id
    out = out.split(`id="${id}"`).join(`id="${next}"`)
    out = out.split(`url(#${id})`).join(`url(#${next})`)
    out = out.split(`href="#${id}"`).join(`href="#${next}"`)
    out = out.split(`xlink:href="#${id}"`).join(`xlink:href="#${next}"`)
  }
  return out
}

function typesetSync(engine: Engine, source: string, config: MathRenderConfig): MathRenderResult {
  const em = config.em > 0 ? config.em : DEFAULT_EM
  const ex = em * 0.5
  const display = Boolean(config.display)
  stats.typesetCount += 1
  try {
    const node = engine.convert(source, { display, em, ex })
    const svgNode = engine.adaptor.firstChild(node)
    const widthEx = parseEx(engine.adaptor.getAttribute(svgNode, 'width'))
    const heightEx = parseEx(engine.adaptor.getAttribute(svgNode, 'height'))
    const valignEx = parseVerticalAlignEx(engine.adaptor.getAttribute(svgNode, 'style'))
    const raw = engine.adaptor.outerHTML(svgNode)
    if (!raw.includes('<svg')) {
      return { ok: false, error: 'MathJax produced no SVG.', source, em }
    }
    const geometry = finalizeSvg(raw, em, ex, widthEx, heightEx, valignEx)
    return { ok: true, ...geometry, source, em }
  } catch (err) {
    return { ok: false, error: mathErrorMessage(err), source, em }
  }
}

function mathErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err
  if (err && typeof err === 'object') {
    const record = err as { message?: unknown; id?: unknown }
    if (typeof record.message === 'string' && record.message.trim()) return record.message
    if (typeof record.id === 'string' && record.id.trim()) return record.id
  }
  return 'Invalid LaTeX.'
}

/**
 * Typeset LaTeX to SVG. Identical (source, config) pairs reuse a bounded LRU cache.
 * Does not run during pan/zoom/move — callers must only invoke when source/config change.
 */
export async function renderMath(source: string, config: MathRenderConfig = { em: DEFAULT_EM }): Promise<MathRenderResult> {
  const trimmed = source
  const em = config.em > 0 ? config.em : DEFAULT_EM
  const key = cacheKey(trimmed, { ...config, em })
  const hit = cache.get(key)
  if (hit) {
    stats.cacheHits += 1
    touchCache(key, hit)
    return hit
  }
  try {
    const engine = await loadEngine()
    const result = typesetSync(engine, trimmed, { ...config, em })
    // Cache successes and TeX errors; do not cache engine-load failures (retryable).
    if (result.ok || !result.error.startsWith('MathJax failed to load')) {
      touchCache(key, result)
    }
    return result
  } catch (err) {
    return {
      ok: false,
      error: `MathJax failed to load: ${mathErrorMessage(err)}`,
      source: trimmed,
      em,
    }
  }
}

/** Synchronous path for tests after `await ensureMathEngine()` / prior renderMath. */
export function renderMathCached(source: string, config: MathRenderConfig = { em: DEFAULT_EM }): MathRenderResult | null {
  const em = config.em > 0 ? config.em : DEFAULT_EM
  return cache.get(cacheKey(source, { ...config, em })) ?? null
}

export async function ensureMathEngine(): Promise<void> {
  await loadEngine()
}

export function getMathRenderStats(): MathRenderStats {
  return { ...stats, cacheSize: cache.size }
}

export function clearMathRenderCache(): void {
  cache.clear()
  stats.cacheSize = 0
}

/** Reset counters (tests). Does not unload the engine. */
export function resetMathRenderStats(): void {
  stats.typesetCount = 0
  stats.cacheHits = 0
  stats.cacheSize = cache.size
}

/**
 * Per-consumer generation tokens so rapid edits / deleted labels never apply stale SVG.
 * Key is chosen by the caller (e.g. label id + source hash).
 */
const generations = new Map<string, number>()

export function beginMathRequest(consumerKey: string): number {
  const next = (generations.get(consumerKey) ?? 0) + 1
  generations.set(consumerKey, next)
  return next
}

export function isMathRequestCurrent(consumerKey: string, token: number): boolean {
  return generations.get(consumerKey) === token
}

export function endMathConsumer(consumerKey: string): void {
  generations.delete(consumerKey)
}

export const MATH_RENDER_DEFAULT_EM = DEFAULT_EM
export const MATH_RENDER_CACHE_LIMIT = CACHE_LIMIT
export const MATH_RENDER_TEX_PACKAGES = TEX_PACKAGES
