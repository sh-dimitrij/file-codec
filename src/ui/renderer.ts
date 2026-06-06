import { store } from './store'
import { processAll, downloadEntry, downloadAllPending } from './processor'
import {
  formatBytes, formatTime,
  generatePassword,
  passwordStrength, STRENGTH_LABELS, STRENGTH_COLORS,
} from '../utils/helpers'
import type { AppState, FileEntry, HistoryEntry } from '../utils/types'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export function mount(root: HTMLElement): void {
  render(root, store.state)
  store.subscribe(() => renderSmart(root, store.state))
  wireDocumentEvents()
}

// ── Smart render ──────────────────────────────────────────────────────────────

function renderSmart(root: HTMLElement, state: AppState): void {
  const pwEl = document.getElementById('password') as HTMLInputElement | null
  const hasFocus = pwEl === document.activeElement
  const caretStart = pwEl?.selectionStart ?? 0
  const caretEnd   = pwEl?.selectionEnd   ?? 0

  render(root, state)

  if (hasFocus) {
    const newPw = document.getElementById('password') as HTMLInputElement | null
    if (newPw) { newPw.focus(); newPw.setSelectionRange(caretStart, caretEnd) }
  }
}

function render(root: HTMLElement, state: AppState): void {
  root.innerHTML = `
    ${renderHeader()}
    ${renderPasswordBar(state)}
    ${renderTabs(state)}
    ${state.activeTab === 'files' ? renderFilesTab(state) : renderHistoryTab(state)}
    ${state.modal.open ? renderModal(state) : ''}
  `
}

// ── Header ────────────────────────────────────────────────────────────────────

function renderHeader(): string {
  return `
    <header class="header">
      <div class="header-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span class="header-title">file<em>codec</em></span>
      </div>
      <div class="header-meta">AES-GCM 256 | PBKDF2 | .fcd</div>
    </header>
  `
}

// ── Password bar ──────────────────────────────────────────────────────────────

