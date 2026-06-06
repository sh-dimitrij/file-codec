import type { AppState, FileEntry, HistoryEntry } from '../utils/types'
import { detectMode, outputName, uid } from '../utils/helpers'

type Listener = () => void

class Store {
  private listeners: Set<Listener> = new Set()

  state: AppState = {
    password: '',
    showPassword: false,
    files: [],
    history: [],
    activeTab: 'files',
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void {
    this.listeners.forEach(fn => fn())
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  setPassword(pw: string): void {
    this.state.password = pw
    this.notify()
  }

  toggleShowPassword(): void {
    this.state.showPassword = !this.state.showPassword
    this.notify()
  }

  addFiles(files: File[]): void {
    const entries: FileEntry[] = files.map(file => {
      const mode = detectMode(file)
      return {
        id: uid(),
        file,
        mode,
        status: 'pending',
        progress: 0,
        progressLabel: '',
        outputName: outputName(file, mode),
      }
    })
    this.state.files = [...this.state.files, ...entries]
    this.notify()
  }

  removeFile(id: string): void {
    this.state.files = this.state.files.filter(f => f.id !== id)
    this.notify()
  }

  clearDone(): void {
    this.state.files = this.state.files.filter(f => f.status !== 'done' && f.status !== 'error')
    this.notify()
  }

  updateFile(id: string, patch: Partial<FileEntry>): void {
    this.state.files = this.state.files.map(f =>
      f.id === id ? { ...f, ...patch } : f
    )
    this.notify()
  }

  pushHistory(entry: HistoryEntry): void {
    this.state.history = [entry, ...this.state.history].slice(0, 100)
    this.notify()
  }

  clearHistory(): void {
    this.state.history = []
    this.notify()
  }

  setTab(tab: AppState['activeTab']): void {
    this.state.activeTab = tab
    this.notify()
  }
}

export const store = new Store()
