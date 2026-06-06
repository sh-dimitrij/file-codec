/**
 * Crypto Engine — AES-GCM 256 + PBKDF2
 *
 * File format (binary):
 *   [0..15]  salt       — 16 bytes, random
 *   [16..27] iv         — 12 bytes, random
 *   [28..]   ciphertext — N bytes (includes 16-byte GCM auth tag)
 */

export const PBKDF2_ITERATIONS = 600_000
export const SALT_BYTES = 16
export const IV_BYTES = 12
export const HEADER_SIZE = SALT_BYTES + IV_BYTES // 28

export interface CryptoResult {
  data: Uint8Array
  sha256: string
}

// ── Key derivation ────────────────────────────────────────────────────────────

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(password)
  const keyMaterial = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── SHA-256 ───────────────────────────────────────────────────────────────────

export async function sha256hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

export async function encryptBuffer(
  plaintext: ArrayBuffer,
  password: string,
  onProgress?: (pct: number, label: string) => void,
): Promise<CryptoResult> {
  onProgress?.(5, 'Чтение файла…')

  const saltArr = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const ivArr   = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const salt    = saltArr.buffer as ArrayBuffer
  // iv used via ivArr directly

  onProgress?.(20, `Деривация ключа (PBKDF2 · ${PBKDF2_ITERATIONS.toLocaleString()} итераций)…`)
  const key = await deriveKey(password, salt)

  onProgress?.(65, 'Шифрование AES-GCM 256…')
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivArr }, key, plaintext)

  onProgress?.(88, 'Вычисление SHA-256…')
  const out = new Uint8Array(HEADER_SIZE + ciphertext.byteLength)
  out.set(saltArr, 0)
  out.set(ivArr, SALT_BYTES)
  out.set(new Uint8Array(ciphertext), HEADER_SIZE)

  const sha256 = await sha256hex(out.buffer as ArrayBuffer)

  onProgress?.(100, 'Готово')
  return { data: out, sha256 }
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

export async function decryptBuffer(
  encData: ArrayBuffer,
  password: string,
  onProgress?: (pct: number, label: string) => void,
): Promise<CryptoResult> {
  onProgress?.(5, 'Чтение файла…')

  const buf = new Uint8Array(encData)
  if (buf.length <= HEADER_SIZE) {
    throw new Error('Файл слишком мал или повреждён')
  }

  const saltArr    = buf.slice(0, SALT_BYTES)
  const ivArr      = buf.slice(SALT_BYTES, HEADER_SIZE)
  const ciphertext = buf.slice(HEADER_SIZE)

  onProgress?.(20, `Деривация ключа (PBKDF2 · ${PBKDF2_ITERATIONS.toLocaleString()} итераций)…`)
  const key = await deriveKey(password, saltArr.buffer as ArrayBuffer)

  onProgress?.(65, 'Дешифрование AES-GCM 256…')
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivArr }, key, ciphertext)
  } catch {
    throw new Error('Неверный пароль или файл повреждён (ошибка аутентификации GCM)')
  }

  onProgress?.(90, 'Вычисление SHA-256…')
  const sha256 = await sha256hex(plaintext)

  onProgress?.(100, 'Готово')
  return { data: new Uint8Array(plaintext), sha256 }
}

// ── Secure wipe ───────────────────────────────────────────────────────────────

export function wipeBuffer(buf: Uint8Array): void {
  buf.fill(0)
}
