import { useEffect, useRef, useState } from 'react'
import { AdapterSettings, importAdapterSettings, TestResult } from '@/sync/adapter'
import { readClipboard } from '@/sync/clipboard'
import { cloudAdapters, findCloudAdapter } from '@/sync/cloudAdapters'
import { decodeSettingsTransfer } from '@/sync/settingsTransfer'
import { copyAdapterSettings, errorMessage, exportJson, importJson, requestCloudSync } from '@/sync/syncService'
import { store } from '../redux/store'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { adapterSettingsSaved, autoSyncSet, syncDisconnected } from '../redux/syncSlice'
import { describeSyncStatus } from './format'
import './SettingsDialog.css'

export type SettingsPage = 'status' | 'cloud' | 'backup'

const PAGES: Array<{ id: SettingsPage, label: string }> = [
  { id: 'status', label: '同步狀態' },
  { id: 'cloud', label: '雲端平台' },
  { id: 'backup', label: '備份' }
]

type Result = TestResult | null

const useTask = (): { busy: boolean, result: Result, setResult: (result: Result) => void, run: (task: () => Promise<Result>) => Promise<void> } => {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const run = async (task: () => Promise<Result>): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      setResult(await task())
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }
  return { busy, result, setResult, run }
}

const Message = ({ result }: { result: Result }): JSX.Element | null => {
  if (result === null) return null
  return <p className={`agh-message ${result.ok ? 'is-ok' : 'is-error'}`} role='status'>{result.message}</p>
}

const StatusPage = ({ onNavigate }: { onNavigate: (page: SettingsPage) => void }): JSX.Element => {
  const dispatch = useAppDispatch()
  const sync = useAppSelector((state) => state.sync)
  const { settings, status, syncing } = sync
  const definition = findCloudAdapter(settings.adapterId)
  return (
    <div className='agh-page'>
      <dl className='agh-summary'>
        <dt>雲端平台</dt>
        <dd>
          {definition?.label ?? '尚未設定'}
          {definition === undefined && <button type='button' className='agh-link' onClick={() => onNavigate('cloud')}>前往設定</button>}
        </dd>
        <dt>自動同步</dt>
        <dd>{settings.autoSync ? '開啟' : '已暫停'}</dd>
        <dt>同步狀態</dt>
        <dd>{describeSyncStatus(sync)}</dd>
      </dl>
      {!syncing && status.message !== '' && <Message result={{ ok: status.ok === true, message: status.message }} />}
      <p className='agh-hint'>開啟首頁時會從雲端取得紀錄；開始看動畫、刪除或切換最愛後會自動上傳。</p>
      <div className='agh-actions'>
        <button type='button' className='agh-button is-primary' disabled={syncing || definition === undefined} onClick={() => { void requestCloudSync('manual') }}>
          {syncing ? '同步中…' : '立即同步'}
        </button>
        <button type='button' className='agh-button' onClick={() => { dispatch(autoSyncSet(!settings.autoSync)) }}>
          {settings.autoSync ? '暫停自動同步' : '恢復自動同步'}
        </button>
      </div>
    </div>
  )
}

