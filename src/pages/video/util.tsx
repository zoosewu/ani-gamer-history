import { GM_setValue } from '$'
import { Anime } from '@/util.interface'
import { globalVar, log } from '@/util'
export const updateAnimeHistory = (userId: string, { id, time, title, episodePicUrl, animePicUrl, episode }: Anime): void => {
  const histories = globalVar.animeHistory?.[userId]?.filter((anime) => anime.title !== title) ?? []

  const newHistories = [{ id, time, title, episodePicUrl, animePicUrl, episode }, ...histories]

  globalVar.animeHistory = { ...globalVar.animeHistory, [userId]: newHistories }
  GM_setValue('animeHistory', JSON.stringify(globalVar.animeHistory))

  log('Updated History', { id, time, title, animePicUrl, episode }, globalVar.animeHistory)
}
