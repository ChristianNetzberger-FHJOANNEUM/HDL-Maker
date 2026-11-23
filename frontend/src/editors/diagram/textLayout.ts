import { onBeforeUnmount, ref } from 'vue'

const MAX_CHARS = 36
const MIN_ZOOM = 0.45

/** Zoom that fits a graph of `graphWidth` flow pixels into the pane. */
export function fitZoomFor(paneWidth: number, graphWidth: number): number {
  if (paneWidth < 200) return 0.7
  // Text boxes grow past the imported rectangle, so the fitted sheet is wider than the source span.
  return Math.min(1, Math.max(MIN_ZOOM, (paneWidth - 32) / (Math.max(graphWidth, 1) * 1.25)))
}

export interface ReadableText {
  width: number
  height: number
  fontSize: number
  lineHeight: number
}

/**
 * Screen size for an imported text rectangle.
 * HDL Designer stores one text line as about 1000 source units, which becomes
 * a few pixels once the whole sheet is fitted. The box grows so the full text
 * is at least `screenPx` on that fitted view. The stored rectangle is unchanged.
 */
export function readableTextBox(
  text: string,
  importedWidth: number,
  importedHeight: number,
  fitZoom: number,
  screenPx = 13,
): ReadableText {
  const zoom = Math.min(1, Math.max(MIN_ZOOM, fitZoom || 0.75))
  // Vue Flow scales this pane with a CSS transform. The font and the box are
  // both flow pixels, corrected once for the fitted view. Live zoom then
  // scales them together, so the text stays inside the box at 0.5, 1, and 2.
  const screen = Math.min(16, Math.max(8, Math.round(screenPx || 13)))
  const fontSize = screen / zoom
  const lineHeight = fontSize * 1.35
  const charWidth = fontSize * 0.62
  const lines = wrappedLines(text, MAX_CHARS)
  const longest = Math.max(...lines.map((line) => line.length), 1)
  const width = Math.max(importedWidth, longest * charWidth + 16, charWidth * 6 + 16)
  const height = Math.max(importedHeight, lines.length * lineHeight + 12, lineHeight + 8)
  return { width, height, fontSize, lineHeight }
}

export function wrappedLines(text: string, maxChars = MAX_CHARS): string[] {
  const source = text.length ? text.split('\n') : ['']
  const lines: string[] = []
  for (const raw of source) {
    let rest = raw
    if (!rest.length) {
      lines.push('')
      continue
    }
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(' ', maxChars)
      if (cut < 8) cut = maxChars
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut).replace(/^ /, '')
    }
    lines.push(rest)
  }
  return lines
}

/** Tracks the canvas pane width so text can be sized for the fitted view. */
export function usePaneWidth() {
  const width = ref(0)
  let observer: ResizeObserver | null = null
  function bind(node: unknown): void {
    const element = node instanceof Element ? node : null
    observer?.disconnect()
    observer = null
    if (!element || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(() => {
      if (element.clientWidth > 0) width.value = element.clientWidth
    })
    observer.observe(element)
    if (element.clientWidth > 0) width.value = element.clientWidth
  }
  onBeforeUnmount(() => observer?.disconnect())
  return { width, bind }
}
