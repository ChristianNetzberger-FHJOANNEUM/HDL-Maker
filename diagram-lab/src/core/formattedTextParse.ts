/**
 * A2-P4 — restricted Markdown subset (state-based parser, no HTML execution).
 * Produces a document tree for the shared formatted-text layout service.
 */

export type FormattedRun =
  | { kind: 'text'; text: string; bold: boolean; italic: boolean }
  | { kind: 'code'; text: string }
  | { kind: 'math'; source: string; display: false }

export type FormattedLine = FormattedRun[]

export type ParagraphBlock = { kind: 'paragraph'; lines: FormattedLine[] }
export type ParagraphGap = { kind: 'gap' }
export type DisplayMathBlock = { kind: 'display-math'; source: string }

export type FormattedBlock = ParagraphBlock | ParagraphGap | DisplayMathBlock

export type ParsedFormattedText = {
  blocks: FormattedBlock[]
  /** Non-fatal parse notes for preview / diagnostics. */
  warnings: string[]
}

const MAX_MATH_SEGMENTS = 32

/** Count math runs after parse (inline + display). */
export function countMathSegments(blocks: FormattedBlock[]): number {
  let n = 0
  for (const block of blocks) {
    if (block.kind === 'display-math') n += 1
    else if (block.kind === 'paragraph') {
      for (const line of block.lines) {
        for (const run of line) if (run.kind === 'math') n += 1
      }
    }
  }
  return n
}

export function parseFormattedText(source: string): ParsedFormattedText {
  const warnings: string[] = []
  const blocks: FormattedBlock[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  let mathCount = 0

  while (i < lines.length) {
  const line = lines[i]!
  const trimmed = line.trim()

    if (trimmed === '$$') {
      i += 1
      const body: string[] = []
      while (i < lines.length && lines[i]!.trim() !== '$$') {
        body.push(lines[i]!)
        i += 1
      }
      if (i >= lines.length) {
        warnings.push('Unclosed display math ($$).')
        if (body.length) blocks.push({ kind: 'display-math', source: body.join('\n') })
        break
      }
      i += 1
      mathCount += 1
      blocks.push({ kind: 'display-math', source: body.join('\n').trim() })
      if (mathCount > MAX_MATH_SEGMENTS) {
        warnings.push('Math segment limit exceeded.')
        break
      }
      continue
    }

    if (trimmed === '') {
      blocks.push({ kind: 'gap' })
      i += 1
      continue
    }

    const paraLines: FormattedLine[] = []
    while (i < lines.length && lines[i]!.trim() !== '' && lines[i]!.trim() !== '$$') {
      const { runs, warning } = parseLine(lines[i]!)
      if (warning) warnings.push(warning)
      paraLines.push(runs)
      i += 1
    }
    if (paraLines.length) blocks.push({ kind: 'paragraph', lines: paraLines })
  }

  return { blocks, warnings }
}

function parseLine(line: string): { runs: FormattedRun[]; warning?: string } {
  const runs: FormattedRun[] = []
  let warning: string | undefined
  let i = 0

  const pushText = (text: string, bold: boolean, italic: boolean) => {
    if (!text) return
    const prev = runs[runs.length - 1]
    if (prev?.kind === 'text' && prev.bold === bold && prev.italic === italic) prev.text += text
    else runs.push({ kind: 'text', text, bold, italic })
  }

  while (i < line.length) {
    if (line.startsWith('***', i)) {
      const end = line.indexOf('***', i + 3)
      if (end === -1) {
        pushText('***', false, false)
        i += 3
        continue
      }
      const inner = line.slice(i + 3, end)
      runs.push(...parseStyledSegment(inner, true, true))
      i = end + 3
      continue
    }
    if (line.startsWith('**', i)) {
      const end = line.indexOf('**', i + 2)
      if (end === -1) {
        pushText('**', false, false)
        i += 2
        continue
      }
      runs.push(...parseStyledSegment(line.slice(i + 2, end), true, false))
      i = end + 2
      continue
    }
    if (line[i] === '*' && line[i + 1] !== '*') {
      const end = line.indexOf('*', i + 1)
      if (end === -1) {
        pushText('*', false, false)
        i += 1
        continue
      }
      runs.push(...parseStyledSegment(line.slice(i + 1, end), false, true))
      i = end + 1
      continue
    }
    if (line[i] === '`') {
      const end = line.indexOf('`', i + 1)
      if (end === -1) {
        pushText(line.slice(i), false, false)
        break
      }
      runs.push({ kind: 'code', text: line.slice(i + 1, end) })
      i = end + 1
      continue
    }
    if (line.startsWith('\\$', i)) {
      pushText('$', false, false)
      i += 2
      continue
    }
    if (line[i] === '$') {
      const end = findInlineMathEnd(line, i + 1)
      if (end === -1) {
        warning = 'Unclosed inline math ($).'
        pushText(line.slice(i), false, false)
        break
      }
      runs.push({ kind: 'math', source: line.slice(i + 1, end), display: false })
      i = end + 1
      continue
    }
    if (line[i] === '<') {
      const end = line.indexOf('>', i + 1)
      if (end === -1) {
        pushText('<', false, false)
        i += 1
        continue
      }
      pushText(line.slice(i, end + 1), false, false)
      i = end + 1
      continue
    }
    pushText(line[i]!, false, false)
    i += 1
  }

  if (runs.length === 0) runs.push({ kind: 'text', text: '\u00a0', bold: false, italic: false })
  return { runs, warning }
}

function parseStyledSegment(text: string, bold: boolean, italic: boolean): FormattedRun[] {
  if (!text) return []
  return [{ kind: 'text', text, bold, italic }]
}

function findInlineMathEnd(line: string, start: number): number {
  for (let i = start; i < line.length; i += 1) {
    if (line[i] === '\\' && line[i + 1] === '$') {
      i += 1
      continue
    }
    if (line[i] === '$') return i
  }
  return -1
}