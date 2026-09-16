import { Anime, AnimeSource } from './types'

export const DEFAULT_SOURCE: AnimeSource = 'ani-gamer'

export const sourceOf = (anime: Anime): AnimeSource => anime.source ?? DEFAULT_SOURCE

export const SOURCE_LABEL: Record<AnimeSource, string> = {
  'ani-gamer': '動畫瘋',
  anime1: 'anime1'
}

export const animeUrl = (anime: Anime): string =>
  sourceOf(anime) === 'anime1' ? `https://anime1.me/${anime.id}` : `animeVideo.php?sn=${anime.id}`

// 同名但不同來源視為兩筆完全獨立的紀錄
export const animeKey = (anime: Anime): string => JSON.stringify([sourceOf(anime), anime.title])
