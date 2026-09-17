import { Anime, AnimeHistory, AnimeSource, SHARED_BUCKET } from '../types'

// 目前資料格式的完整測試資料。型別會強迫這份資料跟著 Anime 與 AnimeSource 更新：
// 新增欄位或來源時沒有補上，tsc（npm run build）就會失敗；補上之後，同版本號的已發佈版本若會丟掉它，相容性測試就會失敗。

// 每個來源的紀錄放在哪個分區
export const bucketOf: { [S in AnimeSource]: string } = {
  'ani-gamer': 'tester',
  anime1: SHARED_BUCKET
}

// 每個來源一筆所有欄位都填滿、而且都不是預設值的紀錄
export const fullAnime: { [S in AnimeSource]: Required<Anime> & { source: S } } = {
  'ani-gamer': {
    source: 'ani-gamer',
    id: '49874',
    title: '葬送的芙莉蓮',
    timestamp: 1789000000000,
    episode: '12',
    episodePicUrl: 'https://p2.bahamut.com.tw/B/2KU/episode.jpg',
    animePicUrl: 'https://p2.bahamut.com.tw/B/2KU/anime.jpg',
    videoWatchTime: 615.5,
    videoTotalTime: 1420.25,
    seriesId: '112233',
    isFavorite: true,
    favoriteTime: 1788000000000,
    removeTime: 1787000000000
  },
  anime1: {
    source: 'anime1',
    id: '29681',
    title: '暴怒千金發誓復仇。 ～憑藉魔導書之力打垮祖國～',
    timestamp: 1789615380421,
    episode: '5b',
    episodePicUrl: 'https://anime1.me/episode.jpg',
    animePicUrl: 'https://anime1.me/anime.jpg',
    videoWatchTime: 1.203466,
    videoTotalTime: 1425.024,
    seriesId: '1959',
    isFavorite: true,
    favoriteTime: 1789000000001,
    removeTime: 1789000000002
  }
}

const minimal = (anime: Anime): Anime => ({
  source: anime.source,
  id: anime.id,
  title: anime.title,
  timestamp: anime.timestamp,
  episode: anime.episode,
  episodePicUrl: anime.episodePicUrl,
  animePicUrl: anime.animePicUrl,
  videoWatchTime: anime.videoWatchTime,
  videoTotalTime: anime.videoTotalTime
})

export const currentFixture = (): AnimeHistory => {
  const history: AnimeHistory = {}
  const add = (bucket: string, anime: Anime): void => { (history[bucket] ??= []).push(anime) }

  Object.values(fullAnime).forEach((full) => {
    const bucket = bucketOf[full.source]
    add(bucket, full)
    add(bucket, { ...minimal(full), title: `${full.title}（最少欄位）`, timestamp: full.timestamp - 10 })
    add(bucket, { ...minimal(full), title: `${full.title}（已刪除）`, timestamp: full.timestamp - 20, removeTime: full.timestamp })
    add(bucket, { ...minimal(full), title: `${full.title}（取消最愛）`, timestamp: full.timestamp - 30, isFavorite: false, favoriteTime: full.timestamp - 5 })
    // 兩個來源都有的同名紀錄
    add(bucket, { ...minimal(full), title: '同名動畫', timestamp: full.timestamp - 40 })
  })
  add('another-user', { ...fullAnime['ani-gamer'], title: '另一位使用者的紀錄' })
  return history
}
