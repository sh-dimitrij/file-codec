import type { AppState, FileEntry, HistoryEntry } from '../utils/types'
import { detectMode, outputName, uid } from '../utils/helpers'
import { cleanupEntry } from './processor'

type Listener = () => void

class Store {
  private listeners: Set<Listener> = new Set()

  state: AppState = {
    password: '',
    showPassword: false,
    showPreview: true,
    files: [],
    history: [],
    activeTab: 'files',
    modal: { open: false, fileIds: [], currentIndex: 0 },
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void { this.listeners.forEach(fn => fn()) }

  setPassword(pw: string): void { this.state.password = pw; this.notify() }
  toggleShowPassword(): void { this.state.showPassword = !this.state.showPassword; this.notify() }
  toggleShowPreview(): void  { this.state.showPreview  = !this.state.showPreview;  this.notify() }

  addFiles(files: File[]): void {
    const entries: FileEntry[] = files.map(file => {
      const mode = detectMode(file)
      return {
        id: uid(), file, mode,
        status: 'pending', progress: 0, progressLabel: '',
        outputName: outputName(file, mode),
        selected: true,   // new files selected by default
      }
    })
    this.state.files = [...this.state.files, ...entries]
    this.notify()
  }

  removeFile(id: string): void {
    const entry = this.state.files.find(f => f.id === id)
    if (entry) cleanupEntry(entry)
    this.state.files = this.state.files.filter(f => f.id !== id)
    if (this.state.modal.open) {
      const ids = this.state.modal.fileIds.filter(fid => fid !== id)
      this.state.modal = ids.length
        ? { ...this.state.modal, fileIds: ids, currentIndex: Math.min(this.state.modal.currentIndex, ids.length - 1) }
        : { open: false, fileIds: [], currentIndex: 0 }
    }
    this.notify()
  }

  clearDone(): void {
    this.state.files.filter(f => f.status === 'done' || f.status === 'error').forEach(f => cleanupEntry(f))
    this.state.files = this.state.files.filter(f => f.status !== 'done' && f.status !== 'error')
    this.state.modal = { open: false, fileIds: [], currentIndex: 0 }
    this.notify()
  }

  updateFile(id: string, patch: Partial<FileEntry>): void {
    this.state.files = this.state.files.map(f => f.id === id ? { ...f, ...patch } : f)
    this.notify()
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  toggleSelect(id: string): void {
    this.state.files = this.state.files.map(f =>
      f.id === id ? { ...f, selected: !f.selected } : f
    )
    this.notify()
  }

  selectAll(): void {
    const pendingFiles = this.state.files.filter(f => f.status === 'pending' || f.status === 'error')
    const allSelected  = pendingFiles.every(f => f.selected)
    this.state.files = this.state.files.map(f =>
      (f.status === 'pending' || f.status === 'error')
        ? { ...f, selected: !allSelected }
        : f
    )
    this.notify()
  }

  // ── Re-queue error ─────────────────────────────────────────────────────────
  // Reset an errored file back to pending so it can be retried

  requeueFile(id: string): void {
    this.state.files = this.state.files.map(f =>
      f.id === id && f.status === 'error'
        ? { ...f, status: 'pending', progress: 0, progressLabel: '', errorMsg: undefined, selected: true }
        : f
    )
    this.notify()
  }

  requeueAllErrors(): void {
    this.state.files = this.state.files.map(f =>
      f.status === 'error'
        ? { ...f, status: 'pending', progress: 0, progressLabel: '', errorMsg: undefined, selected: true }
        : f
    )
    this.notify()
  }

  // ── History ────────────────────────────────────────────────────────────────

  pushHistory(entry: HistoryEntry): void {
    this.state.history = [entry, ...this.state.history].slice(0, 100)
    this.notify()
  }

  clearHistory(): void { this.state.history = []; this.notify() }
  setTab(tab: AppState['activeTab']): void { this.state.activeTab = tab; this.notify() }

  // ── Modal ──────────────────────────────────────────────────────────────────

  openModal(fileIds: string[], startIndex = 0): void {
    this.state.modal = { open: true, fileIds, currentIndex: startIndex }
    this.notify()
  }

  closeModal(): void {
    this.state.modal = { open: false, fileIds: [], currentIndex: 0 }
    this.notify()
  }

  modalNext(): void {
    const { fileIds, currentIndex } = this.state.modal
    if (currentIndex < fileIds.length - 1) {
      this.state.modal = { ...this.state.modal, currentIndex: currentIndex + 1 }
      this.notify()
    }
  }

  modalPrev(): void {
    if (this.state.modal.currentIndex > 0) {
      this.state.modal = { ...this.state.modal, currentIndex: this.state.modal.currentIndex - 1 }
      this.notify()
    }
  }

  modalGoTo(index: number): void {
    this.state.modal = { ...this.state.modal, currentIndex: index }
    this.notify()
  }
}

export const store = new Store()