function renderPasswordBar(state: AppState): string {
  const strength = passwordStrength(state.password)
  const bars = Array.from({ length: 4 }, (_, i) => {
    const filled = i < strength
    const color  = filled ? STRENGTH_COLORS[strength] : 'var(--c-border)'
    return `<span class="str-bar" style="background:${color}"></span>`
  }).join('')

  return `
    <section class="pw-bar card">
      <div class="pw-top-row">
        <label class="field-label" for="password">Пароль</label>
        <div class="preview-toggle">
          <span class="toggle-label">Предпросмотр</span>
          <button
            class="toggle-switch ${state.showPreview ? 'on' : 'off'}"
            data-action="toggle-preview"
            role="switch"
            aria-checked="${state.showPreview}"
            title="${state.showPreview ? 'Предпросмотр включён' : 'Предпросмотр выключен'}"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
      <div class="pw-input-wrap">
        <input
          class="input pw-input"
          id="password"
          type="${state.showPassword ? 'text' : 'password'}"
          value="${escHtml(state.password)}"
          placeholder="Введите пароль…"
          autocomplete="off"
          spellcheck="false"
        >
        <button class="icon-btn" data-action="toggle-pw" title="${state.showPassword ? 'Скрыть' : 'Показать'}">
          ${state.showPassword ? iconEyeOff() : iconEye()}
        </button>
        <button class="icon-btn" data-action="gen-pw" title="Сгенерировать пароль">
          ${iconDice()}
        </button>
        ${state.password ? `
          <button class="icon-btn" data-action="copy-pw" title="Скопировать пароль">
            ${iconCopy()}
          </button>
        ` : ''}
      </div>
      <div class="str-row">
        <div class="str-bars">${bars}</div>
        <span class="str-label" style="color:${STRENGTH_COLORS[strength]}">${STRENGTH_LABELS[strength]}</span>
      </div>
    </section>
  `
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function renderTabs(state: AppState): string {
  const pendingFiles  = state.files.filter(f => f.status === 'pending')
  const selectedCount = pendingFiles.filter(f => f.selected).length
  const allSelected   = pendingFiles.length > 0 && pendingFiles.every(f => f.selected)
  const hasErrors     = state.files.some(f => f.status === 'error')

  return `
    <nav class="tabs">
      <button class="tab-btn ${state.activeTab === 'files' ? 'active' : ''}" data-action="tab-files">
        Файлы ${state.files.length ? `<span class="badge">${state.files.length}</span>` : ''}
      </button>
      <button class="tab-btn ${state.activeTab === 'history' ? 'active' : ''}" data-action="tab-history">
        История ${state.history.length ? `<span class="badge">${state.history.length}</span>` : ''}
      </button>
      <div class="tabs-right">
        ${hasErrors ? `
          <button class="text-btn requeue-all-btn" data-action="requeue-all" title="Вернуть все ошибочные файлы в очередь">
            ${iconRefresh()} Повторить ошибочные
          </button>
        ` : ''}
        ${pendingFiles.length > 1 ? `
          <button class="select-all-btn ${allSelected ? 'all-on' : ''}" data-action="select-all">
            ${allSelected ? iconCheckSquare() : iconSquare()} Все
          </button>
        ` : ''}
        ${selectedCount > 0 ? `
          <button class="run-btn" data-action="run-all">
            ${iconPlay()} Запустить (${selectedCount})
          </button>
        ` : ''}
      </div>
    </nav>
  `
}

// ── Files tab ─────────────────────────────────────────────────────────────────

function renderFilesTab(state: AppState): string {
  const doneWithPreview = state.files.filter(
    f => f.status === 'done' && f.previewType !== 'none' && f.previewType
  )
  const doneNotDownloaded = state.files.filter(
    f => f.status === 'done' && !f.downloaded && f.pendingDownload
  )
  const hasDoneOrError = state.files.some(f => f.status === 'done' || f.status === 'error')

  return `
    <section class="files-tab">
      ${renderDropZone()}
      ${state.files.length ? `
        <div class="file-list">
          ${state.files.map(f => renderFileCard(f, state.showPreview)).join('')}
        </div>
        <div class="bulk-actions">
          ${doneWithPreview.length > 0 ? `
            <button class="bulk-btn preview-btn" data-action="open-modal">
              ${iconEye()} Просмотр (${doneWithPreview.length})
            </button>
          ` : ''}
          ${doneNotDownloaded.length > 0 ? `
            <button class="bulk-btn download-all-btn" data-action="download-all">
              ${iconDownload()} Скачать все (${doneNotDownloaded.length})
            </button>
          ` : ''}
          ${hasDoneOrError ? `
            <button class="text-btn clear-btn" data-action="clear-done">Очистить завершённые</button>
          ` : ''}
        </div>
      ` : ''}
    </section>
  `
}

function renderDropZone(): string {
  return `
    <div class="drop-zone" id="drop-zone">
      <input type="file" id="file-input" multiple>
      <label for="file-input" class="drop-inner">
        <div class="drop-icon">${iconUpload(32)}</div>
        <p class="drop-title">Перетащите файлы сюда</p>
        <p class="drop-sub">или <span class="drop-link">нажмите для выбора</span> · любой формат · автоопределение режима</p>
      </label>
    </div>
  `
}

function renderFileCard(entry: FileEntry, showPreview: boolean): string {
  const modeLabel = entry.mode === 'encrypt' ? 'шифровать' : 'дешифровать'
  const modeClass = entry.mode === 'encrypt' ? 'badge-enc' : 'badge-dec'
  const isSelectable = entry.status === 'pending'
  const statusIcon = {
    pending:    iconClock(),
    processing: `<span class="spin">${iconLoader()}</span>`,
    done:       iconCheck(),
    error:      iconX(),
  }[entry.status]

  return `
    <article class="file-card status-${entry.status}${isSelectable && !entry.selected ? ' deselected' : ''}">
      <div class="file-card-top">
        ${isSelectable ? `
          <button class="checkbox-btn ${entry.selected ? 'checked' : ''}" data-action="toggle-select" data-id="${entry.id}" aria-label="Выбрать файл">
            ${entry.selected ? iconCheckSquare() : iconSquare()}
          </button>
        ` : ''}
        <div class="file-card-info">
          <span class="file-icon">${iconFile()}</span>
          <div class="file-name-wrap">
            <span class="file-name" title="${escHtml(entry.file.name)}">${escHtml(entry.file.name)}</span>
            <span class="file-size">${formatBytes(entry.file.size)}</span>
          </div>
        </div>
        <div class="file-card-controls">
          <span class="badge ${modeClass}">${modeLabel}</span>
          <span class="status-icon">${statusIcon}</span>
          ${entry.status === 'pending' ? `
            <button class="icon-btn danger" data-action="remove-file" data-id="${entry.id}" aria-label="Удалить">
              ${iconTrash()}
            </button>
          ` : ''}
          ${entry.status === 'error' ? `
            <button class="icon-btn" data-action="requeue-file" data-id="${entry.id}" title="Вернуть в очередь" aria-label="Повторить">
              ${iconRefresh()}
            </button>
            <button class="icon-btn danger" data-action="remove-file" data-id="${entry.id}" aria-label="Удалить">
              ${iconTrash()}
            </button>
          ` : ''}
        </div>
      </div>

      ${entry.status === 'processing' ? `
        <div class="progress-wrap">
          <div class="progress-track">
            <div class="progress-fill ${entry.mode}" style="width:${entry.progress}%"></div>
          </div>
          <span class="progress-label">${escHtml(entry.progressLabel)}</span>
        </div>
      ` : ''}

      ${entry.status === 'done' ? renderCardDone(entry, showPreview) : ''}
      ${entry.status === 'error' ? `
        <div class="error-msg">${iconX()} ${escHtml(entry.errorMsg ?? 'Ошибка')}</div>
      ` : ''}
    </article>
  `
}

function renderCardDone(entry: FileEntry, showPreview: boolean): string {
  const hasPreview = showPreview && entry.previewType && entry.previewType !== 'none'
  return `
    <div class="file-card-result">
      <div class="hash-row">
        <span class="hash-label">SHA-256 in</span>
        <code class="hash-val">${entry.sha256Input ?? '—'}</code>
      </div>
      <div class="hash-row">
        <span class="hash-label">SHA-256 out</span>
        <code class="hash-val">${entry.sha256Output ?? '—'}</code>
      </div>
      <div class="card-done-row">
        <span class="output-name">→ ${escHtml(entry.outputName)}</span>
        <div class="card-done-btns">
          ${hasPreview && !entry.downloaded ? `
            <button class="card-btn preview-card-btn" data-action="open-modal-file" data-id="${entry.id}">
              ${iconEye()} Просмотр
            </button>
          ` : ''}
          ${!entry.downloaded && entry.pendingDownload ? `
            <button class="card-btn download-card-btn" data-action="download-file" data-id="${entry.id}">
              ${iconDownload()} Скачать
            </button>
          ` : entry.downloaded ? `
            <span class="downloaded-note">${iconCheck()} Скачано</span>
          ` : ''}
        </div>
      </div>
    </div>
  `
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function renderModal(state: AppState): string {
  const { fileIds, currentIndex } = state.modal
  const entry = state.files.find(f => f.id === fileIds[currentIndex])
  if (!entry) return ''

  const total = fileIds.length
  const isFirst = currentIndex === 0
  const isLast  = currentIndex === total - 1

  // Count how many in the modal list still need downloading
  const notDownloaded = fileIds.filter(id => {
    const f = state.files.find(e => e.id === id)
    return f && !f.downloaded && f.pendingDownload
  })

  return `
    <div class="modal-backdrop" data-action="close-modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Предпросмотр файла">

        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title">
            <span class="modal-filename">${escHtml(entry.outputName)}</span>
            ${total > 1 ? `<span class="modal-counter">${currentIndex + 1} / ${total}</span>` : ''}
          </div>
          <button class="icon-btn" data-action="close-modal" aria-label="Закрыть">${iconX()}</button>
        </div>

        <!-- Thumbnail strip (if >1 file) -->
        ${total > 1 ? `
          <div class="modal-strip">
            ${fileIds.map((id, i) => {
              const f = state.files.find(e => e.id === id)
              if (!f) return ''
              const active = i === currentIndex
              const dl = f.downloaded ? ' strip-dl' : ''
              return `
                <button
                  class="strip-thumb ${active ? 'active' : ''}${dl}"
                  data-action="modal-goto"
                  data-index="${i}"
                  title="${escHtml(f.outputName)}"
                >
                  ${stripIcon(f)}
                  <span class="strip-name">${escHtml(f.outputName.split('/').pop() ?? f.outputName)}</span>
                </button>
              `
            }).join('')}
          </div>
        ` : ''}

        <!-- Content -->
        <div class="modal-body">
          ${renderModalContent(entry)}
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div class="modal-nav">
            ${!isFirst ? `
              <button class="nav-btn" data-action="modal-prev">
                ${iconChevLeft()} Назад
              </button>
            ` : '<span></span>'}
            ${!isLast ? `
              <button class="nav-btn nav-next" data-action="modal-next">
                Далее ${iconChevRight()}
              </button>
            ` : ''}
          </div>
          <div class="modal-actions">
            ${!entry.downloaded && entry.pendingDownload ? `
              <button class="modal-btn download-btn" data-action="download-file" data-id="${entry.id}">
                ${iconDownload()} Скачать этот файл
              </button>
            ` : entry.downloaded ? `
              <span class="downloaded-note">${iconCheck()} Скачан</span>
            ` : ''}
            ${notDownloaded.length > 1 ? `
              <button class="modal-btn download-all-btn" data-action="download-all">
                ${iconDownload()} Скачать все (${notDownloaded.length})
              </button>
            ` : ''}
            <button class="modal-btn close-modal-btn" data-action="close-modal">
              Закрыть
            </button>
          </div>
        </div>

      </div>
    </div>
  `
}

function renderModalContent(entry: FileEntry): string {
  const { previewType, previewUrl, previewText, outputName: name } = entry

  if (previewType === 'image' && previewUrl) {
    return `<img class="mc-image" src="${previewUrl}" alt="${escHtml(name)}">`
  }
  if (previewType === 'audio' && previewUrl) {
    return `
      <div class="mc-audio-wrap">
        <div class="mc-audio-icon">${iconMusic(48)}</div>
        <p class="mc-audio-name">${escHtml(name)}</p>
        <audio class="mc-audio" controls autoplay src="${previewUrl}"></audio>
      </div>
    `
  }
  if (previewType === 'video' && previewUrl) {
    return `<video class="mc-video" controls autoplay src="${previewUrl}"></video>`
  }
  if (previewType === 'pdf' && previewUrl) {
    return `<iframe class="mc-pdf" src="${previewUrl}" title="${escHtml(name)}"></iframe>`
  }
  if (previewType === 'text' && previewText !== undefined) {
    return `<pre class="mc-text">${escHtml(previewText)}</pre>`
  }
  return `<div class="mc-empty">Предпросмотр недоступен</div>`
}

function stripIcon(f: FileEntry): string {
  const t = f.previewType
  if (t === 'image' && f.previewUrl) {
    return `<img class="strip-img" src="${f.previewUrl}" alt="">`
  }
  if (t === 'audio')  return `<span class="strip-type-icon">${iconMusic()}</span>`
  if (t === 'video')  return `<span class="strip-type-icon">${iconVideo()}</span>`
  if (t === 'pdf')    return `<span class="strip-type-icon">${iconFilePdf()}</span>`
  return `<span class="strip-type-icon">${iconFile()}</span>`
}

// ── History tab ───────────────────────────────────────────────────────────────

function renderHistoryTab(state: AppState): string {
  if (!state.history.length) {
    return `<section class="history-tab"><div class="empty-state">${iconClock()} История пуста</div></section>`
  }
  return `
    <section class="history-tab">
      <div class="history-header">
        <span>${state.history.length} операций</span>
        <button class="text-btn" data-action="clear-history">Очистить</button>
      </div>
      <div class="history-list">${state.history.map(renderHistoryRow).join('')}</div>
    </section>
  `
}

function renderHistoryRow(entry: HistoryEntry): string {
  const modeLabel  = entry.mode === 'encrypt' ? 'зашифровано' : 'дешифровано'
  const statusClass = entry.status === 'done' ? 'h-done' : 'h-error'
  return `
    <div class="history-row ${statusClass}">
      <div class="h-row-top">
        <span class="h-file">${escHtml(entry.fileName)}</span>
        <span class="h-time">${formatTime(entry.timestamp)}</span>
      </div>
      <div class="h-row-meta">
        <span class="badge ${entry.mode === 'encrypt' ? 'badge-enc' : 'badge-dec'}">${modeLabel}</span>
        <span class="h-size">${formatBytes(entry.fileSize)}</span>
        ${entry.status === 'error' ? `<span class="h-err">${escHtml(entry.errorMsg ?? '')}</span>` : ''}
      </div>
      ${entry.status === 'done' ? `
        <div class="h-hash">SHA-256: <code>${entry.sha256Output.slice(0, 16)}…</code></div>
      ` : ''}
    </div>
  `
}

// ── Persistent event delegation ───────────────────────────────────────────────

let eventsWired = false

function wireDocumentEvents(): void {
  if (eventsWired) return
  eventsWired = true

  document.addEventListener('click', async (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    const action = target.dataset['action']!
    const id     = target.dataset['id']
    const index  = target.dataset['index']

    switch (action) {
      case 'toggle-pw':      store.toggleShowPassword(); break
      case 'toggle-preview': store.toggleShowPreview(); break
      case 'gen-pw':         store.setPassword(generatePassword()); break
      case 'copy-pw':        await navigator.clipboard.writeText(store.state.password); break
      case 'tab-files':      store.setTab('files'); break
      case 'tab-history':    store.setTab('history'); break
      case 'run-all':
        if (!store.state.password) { alert('Введите пароль'); return }
        await processAll(store.state.password)
        break
      case 'remove-file':    if (id) store.removeFile(id); break
      case 'toggle-select':  if (id) store.toggleSelect(id); break
      case 'select-all':     store.selectAll(); break
      case 'requeue-file':   if (id) store.requeueFile(id); break
      case 'requeue-all':    store.requeueAllErrors(); break
      case 'clear-done':     store.clearDone(); break
      case 'clear-history':  store.clearHistory(); break
      case 'download-file': {
        if (!id) break
        const entry = store.state.files.find(f => f.id === id)
        if (entry) downloadEntry(entry)
        break
      }
      case 'download-all':
        downloadAllPending(); break
      case 'open-modal': {
        const previewable = store.state.files.filter(
          f => f.status === 'done' && f.previewType && f.previewType !== 'none'
        )
        if (previewable.length) store.openModal(previewable.map(f => f.id), 0)
        break
      }
      case 'open-modal-file': {
        if (!id) break
        const previewable = store.state.files.filter(
          f => f.status === 'done' && f.previewType && f.previewType !== 'none'
        )
        const idx = previewable.findIndex(f => f.id === id)
        if (previewable.length) store.openModal(previewable.map(f => f.id), Math.max(0, idx))
        break
      }
      case 'close-modal':          store.closeModal(); break
      case 'close-modal-backdrop':
        if ((e.target as HTMLElement).dataset['action'] === 'close-modal-backdrop') {
          store.closeModal()
        }
        break
      case 'modal-next':           store.modalNext(); break
      case 'modal-prev':           store.modalPrev(); break
      case 'modal-goto':
        if (index !== undefined) store.modalGoTo(Number(index))
        break
    }
  })

  document.addEventListener('input', (e: Event) => {
    const t = e.target as HTMLElement
    if (t.id === 'password') store.setPassword((t as HTMLInputElement).value)
  })

  document.addEventListener('change', (e: Event) => {
    const t = e.target as HTMLInputElement
    if (t.id === 'file-input' && t.files) {
      store.addFiles(Array.from(t.files))
      t.value = ''
    }
  })

  document.addEventListener('dragenter', (e) => {
    e.preventDefault()
    document.getElementById('drop-zone')?.classList.add('drag-over')
  })
  document.addEventListener('dragover', (e) => {
    e.preventDefault()
    document.getElementById('drop-zone')?.classList.add('drag-over')
  })
  document.addEventListener('dragleave', (e: DragEvent) => {
    if (!e.relatedTarget) document.getElementById('drop-zone')?.classList.remove('drag-over')
  })
  document.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault()
    document.getElementById('drop-zone')?.classList.remove('drag-over')
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) { store.addFiles(files); store.setTab('files') }
  })

  // Keyboard navigation in modal
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!store.state.modal.open) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') store.modalNext()
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   store.modalPrev()
    if (e.key === 'Escape') store.closeModal()
  })
}

// ── Escape HTML ───────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const svg = (d: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

const iconEye      = () => svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')
const iconEyeOff   = () => svg('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>')
const iconDice     = () => svg('<rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/>')
const iconCopy     = () => svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')
const iconUpload   = (s = 32) => svg('<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>', s)
const iconPlay     = () => svg('<polygon points="5 3 19 12 5 21 5 3"/>')
const iconFile     = () => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>')
const iconClock    = () => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>')
const iconLoader   = () => svg('<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>')
const iconCheck    = () => svg('<polyline points="20 6 9 17 4 12"/>')
const iconX        = () => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')
const iconTrash      = () => svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>')
const iconDownload   = () => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')
const iconChevLeft   = () => svg('<polyline points="15 18 9 12 15 6"/>')
const iconChevRight  = () => svg('<polyline points="9 18 15 12 9 6"/>')
const iconMusic      = (s=16) => svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', s)
const iconVideo      = () => svg('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>')
const iconFilePdf    = () => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>')
const iconSquare     = () => svg('<rect x="3" y="3" width="18" height="18" rx="2"/>')
const iconCheckSquare= () => svg('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')
const iconRefresh    = () => svg('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>')
