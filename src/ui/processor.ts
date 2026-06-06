import { encryptBuffer, decryptBuffer, sha256hex, wipeBuffer } from '../crypto/engine'
import {
  downloadAndWipe, wipeUint8, wipeString,
  detectPreviewType, createPreviewUrl, uid, ENCRYPTED_EXT,
} from '../utils/helpers'
import type { FileEntry, PreviewType } from '../utils/types'
import { store } from './store'

export async function processFile(entry: FileEntry, password: string): Promise<void> {
  const { id, file, mode, outputName } = entry

  store.updateFile(id, { status: 'processing', progress: 0, progressLabel: 'Старт…' })

  const onProgress = (pct: number, label: string) =>
    store.updateFile(id, { progress: pct, progressLabel: label })

  let inputBuf: ArrayBuffer | undefined
  let resultData: Uint8Array | undefined

  try {
    inputBuf = await file.arrayBuffer()
    const sha256Input = await sha256hex(inputBuf)
    store.updateFile(id, { sha256Input })

    const result = mode === 'encrypt'
      ? await encryptBuffer(inputBuf, password, onProgress)
      : await decryptBuffer(inputBuf, password, onProgress)

    resultData = result.data

    const showPreview = store.state.showPreview
    // Fix #2: outputName for decrypt already strips .fcd, but guard against edge cases
    const nameForPreview = outputName.endsWith(`.${ENCRYPTED_EXT}`)
      ? outputName.slice(0, -(ENCRYPTED_EXT.length + 1))
      : outputName
    const previewType: PreviewType = (mode === 'decrypt' && showPreview)
      ? detectPreviewType(nameForPreview)
      : 'none'

    let previewUrl: string | undefined
    let previewText: string | undefined
    let pendingDownload: Uint8Array | undefined
    let downloaded = false

    if (mode === 'decrypt' && showPreview && previewType !== 'none') {
      if (previewType === 'text') {
        previewText = new TextDecoder().decode(resultData).slice(0, 8000)
        wipeUint8(resultData)
        resultData = undefined
        downloaded = false // still need to download
        // For text: we lost the buffer, so we can't offer download after wipe.
        // Re-encode previewText as UTF-8 for the download button.
        pendingDownload = new TextEncoder().encode(previewText)
      } else {
        previewUrl = createPreviewUrl(resultData, outputName)
        pendingDownload = resultData
        resultData = undefined
      }
    } else {
      // No preview: auto-download and wipe immediately
      downloadAndWipe(resultData, outputName)
      resultData = undefined
      downloaded = true
    }

    store.updateFile(id, {
      status: 'done',
      progress: 100,
      sha256Output: result.sha256,
      previewType,
      previewUrl,
      previewText,
      pendingDownload,
      downloaded,
    })

    store.pushHistory({
      id: uid(),
      timestamp: new Date(),
      mode,
      fileName: file.name,
      outputName,
      fileSize: file.size,
      sha256Input,
      sha256Output: result.sha256,
      status: 'done',
    })

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка'
    store.updateFile(id, { status: 'error', errorMsg, progress: 0, progressLabel: '' })
    store.pushHistory({
      id: uid(), timestamp: new Date(), mode,
      fileName: file.name, outputName, fileSize: file.size,
      sha256Input: '', sha256Output: '',
      status: 'error', errorMsg,
    })
    if (resultData) wipeUint8(resultData)

  } finally {
    if (inputBuf) wipeBuffer(new Uint8Array(inputBuf))
  }
}

/**
 * Download a single entry's pending buffer and wipe it.
 */
export function downloadEntry(entry: FileEntry): void {
  if (!entry.pendingDownload || entry.downloaded) return
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl)
  downloadAndWipe(entry.pendingDownload, entry.outputName)
  // Clear previewUrl so the UI doesn't show a broken blob reference
  store.updateFile(entry.id, {
    downloaded: true,
    pendingDownload: undefined,
    previewUrl: undefined,
  })
}

/**
 * Download ALL entries that haven't been downloaded yet.
 */
export function downloadAllPending(): void {
  const entries = store.state.files.filter(
    f => f.status === 'done' && !f.downloaded && f.pendingDownload
  )
  entries.forEach(e => downloadEntry(e))
}

/**
 * Revoke URLs + wipe buffers when a card is removed.
 */
export function cleanupEntry(entry: FileEntry): void {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl)
  if (entry.pendingDownload) wipeUint8(entry.pendingDownload)
}

export async function processAll(password: string): Promise<void> {
  // Only process pending files that are selected
  const pending = store.state.files.filter(f => f.status === 'pending' && f.selected)
  const pendingIds = new Set(pending.map(f => f.id))

  for (const entry of pending) {
    await processFile(entry, password)
  }

  // Open modal only for files processed in THIS run that have a preview
  if (store.state.showPreview) {
    const newPreviewable = store.state.files.filter(
      f => pendingIds.has(f.id) && f.status === 'done' && f.previewType && f.previewType !== 'none'
    )
    if (newPreviewable.length > 0) {
      store.openModal(newPreviewable.map(f => f.id), 0)
    }
  }
  wipeString(password)
}
