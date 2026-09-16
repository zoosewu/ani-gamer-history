import { createSlice, current } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { Anime, AnimeHistory, AnimeSource } from '@/history/types'
import { mergeHistory as merge, normalizeAnime } from '@/history/merge'
import { sourceOf } from '@/history/source'
import { readLocalHistory } from '@/history/localStore'

export interface RecordWatchPayload {
  userId: string
  anime: Anime
  // 開始觀看或換集時為 true；播放中每秒更新進度時為 false
  isStart: boolean
}

interface AnimeTitlePayload {
  userId: string
  animeTitle: string
  // 同名但不同來源是兩筆獨立的紀錄
  source: AnimeSource
}

type TimedPayload = AnimeTitlePayload & { time: number }

const withTime = (payload: AnimeTitlePayload): { payload: TimedPayload } => ({ payload: { ...payload, time: Date.now() } })

const updateAnime = (state: AnimeHistory, { userId, animeTitle, source }: AnimeTitlePayload, update: (anime: Anime) => Anime): void => {
  const list = state[userId] ?? []
  const index = list.findIndex((anime) => anime.title === animeTitle && sourceOf(anime) === source)
  if (index === -1) return
  list[index] = normalizeAnime(update(list[index]))
}

const initialState: AnimeHistory = readLocalHistory()

export const animeHistorySlice = createSlice({
  name: 'animeHistory',
  initialState,
  reducers: {
    // 更新觀看進度時保留最愛與刪除狀態
    recordWatch: (state, action: PayloadAction<RecordWatchPayload>) => {
      const { userId, anime } = action.payload
      if (anime.title === '') return
      const list = state[userId] ?? []
      const source = sourceOf(anime)
      const isSame = (item: Anime): boolean => item.title === anime.title && sourceOf(item) === source
      const existing = list.find(isSame)
      const record = normalizeAnime({
        ...anime,
        isFavorite: existing?.isFavorite,
        favoriteTime: existing?.favoriteTime,
        removeTime: existing?.removeTime
      })
      state[userId] = [record, ...list.filter((item) => !isSame(item))]
    },
    // 標記 removeTime，而不是真的刪除，讓同步時能傳遞刪除
    removeAnime: {
      reducer: (state, action: PayloadAction<TimedPayload>) => {
        updateAnime(state, action.payload, (anime) => ({ ...anime, removeTime: action.payload.time }))
      },
      prepare: withTime
    },
    toggleFavorite: {
      reducer: (state, action: PayloadAction<TimedPayload>) => {
        updateAnime(state, action.payload, (anime) => ({ ...anime, isFavorite: !(anime.isFavorite ?? false), favoriteTime: action.payload.time }))
      },
      prepare: withTime
    },
    // 合併其他分頁、雲端或匯入的資料；內容沒變時維持原本的 state
    mergeHistory: (state, action: PayloadAction<AnimeHistory>) => {
      const base = current(state)
      const merged = merge(base, action.payload)
      if (JSON.stringify(merged) === JSON.stringify(base)) return
      return merged
    }
  }
})

export const { recordWatch, removeAnime, toggleFavorite, mergeHistory } = animeHistorySlice.actions

export default animeHistorySlice.reducer
