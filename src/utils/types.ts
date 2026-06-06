export type Mode = 'encrypt' | 'decrypt'

export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

export type PreviewType = 'image' | 'text' | 'audio' | 'video' | 'pdf' | 'none'

export interface FileEntry {
  id: string
  file: File
  mode: Mode
  status: FileStatus
  progress: number
  progressLabel: string
  outputName: string
  selected: boolean       // for batch selection
  sha256Input?: string
  sha256Output?: string
  errorMsg?: string
  previewType?: PreviewType
  previewUrl?: string
  previewText?: string
  pendingDownload?: Uint8Array
  downloaded?: boolean
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

export interface ModalState {
  open: boolean
  fileIds: string[]   // ordered list of previewable file IDs
  currentIndex: number
}

export interface AppState {
  password: string
  showPassword: boolean
  showPreview: boolean  // global preview toggle
  files: FileEntry[]
  history: HistoryEntry[]
  activeTab: 'files' | 'history'
  modal: ModalState
}
