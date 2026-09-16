import { SHARED_BUCKET } from '@/history/types'
import { isRemoved } from '@/history/merge'
import { sourceOf } from '@/history/source'
import { store } from '../redux/store'
import { recordWatch } from '../redux/animeHistorySlice'
import { matchesRecord, readAnime1Info, toAnimeRecord } from './parse'
import '@/pages/marker.css'
import './Anime1Index.css'

const MARK_CLASS = 'agh-mark'
const MARKED_CLASS = 'agh-marked'

export default (): void => {
  trackPlayback()
  renderMarks()
  store.subscribe(renderMarks)
}

// 文章頁與列表頁都可以直接播放，所以固定去找目前正在播放的那個播放器
const trackPlayback = (): void => {
  let playingKey = ''
  setInterval(() => {
    const video = [...document.querySelectorAll('video')].find((item) => !item.paused)
    const article = video?.closest('article')
    const info = article == null ? undefined : readAnime1Info(article)
    if (video === undefined || info === undefined) return
    const key = `${info.seriesId}/${info.episode}`
    store.dispatch(recordWatch({ userId: SHARED_BUCKET, anime: toAnimeRecord(info, video), isStart: key !== playingKey }))
    playingKey = key
  }, 1000)
}

// 每次 store 變動（含雲端同步拉到新資料）都重新標記
const renderMarks = (): void => {
  const records = (store.getState().animeHistory[SHARED_BUCKET] ?? [])
    .filter((anime) => sourceOf(anime) === 'anime1' && !isRemoved(anime))

  document.querySelectorAll('article').forEach((article) => {
    const info = readAnime1Info(article)
    const record = info === undefined ? undefined : records.find((item) => matchesRecord(item, info))
    const marked = article.classList.contains(MARKED_CLASS)
    if (record === undefined) {
      if (!marked) return
      article.classList.remove(MARKED_CLASS)
      article.querySelector(`.${MARK_CLASS}`)?.remove()
      return
    }
    if (marked) return

    article.classList.add(MARKED_CLASS)
    const mark = document.createElement('span')
    mark.className = MARK_CLASS
    mark.title = `本機紀錄：第 ${record.episode} 集`
    ;(article.querySelector('.entry-header') ?? article).append(mark)
  })
}
