import { GM_addValueChangeListener, GM_getValue, GM_setValue } from '$'
import { AnimeHistory } from './types'
import { normalizeHistory } from './merge'

const KEY = 'animeHistory'

const parse = (raw: unknown): AnimeHistory => {
  if (typeof raw !== 'string') return {}
  try {
    return normalizeHistory(JSON.parse(raw))
  } catch (error) {
    console.error('Failed to parse local animeHistory', error)
    return {}
  }
}

export const readLocalHistory = (): AnimeHistory => parse(GM_getValue(KEY, '{}'))

export const writeLocalHistory = (raw: string): void => GM_setValue(KEY, raw)

// 只通知其他分頁造成的變更
export const onRemoteHistoryChange = (listener: (history: AnimeHistory, raw: string) => void): void => {
  GM_addValueChangeListener(KEY, (_key, _oldValue, newValue, remote) => {
    if (remote === true && typeof newValue === 'string') listener(parse(newValue), newValue)
  })
}
