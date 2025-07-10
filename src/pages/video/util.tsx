import { GM_setValue } from '$'
import { Anime } from '@/util.interface'
import { globalVar } from '@/util'
export const updateAnimeHistory = (userId: string, { ...newAnimeData }: Anime): void => {
  const histories = globalVar.animeHistory?.[userId]?.filter((anime) => anime.title !== newAnimeData.title) ?? []

  const newHistories = [{ ...newAnimeData }, ...histories]

  globalVar.animeHistory = { ...globalVar.animeHistory, [userId]: newHistories }
  
  console.log('Updated History', { ...newAnimeData }, globalVar.animeHistory)
  GM_setValue('animeHistory', JSON.stringify(globalVar.animeHistory))
}