const CloudPage = (): JSX.Element => {
  const dispatch = useAppDispatch()
  const saved = useAppSelector((state) => state.sync.settings)
  const [adapterId, setAdapterId] = useState(findCloudAdapter(saved.adapterId)?.id ?? cloudAdapters[0].id)
  const definition = findCloudAdapter(adapterId) ?? cloudAdapters[0]
  const [values, setValues] = useState<AdapterSettings>(saved.adapters[definition.id] ?? {})
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const { busy, result, setResult, run } = useTask()
  const connected = saved.adapterId === definition.id
  const trimmed: AdapterSettings = Object.fromEntries(definition.fields.map((field) => [field.key, (values[field.key] ?? '').trim()]))
  const incomplete = definition.fields.some((field) => field.required && trimmed[field.key] === '')

  const selectAdapter = (id: string): void => {
    setAdapterId(id)
    setValues(saved.adapters[id] ?? {})
    setResult(null)
  }

  const save = async (): Promise<Result> => {
    dispatch(adapterSettingsSaved({ adapterId: definition.id, settings: trimmed }))
    await requestCloudSync('manual')
    const { ok, message } = store.getState().sync.status
    return ok === true
      ? { ok: true, message: `已儲存並完成同步：${message}` }
      : { ok: false, message: `已儲存，但同步失敗：${message}` }
  }

  const disconnect = (): void => {
    if (!window.confirm('確定要中斷雲端同步嗎？\n會清除這個平台的設定與 Token；本機紀錄和雲端檔案都會保留。')) return
    dispatch(syncDisconnected())
    setValues({})
    setResult({ ok: true, message: '已中斷雲端同步' })
  }

  // 設定字串含有 Token，加密只是避免不小心貼到別處時被一眼看懂
  const copy = async (): Promise<Result> => {
    await copyAdapterSettings(definition, trimmed)
    return { ok: true, message: '已複製設定到剪貼簿，可在另一台電腦的這個畫面貼上。內容含有 Token，請勿公開張貼。' }
  }

  const applyTransfer = async (text: string): Promise<Result> => {
    const transfer = await decodeSettingsTransfer(text)
    const target = findCloudAdapter(transfer.adapterId)
    if (target === undefined) return { ok: false, message: `這個腳本沒有「${transfer.adapterId}」這個平台，請先更新腳本` }
    setAdapterId(target.id)
    setValues(importAdapterSettings(target, transfer.settings))
    setPasteText('')
    setPasting(false)
    return { ok: true, message: '已讀入設定，確認內容後按「儲存並同步」' }
  }

  const paste = async (): Promise<Result> => {
    const text = await readClipboard()
    if (text === null) {
      setPasting(true)
      return { ok: true, message: '瀏覽器不允許直接讀取剪貼簿，請在下方欄位貼上設定字串' }
    }
    return await applyTransfer(text)
  }

  return (
    <form className='agh-page' onSubmit={(event) => { event.preventDefault(); void run(save) }}>
      <label className='agh-field'>
        <span className='agh-field-label'>同步平台</span>
        <select className='agh-input' value={definition.id} onChange={(event) => selectAdapter(event.target.value)}>
          {cloudAdapters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <details className='agh-steps' open={!connected}>
        <summary>設定步驟</summary>
        <ol>
          {definition.instructions.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </details>
      {definition.fields.map((field) => (
        <label key={field.key} className='agh-field'>
          <span className='agh-field-label'>
            {field.label}
            {field.required && <em className='agh-required'>*</em>}
          </span>
          <input
            className='agh-input'
            type={field.type}
            value={values[field.key] ?? ''}
            placeholder={field.placeholder}
            autoComplete='off'
            spellCheck={false}
            onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
          />
          {field.help !== undefined && <small className='agh-hint'>{field.help}</small>}
        </label>
      ))}
      {pasting && (
        <div className='agh-field'>
          <span className='agh-field-label'>貼上設定字串</span>
          <textarea
            className='agh-input agh-textarea'
            rows={3}
            value={pasteText}
            placeholder='AGH1.…'
            spellCheck={false}
            onChange={(event) => setPasteText(event.target.value)}
          />
          <div className='agh-actions'>
            <button type='button' className='agh-button is-primary' disabled={busy || pasteText.trim() === ''} onClick={() => { void run(async () => await applyTransfer(pasteText)) }}>
              讀入
            </button>
            <button type='button' className='agh-button' onClick={() => { setPasting(false); setPasteText('') }}>取消</button>
          </div>
        </div>
      )}
      <Message result={result} />
      <div className='agh-actions'>
        <button type='button' className='agh-button' disabled={busy || incomplete} onClick={() => { void run(async () => await definition.test(trimmed)) }}>
          測試連線
        </button>
        <button type='submit' className='agh-button is-primary' disabled={busy || incomplete}>
          {busy ? '處理中…' : '儲存並同步'}
        </button>
        {connected && <button type='button' className='agh-button is-danger' disabled={busy} onClick={disconnect}>中斷同步</button>}
      </div>
      <div className='agh-actions'>
        <button type='button' className='agh-button' disabled={busy || incomplete} onClick={() => { void run(copy) }}>複製設定</button>
        <button type='button' className='agh-button' disabled={busy} onClick={() => { void run(paste) }}>貼上設定</button>
      </div>
    </form>
  )
}

const BackupPage = (): JSX.Element => {
  // 不鎖定按鈕：部分瀏覽器取消選檔時不會通知
  const { result, run } = useTask()
  const exportFile = async (): Promise<Result> => {
    await exportJson()
    return { ok: true, message: '已下載 JSON 檔案' }
  }
  const importFile = async (): Promise<Result> =>
    (await importJson()) ? { ok: true, message: '已匯入並與本機紀錄合併' } : null

  return (
    <div className='agh-page'>
      <section className='agh-section'>
        <h4 className='agh-section-title'>匯出</h4>
        <p className='agh-hint'>下載本機所有觀看紀錄的 JSON 檔案，不包含同步設定與 Token。</p>
        <button type='button' className='agh-button' onClick={() => { void run(exportFile) }}>匯出 JSON</button>
      </section>
      <section className='agh-section'>
        <h4 className='agh-section-title'>匯入</h4>
        <p className='agh-hint'>選擇先前匯出的 JSON 檔案，與本機紀錄合併，不會覆蓋或刪除現有紀錄。</p>
        <button type='button' className='agh-button' onClick={() => { void run(importFile) }}>匯入 JSON</button>
      </section>
      <Message result={result} />
    </div>
  )
}

interface SettingsDialogProps {
  initialPage: SettingsPage
  onClosed: () => void
}

export const SettingsDialog = ({ initialPage, onClosed }: SettingsDialogProps): JSX.Element => {
  const ref = useRef<HTMLDialogElement>(null)
  const [page, setPage] = useState(initialPage)
  const current = PAGES.find((item) => item.id === page) ?? PAGES[0]

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    dialog.addEventListener('close', onClosed)
    dialog.showModal()
    return () => dialog.removeEventListener('close', onClosed)
  }, [])

  const close = (): void => { ref.current?.close() }

  return (
    <dialog
      ref={ref}
      className='agh-dialog'
      aria-label='同步設定'
      // 點背景（dialog 本身）關閉
      onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}
    >
      <div className='agh-layout'>
        <nav className='agh-nav'>
          <div className='agh-nav-title'>Ani Gamer History</div>
          {PAGES.map((item) => (
            <button
              key={item.id}
              type='button'
              className={`agh-nav-item${item.id === page ? ' is-active' : ''}`}
              aria-current={item.id === page ? 'page' : undefined}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <section className='agh-content'>
          <header className='agh-header'>
            <h3 className='agh-title'>{current.label}</h3>
            <button type='button' className='agh-close' aria-label='關閉' onClick={close}>✕</button>
          </header>
          {page === 'status' && <StatusPage onNavigate={setPage} />}
          {page === 'cloud' && <CloudPage />}
          {page === 'backup' && <BackupPage />}
        </section>
      </div>
    </dialog>
  )
}
