/**
 * Editor view preferences (P4b).
 * Not part of the diagram document — no history / dirty / schema.
 * Diagram-Lab may persist via localStorage; hosts can inject defaults without browser storage.
 */

export type EditorPreferences = {
  gridVisible: boolean
  /** Visual grid pitch in diagram units. */
  gridSpacing: number
  snapEnabled: boolean
  /** Geometric snap step in diagram units. */
  snapSpacing: number
}

export const DEFAULT_GRID_SPACING = 20
export const DEFAULT_SNAP_SPACING = 20

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  gridVisible: true,
  gridSpacing: DEFAULT_GRID_SPACING,
  snapEnabled: true,
  snapSpacing: DEFAULT_SNAP_SPACING,
}

/** Inclusive clamps for spacing controls (diagram units). */
export const SPACING_MIN = 5
export const SPACING_MAX = 200

export const SPACING_PRESETS = [5, 10, 20, 40, 100] as const

export const PREFS_STORAGE_KEY = 'diagram-lab.editorPreferences'

/** Round and clamp a spacing value; fall back to `fallback` when invalid. */
export function normalizeSpacing(value: unknown, fallback: number = DEFAULT_SNAP_SPACING): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(SPACING_MAX, Math.max(SPACING_MIN, Math.round(n)))
}

/** Coerce unknown JSON into a full, valid preference object. */
export function sanitizeEditorPreferences(raw: unknown): EditorPreferences {
  const base = { ...DEFAULT_EDITOR_PREFERENCES }
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  if (typeof obj.gridVisible === 'boolean') base.gridVisible = obj.gridVisible
  if (typeof obj.snapEnabled === 'boolean') base.snapEnabled = obj.snapEnabled
  if ('gridSpacing' in obj) base.gridSpacing = normalizeSpacing(obj.gridSpacing, DEFAULT_GRID_SPACING)
  if ('snapSpacing' in obj) base.snapSpacing = normalizeSpacing(obj.snapSpacing, DEFAULT_SNAP_SPACING)
  return base
}

export function loadEditorPreferences(storage: Pick<Storage, 'getItem'> | null | undefined = defaultStorage()): EditorPreferences {
  if (!storage) return { ...DEFAULT_EDITOR_PREFERENCES }
  try {
    const raw = storage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_EDITOR_PREFERENCES }
    return sanitizeEditorPreferences(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES }
  }
}

export function saveEditorPreferences(
  prefs: EditorPreferences,
  storage: Pick<Storage, 'setItem'> | null | undefined = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify(sanitizeEditorPreferences(prefs)))
  } catch {
    // Quota / private mode — ignore; prefs remain in-session.
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}
