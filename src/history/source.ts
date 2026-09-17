import { Anime, AnimeHistory, AnimeSource } from './types'

export const DEFAULT_SOURCE: AnimeSource = 'ani-gamer'

export const sourceOf = (anime: Anime): AnimeSource => anime.source ?? DEFAULT_SOURCE

export const SOURCE_LABEL: Record<AnimeSource, string> = {
  'ani-gamer': '動畫瘋',
  anime1: 'anime1'
}

export const sourceLabel = (source: string): string => SOURCE_LABEL[source as AnimeSource] ?? source

// 動畫瘋以外、實際已經有紀錄的來源。設定裡的顯示開關只為這些來源出現，未來新增網站也一樣
export const listExtraSources = (history: AnimeHistory): AnimeSource[] => {
  const sources = new Set<AnimeSource>()
  Object.values(history).forEach((list) => list.forEach((anime) => sources.add(sourceOf(anime))))
  sources.delete(DEFAULT_SOURCE)
  return [...sources].sort()
}

export const animeUrl = (anime: Anime): string =>
  sourceOf(anime) === 'anime1' ? `https://anime1.me/${anime.id}` : `animeVideo.php?sn=${anime.id}`

// 同名但不同來源視為兩筆完全獨立的紀錄
export const animeKey = (anime: Anime): string => JSON.stringify([sourceOf(anime), anime.title])
