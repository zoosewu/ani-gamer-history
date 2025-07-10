import { GM_setValue } from '$'
import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { globalVar } from '@/util'
import { AnimeHistory } from '@/util.interface'
const initialState: AnimeHistory = globalVar.animeHistory

export const animeHistorySlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    // 修改 delete 為標記 removeTime
    removeAnime: (state, action: PayloadAction<{ userId: string, animeTitle: string }>) => {
      const { userId, animeTitle } = action.payload
      const animeList = state[userId] ?? []
      const target = animeList.find(anime => anime.title === animeTitle)
      if (target !== undefined) {
        target.removeTime = Date.now()
      }
      console.log('Anime Removed', { userId, animeTitle }, state[userId])
      GM_setValue('animeHistory', JSON.stringify(state))
    },
    // 新增最愛切換功能
    toggleFavorite: (state, action: PayloadAction<{ userId: string, animeTitle: string }>) => {
      const { userId, animeTitle } = action.payload
      const animeList = state[userId] ?? []
      const target = animeList.find(anime => anime.title === animeTitle)
      if (target !== undefined) {
        target.isFavorite = target.isFavorite == null
        console.log('Anime Favorite Toggled', { userId, animeTitle, isFavorite: target.isFavorite }, state[userId])
        GM_setValue('animeHistory', JSON.stringify(state))
      }
    }
  }
})

// Action creators are generated for each case reducer function
export const { removeAnime, toggleFavorite } = animeHistorySlice.actions

export default animeHistorySlice.reducer
