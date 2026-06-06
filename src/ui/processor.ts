import { encryptBuffer, decryptBuffer, sha256hex, wipeBuffer } from '../crypto/engine'
import { downloadBytes, detectPreviewType, uid } from '../utils/helpers'
import type { FileEntry } from '../utils/types'
import { store } from './store'

export async function processFile(entry: FileEntry, password: string): Promise<void> {
  const { id, file, mode, outputName } = entry

  store.updateFile(id, { status: 'processing', progress: 0, progressLabel: 'Старт…' })

  const onProgress = (pct: number, label: string) => {
    store.updateFile(id, { progress: pct, progressLabel: label })
  }

  let inputBuf: ArrayBuffer
  let result: Awaited<ReturnType<typeof encryptBuffer>>

  try {
    inputBuf = await file.arrayBuffer()
    const sha256Input = await sha256hex(inputBuf)
    store.updateFile(id, { sha256Input })

    if (mode === 'encrypt') {
      result = await encryptBuffer(inputBuf, password, onProgress)
    } else {
      result = await decryptBuffer(inputBuf, password, onProgress)
    }

    // Preview (decrypt only, for images / text)
    let previewUrl: string | undefined
    let previewText: string | undefined
    const previewType = mode === 'decrypt' ? detectPreviewType(outputName) : 'none'

    if (previewType === 'image') {
      const blob = new Blob([result.data.buffer as ArrayBuffer])
      previewUrl = URL.createObjectURL(blob)
    } else if (previewType === 'text') {
      previewText = new TextDecoder().decode(result.data).slice(0, 4000)
    }

    store.updateFile(id, {
      status: 'done',
      progress: 100,
      sha256Output: result.sha256,
      previewType,
      previewUrl,
      previewText,
    })

    // Add to history
    store.pushHistory({
      id: uid(),
      timestamp: new Date(),
      mode,
      fileName: file.name,
      outputName,
      fileSize: file.size,
      sha256Input: sha256Input,
      sha256Output: result.sha256,
      status: 'done',
    })

    // Auto-download
    downloadBytes(result.data, outputName)

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка'
    store.updateFile(id, { status: 'error', errorMsg, progress: 0, progressLabel: '' })
    store.pushHistory({
      id: uid(),
      timestamp: new Date(),
      mode,
      fileName: file.name,
      outputName,
      fileSize: file.size,
      sha256Input: '',
      sha256Output: '',
      status: 'error',
      errorMsg,
    })
  } finally {
    // Best-effort wipe of input buffer
    wipeBuffer(new Uint8Array(inputBuf!))
  }
}

export async function processAll(password: string): Promise<void> {
  const pending = store.state.files.filter(f => f.status === 'pending')
  // Run sequentially to avoid memory spikes on large files
  for (const entry of pending) {
    await processFile(entry, password)
  }
}
