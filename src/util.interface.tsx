export interface Global {
  animeHistory: AnimeHistory
}
export interface AnimeHistory {
  [userId: string]: Anime[]
}
export interface Anime {
  id: string
  time: number
  title: string
  pictureUrl: string
  episode: string
}
