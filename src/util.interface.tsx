export interface GlobalVar {
  animeHistory: AnimeHistory
}
export interface AnimeHistory {
  [userId: string]: Anime[]
}
export interface Anime {
  id: string
  timestamp: number
  title: string
  episodePicUrl: string
  animePicUrl: string
  episode: string
}
