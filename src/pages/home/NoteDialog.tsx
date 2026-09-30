import { useEffect, useRef, useState } from 'react'
import { Anime } from '@/history/types'
import { sourceOf } from '@/history/source'
import { useAppDispatch } from '../redux/hooks'
import { noteSet } from '../redux/animeHistorySlice'
// 沿用設定 dialog 的樣式變數與按鈕，維持同一套設計語言
import '../settings/SettingsDialog.css'
import './NoteDialog.css'

interface NoteDialogProps {
  // 紀錄所屬的 bucket：動畫瘋是使用者 id，anime1 是不綁使用者的 SHARED_BUCKET
  bucket: string
  anime: Anime
  onClosed: () => void
}

export const NoteDialog = ({ bucket, anime, onClosed }: NoteDialogProps): JSX.Element => {
  const dispatch = useAppDispatch()
  const ref = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState(anime.note ?? '')

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    dialog.addEventListener('close', onClosed)
    dialog.showModal()
    return () => dialog.removeEventListener('close', onClosed)
  }, [])

  const close = (): void => { ref.current?.close() }

  const save = (): void => {
    dispatch(noteSet({ userId: bucket, animeTitle: anime.title, source: sourceOf(anime), note: note.trim() }))
    close()
  }

  return (
    <dialog
      ref={ref}
      className='agh-dialog agh-note-dialog'
      aria-label={`${anime.title} 的備註`}
      // 點背景（dialog 本身）關閉
      onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}
    >
      <div className='agh-note-layout'>
        <header className='agh-header'>
          <h3 className='agh-title'>{anime.title}</h3>
          <button type='button' className='agh-close' aria-label='關閉' onClick={close}>✕</button>
        </header>
        <div className='agh-page'>
          <textarea
            className='agh-note-input'
            rows={6}
            autoFocus
            value={note}
            aria-label='備註'
            placeholder='寫下這部動畫的心得…'
            onChange={(event) => setNote(event.target.value)}
            // Ctrl / ⌘ + Enter 直接儲存
            onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) save() }}
          />
          <p className='agh-hint'>備註會和觀看紀錄一起同步到其他電腦；清空內容就是刪除備註。</p>
        </div>
        <div className='agh-actions agh-actions-end'>
          <button type='button' className='agh-button' onClick={close}>取消</button>
          <button type='button' className='agh-button is-primary' onClick={save}>儲存</button>
        </div>
      </div>
    </dialog>
  )
}
