import type { Mode, FileEntry } from './types'

export function detectMode(file: File): Mode {
  return file.name.endsWith('.fcd') ? 'decrypt' : 'encrypt'
}

export function outputName(file: File, mode: Mode): string {
  if (mode === 'encrypt') return file.name + '.fcd'
  if (file.name.endsWith('.fcd')) return file.name.slice(0, -4)
  return 'decrypted_' + file.name
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

// ── Password strength ────────────────────────────────────────────────────────

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
  0: '',
  1: 'слабый',
  2: 'средний',
  3: 'хороший',
  4: 'сильный',
}

export const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  0: 'transparent',
  1: 'var(--c-error)',
  2: 'var(--c-warn)',
  3: 'var(--c-info)',
  4: 'var(--c-success)',
}

// ── Preview detection ────────────────────────────────────────────────────────

export function detectPreviewType(name: string): FileEntry['previewType'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) return 'image'
  if (['txt','md','json','csv','log','xml','yaml','yml','ts','js','html','css'].includes(ext)) return 'text'
  return 'none'
}

export function downloadBytes(data: Uint8Array, filename: string): void {
  const blob = new Blob([data.buffer as ArrayBuffer])
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
