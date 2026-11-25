import { createId, type ImageAsset, type ImageMime } from './document'

/** A later ZIP package can read and write these same records. The document stores bytes, never a path. */
export const ASSET_MAX_BYTES = 1_500_000
export const ASSET_MAX_EDGE = 4096

export type AssetDraft = {
  name: string
  mime: ImageMime
  data: string
  width: number | null
  height: number | null
  checksum: string
}

export type AssetInspection = { ok: true; draft: AssetDraft } | { ok: false; message: string }

const MIME: Record<ImageMime, true> = {
  'image/svg+xml': true,
  'image/png': true,
  'image/jpeg': true,
  'image/webp': true,
}

/** Draw an asset. The address is derived for one paint and is not stored. */
export function assetDataUrl(asset: ImageAsset): string | null {
  if (!MIME[asset.mime]) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(asset.data)) return null
  return `data:${asset.mime};base64,${asset.data}`
}

export function imageAssetIds(shapes: Array<{ kind: string; assetId?: string }>): string[] {
  const ids: string[] = []
  for (const shape of shapes) {
    if (shape.kind === 'image' && shape.assetId && !ids.includes(shape.assetId)) ids.push(shape.assetId)
  }
  return ids
}

/**
 * Keep one record per checksum.
 * The same id with different bytes is refused and the list is left unchanged.
 */
export function storeAsset(
  assets: ImageAsset[],
  draft: AssetDraft & { id?: string },
  meta?: { origin?: string; license?: string },
): { ok: true; id: string; reused: boolean } | { ok: false; message: string } {
  const same = assets.find((asset) => asset.checksum === draft.checksum)
  if (same) return { ok: true, id: same.id, reused: true }
  if (draft.id && assets.some((asset) => asset.id === draft.id)) {
    return { ok: false, message: `${draft.name} uses an id that already stores a different picture. Nothing was written.` }
  }
  const id = draft.id ?? createId('ast')
  const asset: ImageAsset = {
    id,
    name: draft.name,
    mime: draft.mime,
    data: draft.data,
    width: draft.width,
    height: draft.height,
    checksum: draft.checksum,
    ...(meta?.origin ? { origin: meta.origin } : {}),
    ...(meta?.license ? { license: meta.license } : {}),
  }
  assets.push(asset)
  return { ok: true, id, reused: false }
}

export function inspectImageBytes(bytes: Uint8Array, filename: string, claimedType = ''): AssetInspection {
  if (bytes.byteLength === 0) return { ok: false, message: 'The image file is empty.' }
  if (bytes.byteLength > ASSET_MAX_BYTES) {
    return { ok: false, message: `The image is larger than ${ASSET_MAX_BYTES} bytes.` }
  }
  const detected = detect(bytes)
  if (!detected) return { ok: false, message: 'The file is not an SVG, PNG, JPEG, or WebP image.' }
  if ('reject' in detected) return { ok: false, message: detected.reject }
  if (!typeAgrees(claimedType, detected.mime)) {
    return { ok: false, message: `The file contents do not match the type ${claimedType}.` }
  }
  if (detected.width !== null && detected.height !== null && (detected.width > ASSET_MAX_EDGE || detected.height > ASSET_MAX_EDGE || detected.width < 1 || detected.height < 1)) {
    return { ok: false, message: `The image must be between 1 and ${ASSET_MAX_EDGE} pixels on each side.` }
  }
  return {
    ok: true,
    draft: {
      name: bareName(filename),
      mime: detected.mime,
      data: bytesToBase64(bytes),
      width: detected.width,
      height: detected.height,
      checksum: sha256Sync(bytes),
    },
  }
}

export async function inspectImage(bytes: Uint8Array, filename: string, claimedType = ''): Promise<AssetInspection> {
  return inspectImageBytes(bytes, filename, claimedType)
}

/** Check stored bytes, type, and checksum. A failure is a reason to keep the previous document. */
export function auditAsset(asset: ImageAsset): { ok: true } | { ok: false; message: string } {
  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(asset.data)
  } catch {
    return { ok: false, message: `${asset.name} is not valid image data.` }
  }
  const inspected = inspectImageBytes(bytes, asset.name, asset.mime)
  if (!inspected.ok) return inspected
  if (inspected.draft.checksum !== asset.checksum) {
    return { ok: false, message: `${asset.name} does not match its checksum. Nothing was loaded.` }
  }
  return { ok: true }
}

