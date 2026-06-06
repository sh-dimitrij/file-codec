import { store } from './store'
import { processAll } from './processor'
import {
  formatBytes, formatTime,
  generatePassword,
  passwordStrength, STRENGTH_LABELS, STRENGTH_COLORS,
} from '../utils/helpers'
import type { AppState, FileEntry, HistoryEntry } from '../utils/types'

// ── Root ─────────────────────────────────────────────────────────────────────

export function mount(root: HTMLElement): void {
  store.subscribe(() => render(root, store.state))
  render(root, store.state)
  wireDrop()
}

// ── Main render ──────────────────────────────────────────────────────────────

function render(root: HTMLElement, state: AppState): void {
  root.innerHTML = `
    ${renderHeader()}
    ${renderPasswordBar(state)}
    ${renderTabs(state)}
    ${state.activeTab === 'files' ? renderFilesTab(state) : renderHistoryTab(state)}
  `
  wireEvents(state)
}

// ── Header ───────────────────────────────────────────────────────────────────

function renderHeader(): string {
  return `
    <header class="header">
      <div class="header-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span class="header-title">file<em>codec</em></span>
      </div>
      <div class="header-meta">AES-GCM 256 · PBKDF2 · client-side</div>
    </header>
  `
}

// ── Password bar ─────────────────────────────────────────────────────────────

