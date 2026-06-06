export type Mode = 'encrypt' | 'decrypt'

export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

export interface FileEntry {
  id: string
  file: File
  mode: Mode          // auto-detected or manual
  status: FileStatus
  progress: number    // 0–100
  progressLabel: string
  outputName: string
  sha256Input?: string
  sha256Output?: string
  errorMsg?: string
  previewUrl?: string // object URL for image/text preview
  previewType?: 'image' | 'text' | 'none'
  previewText?: string
}

export interface HistoryEntry {
  id: string
  timestamp: Date
  mode: Mode
  fileName: string
  outputName: string
  fileSize: number
  sha256Input: string
  sha256Output: string
  status: 'done' | 'error'
  errorMsg?: string
}

export interface AppState {
  password: string
  showPassword: boolean
  files: FileEntry[]
  history: HistoryEntry[]
  activeTab: 'files' | 'history'
}