export function auditAssets(assets: ImageAsset[]): { ok: true } | { ok: false; message: string } {
  for (const asset of assets) {
    const result = auditAsset(asset)
    if (!result.ok) return result
  }
  return { ok: true }
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function rotr(n: number, x: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

/** SHA-256 of the file bytes. Synchronous so a load can refuse a bad checksum before it replaces the document. */
export function sha256Sync(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8
  const padded = new Uint8Array((((bytes.length + 9 + 63) >> 6) << 6))
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(padded.length - 4, bitLength >>> 0)
  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19
  const words = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(7, words[index - 15]) ^ rotr(18, words[index - 15]) ^ (words[index - 15] >>> 3)
      const s1 = rotr(17, words[index - 2]) ^ rotr(19, words[index - 2]) ^ (words[index - 2] >>> 10)
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
      const choice = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + choice + SHA_K[index] + words[index]) >>> 0
      const s0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((value) => value.toString(16).padStart(8, '0')).join('')
}

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = []
  for (let index = 0; index < bytes.length; index += 0x8000) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)))
  }
  return btoa(parts.join(''))
}

export function base64ToBytes(data: string): Uint8Array {
  const text = atob(data)
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes
}

function bareName(filename: string): string {
  const leaf = filename.split(/[/\\]/).pop()?.trim() || 'image'
  return leaf.slice(0, 180)
}

function typeAgrees(claimed: string, detected: ImageMime): boolean {
  const type = claimed.trim().toLowerCase()
  if (type === '' || type === 'application/octet-stream') return true
  if (detected === 'image/svg+xml') return type === 'image/svg+xml' || type === 'text/xml' || type === 'application/xml' || type === 'text/plain'
  if (detected === 'image/jpeg') return type === 'image/jpeg' || type === 'image/jpg'
  return type === detected
}

function detect(bytes: Uint8Array): { mime: ImageMime; width: number | null; height: number | null } | { reject: string } | null {
  const png = pngSize(bytes)
  if (png) return { mime: 'image/png', ...png }
  const jpeg = jpegSize(bytes)
  if (jpeg) return { mime: 'image/jpeg', ...jpeg }
  const webp = webpSize(bytes)
  if (webp) return { mime: 'image/webp', ...webp }
  return svgSize(bytes)
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 24 || signature.some((byte, index) => bytes[index] !== byte)) return null
  return { width: readU32(bytes, 16), height: readU32(bytes, 20) }
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let index = 2
  while (index + 8 < bytes.length) {
    if (bytes[index] !== 0xff) return null
    const marker = bytes[index + 1]
    if (marker === 0xd8 || marker === 0x01) {
      index += 2
      continue
    }
    if (marker === 0xd9) return null
    const length = (bytes[index + 2] << 8) + bytes[index + 3]
    if (length < 2 || index + 2 + length > bytes.length) return null
    if (marker >= 0xc0 && marker <= 0xc2) {
      return { height: (bytes[index + 5] << 8) + bytes[index + 6], width: (bytes[index + 7] << 8) + bytes[index + 8] }
    }
    index += 2 + length
  }
  return null
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    }
  }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: bytes[26] + ((bytes[27] & 0x3f) << 8),
      height: bytes[28] + ((bytes[29] & 0x3f) << 8),
    }
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)),
      height: 1 + (((bytes[22] & 0xc0) >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
    }
  }
  return null
}

function svgSize(bytes: Uint8Array): { mime: ImageMime; width: number | null; height: number | null } | { reject: string } | null {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '').trim()
  if (!/^<\?xml[\s>]|^<!DOCTYPE[\s>]|^<svg[\s>]/i.test(text) || !/<svg[\s>]/i.test(text)) return null
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return { reject: 'The SVG contains a document type and was not imported.' }
  if (/<script[\s>]|<\/script>/i.test(text)) return { reject: 'The SVG contains a script and was not imported.' }
  if (/<foreignObject[\s>]|<iframe[\s>]|<embed[\s>]|<object[\s>]/i.test(text)) return { reject: 'The SVG contains an embedded document and was not imported.' }
  if (/\son[a-z]+\s*=/i.test(text)) return { reject: 'The SVG contains an event handler and was not imported.' }
  if (/javascript\s*:/i.test(text)) return { reject: 'The SVG contains a script address and was not imported.' }
  if (/\b(?:href|xlink:href)\s*=\s*["']\s*(?!#|data:)/i.test(text)) return { reject: 'The SVG links to an external resource and was not imported.' }
  if (/url\(\s*["']?(?!data:|#)/i.test(text)) return { reject: 'The SVG links to an external resource and was not imported.' }
  const svg = text.match(/<svg\b[^>]*>/i)?.[0] ?? ''
  const width = lengthOf(svg, 'width') ?? viewBoxOf(svg)?.width ?? null
  const height = lengthOf(svg, 'height') ?? viewBoxOf(svg)?.height ?? null
  return { mime: 'image/svg+xml', width, height }
}

function lengthOf(tag: string, name: string): number | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([0-9.]+)`))
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

function viewBoxOf(tag: string): { width: number; height: number } | null {
  const match = tag.match(/\bviewBox\s*=\s*["']\s*[0-9.+-]+\s+[0-9.+-]+\s+([0-9.]+)\s+([0-9.]+)/i)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}