function renderPasswordBar(state: AppState): string {
  const strength = passwordStrength(state.password)
  const bars = Array.from({ length: 4 }, (_, i) => {
    const filled = i < strength
    const color  = filled ? STRENGTH_COLORS[strength] : 'var(--c-border)'
    return `<span class="str-bar" style="background:${color}"></span>`
  }).join('')

  return `
    <section class="pw-bar card">
      <div class="pw-row">
        <div class="pw-field-wrap">
          <label class="field-label" for="password">Пароль</label>
          <div class="pw-input-wrap">
            <input
              class="input pw-input"
              id="password"
              type="${state.showPassword ? 'text' : 'password'}"
              value="${escHtml(state.password)}"
              placeholder="Введите пароль для шифрования…"
              autocomplete="off"
              spellcheck="false"
              data-action="password"
            >
            <button class="icon-btn" data-action="toggle-pw" title="${state.showPassword ? 'Скрыть' : 'Показать'}" aria-label="Показать/скрыть пароль">
              ${state.showPassword ? iconEyeOff() : iconEye()}
            </button>
            <button class="icon-btn" data-action="gen-pw" title="Сгенерировать случайный пароль" aria-label="Генератор пароля">
              ${iconDice()}
            </button>
            ${state.password ? `
              <button class="icon-btn" data-action="copy-pw" title="Скопировать пароль" aria-label="Копировать">
                ${iconCopy()}
              </button>
            ` : ''}
          </div>
          <div class="str-row">
            <div class="str-bars">${bars}</div>
            <span class="str-label" style="color:${STRENGTH_COLORS[strength]}">${STRENGTH_LABELS[strength]}</span>
          </div>
        </div>
      </div>
    </section>
  `
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function renderTabs(state: AppState): string {
  const pendingCount = state.files.filter(f => f.status === 'pending').length
  return `
    <nav class="tabs">
      <button class="tab-btn ${state.activeTab === 'files' ? 'active' : ''}" data-action="tab-files">
        Файлы
        ${state.files.length ? `<span class="badge">${state.files.length}</span>` : ''}
      </button>
      <button class="tab-btn ${state.activeTab === 'history' ? 'active' : ''}" data-action="tab-history">
        История
        ${state.history.length ? `<span class="badge">${state.history.length}</span>` : ''}
      </button>
      ${pendingCount > 0 && state.activeTab === 'files' ? `
        <button class="run-btn" data-action="run-all">
          ${iconPlay()} Запустить ${pendingCount > 1 ? `все (${pendingCount})` : ''}
        </button>
      ` : ''}
    </nav>
  `
}

// ── Files tab ────────────────────────────────────────────────────────────────

function renderFilesTab(state: AppState): string {
  const hasDone = state.files.some(f => f.status === 'done' || f.status === 'error')
  return `
    <section class="files-tab">
      ${renderDropZone()}
      ${state.files.length ? `
        <div class="file-list">
          ${state.files.map(renderFileCard).join('')}
        </div>
        ${hasDone ? `<button class="text-btn clear-btn" data-action="clear-done">Очистить завершённые</button>` : ''}
      ` : ''}
    </section>
  `
}

function renderDropZone(): string {
  return `
    <div class="drop-zone" id="drop-zone" role="button" tabindex="0" aria-label="Область перетаскивания файлов">
      <input type="file" id="file-input" multiple hidden>
      <div class="drop-icon">${iconUpload()}</div>
      <p class="drop-title">Перетащите файлы сюда</p>
      <p class="drop-sub">или <button class="link-btn" data-action="pick-files">выберите файлы</button> · любой формат · автоопределение режима</p>
    </div>
  `
}

function renderFileCard(entry: FileEntry): string {
  const modeLabel  = entry.mode === 'encrypt' ? 'шифровать' : 'дешифровать'
  const modeClass  = entry.mode === 'encrypt' ? 'badge-enc' : 'badge-dec'
  const statusIcon = {
    pending:    iconClock(),
    processing: `<span class="spin">${iconLoader()}</span>`,
    done:       iconCheck(),
    error:      iconX(),
  }[entry.status]

  return `
    <article class="file-card status-${entry.status}" data-id="${entry.id}">
      <div class="file-card-top">
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

      ${entry.status === 'done' ? `
        <div class="file-card-result">
          <div class="hash-row">
            <span class="hash-label">SHA-256 (вход)</span>
            <code class="hash-val">${entry.sha256Input ?? '—'}</code>
          </div>
          <div class="hash-row">
            <span class="hash-label">SHA-256 (выход)</span>
            <code class="hash-val">${entry.sha256Output ?? '—'}</code>
          </div>
          <div class="output-name">→ ${escHtml(entry.outputName)}</div>
          ${renderPreview(entry)}
        </div>
      ` : ''}

      ${entry.status === 'error' ? `
        <div class="error-msg">${iconX()} ${escHtml(entry.errorMsg ?? 'Ошибка')}</div>
      ` : ''}
    </article>
  `
}

function renderPreview(entry: FileEntry): string {
  if (entry.previewType === 'image' && entry.previewUrl) {
    return `
      <details class="preview-details">
        <summary>Предпросмотр</summary>
        <img class="preview-img" src="${entry.previewUrl}" alt="preview">
      </details>
    `
  }
  if (entry.previewType === 'text' && entry.previewText) {
    return `
      <details class="preview-details">
        <summary>Предпросмотр текста</summary>
        <pre class="preview-text">${escHtml(entry.previewText)}</pre>
      </details>
    `
  }
  return ''
}

// ── History tab ───────────────────────────────────────────────────────────────

function renderHistoryTab(state: AppState): string {
  if (!state.history.length) {
    return `
      <section class="history-tab">
        <div class="empty-state">${iconClock()} История пуста</div>
      </section>
    `
  }
  return `
    <section class="history-tab">
      <div class="history-header">
        <span>${state.history.length} операций</span>
        <button class="text-btn" data-action="clear-history">Очистить</button>
      </div>
      <div class="history-list">
        ${state.history.map(renderHistoryRow).join('')}
      </div>
    </section>
  `
}

function renderHistoryRow(entry: HistoryEntry): string {
  const modeLabel = entry.mode === 'encrypt' ? 'зашифровано' : 'дешифровано'
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

// ── Event wiring ──────────────────────────────────────────────────────────────

function wireEvents(_state: AppState): void {
  document.addEventListener('click', handleClick, { once: true })
  document.addEventListener('change', handleChange, { once: true })

  const pwInput = document.getElementById('password') as HTMLInputElement | null
  pwInput?.addEventListener('input', () => store.setPassword(pwInput.value), { once: true })
}

async function handleClick(e: Event): Promise<void> {
  const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
  if (!target) return

  const action = target.dataset['action']!
  const id     = target.dataset['id']

  switch (action) {
    case 'toggle-pw': store.toggleShowPassword(); break
    case 'gen-pw':    store.setPassword(generatePassword()); break
    case 'copy-pw':   await navigator.clipboard.writeText(store.state.password); break
    case 'pick-files': document.getElementById('file-input')?.click(); break
    case 'tab-files':   store.setTab('files'); break
    case 'tab-history': store.setTab('history'); break
    case 'run-all':
      if (!store.state.password) { alert('Введите пароль'); return }
      await processAll(store.state.password)
      break
    case 'remove-file': if (id) store.removeFile(id); break
    case 'clear-done':  store.clearDone(); break
    case 'clear-history': store.clearHistory(); break
  }
}

function handleChange(e: Event): void {
  const target = e.target as HTMLInputElement
  if (target.id === 'file-input' && target.files) {
    store.addFiles(Array.from(target.files))
    target.value = ''
  }
}

// ── Drop zone wiring (persistent) ────────────────────────────────────────────

function wireDrop(): void {
  document.addEventListener('dragover', e => {
    e.preventDefault()
    document.getElementById('drop-zone')?.classList.add('drag-over')
  })
  document.addEventListener('dragleave', e => {
    if ((e as DragEvent).relatedTarget === null) {
      document.getElementById('drop-zone')?.classList.remove('drag-over')
    }
  })
  document.addEventListener('drop', e => {
    e.preventDefault()
    document.getElementById('drop-zone')?.classList.remove('drag-over')
    const files = Array.from((e as DragEvent).dataTransfer?.files ?? [])
    if (files.length) store.addFiles(files)
  })
}

// ── Escape HTML ───────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!))
}

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

const svg = (d: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

const iconEye     = () => svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')
const iconEyeOff  = () => svg('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>')
const iconDice    = () => svg('<rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/>')
const iconCopy    = () => svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')
const iconUpload  = (s=32) => svg('<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>', s)
const iconPlay    = () => svg('<polygon points="5 3 19 12 5 21 5 3"/>')
const iconFile    = () => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>')
const iconClock   = () => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>')
const iconLoader  = () => svg('<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>')
const iconCheck   = () => svg('<polyline points="20 6 9 17 4 12"/>')
const iconX       = () => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')
const iconTrash   = () => svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>')
