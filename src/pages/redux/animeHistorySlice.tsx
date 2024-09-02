import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { globalVar } from '@/util'
import { AnimeHistory } from '@/util.interface'
const initialState: AnimeHistory = globalVar.animeHistory

export const animeHistorySlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    removeAnime: (state, action: PayloadAction<{ userId: string, animeTitle: string }>) => {
      const { userId, animeTitle } = action.payload
      if (state?.[userId] === null) return
      state[userId] = state?.[userId]?.filter((anime) => anime.title !== animeTitle) ?? []
      console.log('Anime Removed', { userId, animeTitle }, state[userId])
      // GM_setValue('animeHistory', JSON.stringify(state))
    }
  }
})

// Action creators are generated for each case reducer function
export const { removeAnime } = animeHistorySlice.actions

export default animeHistorySlice.reducer
