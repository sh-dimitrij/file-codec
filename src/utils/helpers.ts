import type { Mode, PreviewType } from './types'

export const ENCRYPTED_EXT = 'fcd'

export function detectMode(file: File): Mode {
  return cleanInputName(file.name).endsWith(`.${ENCRYPTED_EXT}`) ? 'decrypt' : 'encrypt'
}

export function outputName(file: File, mode: Mode): string {
  const name = cleanInputName(file.name)
  if (mode === 'encrypt') return `${name}.${ENCRYPTED_EXT}`
  if (name.endsWith(`.${ENCRYPTED_EXT}`)) return name.slice(0, -(ENCRYPTED_EXT.length + 1))
  return 'decrypted_' + name
}

/**
 * Strip all browser-added " (N)" duplicate suffixes from a filename.
 * The browser inserts them before the extension when a file already exists:
 *   "photo.jpg.fcd"  → saved as "photo.jpg (1).fcd"
 *   "report.pdf"     → saved as "report (1).pdf"
 * We strip every occurrence so the logical name is clean.
 */
export function sanitiseDownloadName(name: string): string {
  // Split into base + extension(s), strip " (N)" from the base part
  // e.g. "photo.jpg (1).fcd" → split at last dot → base="photo.jpg (1)", ext=".fcd"
  // Then strip " (N)" from base → "photo.jpg"
  // Result: "photo.jpg.fcd"
  const lastDot = name.lastIndexOf('.')
  if (lastDot === -1) return name.replace(/\s\(\d+\)$/g, '')
  const base = name.slice(0, lastDot).replace(/\s\(\d+\)$/g, '')
  const ext  = name.slice(lastDot)
  return base + ext
}

/**
 * Clean a filename that came from disk — strips browser " (N)" suffixes
 * that accumulate when files are downloaded multiple times.
 * Used on the *input* file before computing outputName.
 */
export function cleanInputName(name: string): string {
  // Strip " (N)" that browser may have inserted before any extension
  // "photo.jpg (1).fcd" → "photo.jpg.fcd"
  // "photo (1).jpg.fcd" → "photo.jpg.fcd"  (handles base name dups too)
  return name.replace(/\s\(\d+\)(?=\.[^.]*$)/g, '').replace(/\s\(\d+\)$/, '')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function uid(): string {
  return crypto.randomUUID()
}

export function generatePassword(length = 20): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_=+'
  const arr = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(arr, n => chars[n % chars.length]).join('')
}

// ── Password strength ─────────────────────────────────────────────────────────

export type StrengthLevel = 0 | 1 | 2 | 3 | 4

export function passwordStrength(pw: string): StrengthLevel {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 14) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return score as StrengthLevel
}

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: '', 1: 'слабый', 2: 'средний', 3: 'хороший', 4: 'сильный',
}

export const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  0: 'transparent',
  1: 'var(--c-error)',
  2: 'var(--c-warn)',
  3: 'var(--c-info)',
  4: 'var(--c-success)',
}

// ── Preview type detection ─────────────────────────────────────────────────────

const EXT_MAP: Record<string, PreviewType> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
  webp: 'image', svg: 'image', bmp: 'image', avif: 'image', ico: 'image',
  txt: 'text', md: 'text', json: 'text', csv: 'text', log: 'text',
  xml: 'text', yaml: 'text', yml: 'text', toml: 'text', ini: 'text',
  ts: 'text', js: 'text', html: 'text', css: 'text', sh: 'text',
  py: 'text', rs: 'text', go: 'text', java: 'text', c: 'text', cpp: 'text',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio',
  aac: 'audio', m4a: 'audio', opus: 'audio', weba: 'audio',
  mp4: 'video', webm: 'video', ogv: 'video', mov: 'video',
  pdf: 'pdf',
}

const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  bmp: 'image/bmp', avif: 'image/avif', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
  opus: 'audio/opus', weba: 'audio/webm',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
}

export function detectPreviewType(name: string): PreviewType {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MAP[ext] ?? 'none'
}

export function mimeForName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

// ── Memory management ─────────────────────────────────────────────────────────

export function wipeUint8(buf: Uint8Array): void {
  buf.fill(0)
}

export function wipeString(_s: string): string {
  return ''
}

export { wipeUint8 as wipeBuffer }

// ── Download + wipe ───────────────────────────────────────────────────────────

export function downloadAndWipe(data: Uint8Array, filename: string): void {
  const clean = sanitiseDownloadName(filename)
  const mime  = mimeForName(clean)
  const blob  = new Blob([data.buffer as ArrayBuffer], { type: mime })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href = url
  a.download = clean
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => {
    URL.revokeObjectURL(url)
    wipeUint8(data)
  }, 3000)
}

export function createPreviewUrl(data: Uint8Array, filename: string): string {
  const mime = mimeForName(filename)
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mime })
  return URL.createObjectURL(blob)
}
