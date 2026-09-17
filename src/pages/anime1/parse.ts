import { Anime } from '@/history/types'

export interface Anime1Info {
  seriesId: string
  episode: string
  title: string
  postId: string
}

// data-apireq 是 URL-encoded 的 JSON，內容像 {"c":"1898","e":"24"}：c 是系列 id、e 是集數
export const parseApiReq = (value: string | null | undefined): { seriesId: string, episode: string } | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  let payload: unknown
  try {
    payload = JSON.parse(decodeURIComponent(value))
  } catch {
    return undefined
  }
  if (typeof payload !== 'object' || payload === null) return undefined
  const { c, e } = payload as { c?: unknown, e?: unknown }
  const seriesId = typeof c === 'string' || typeof c === 'number' ? String(c) : ''
  if (seriesId === '') return undefined
  return { seriesId, episode: typeof e === 'string' || typeof e === 'number' ? String(e) : '' }
}

// <article id="post-30152">
export const parsePostId = (articleId: string): string => /^post-(\d+)$/.exec(articleId.trim())?.[1] ?? ''

// 文章標題是「系列名 [24]」，分類連結才是乾淨的系列名，取不到時退回去掉結尾的中括號
export const stripEpisodeSuffix = (title: string): string => title.replace(/\s*\[[^[\]]*\]\s*$/, '').trim()

export const readAnime1Info = (article: Element): Anime1Info | undefined => {
  const episode = parseApiReq(article.querySelector('video')?.getAttribute('data-apireq'))
  if (episode === undefined) return undefined
  const category = article.querySelector('a[rel="category tag"]')?.textContent?.trim() ?? ''
  const heading = article.querySelector('.entry-title')?.textContent ?? ''
  const title = category !== '' ? category : stripEpisodeSuffix(heading)
  if (title === '') return undefined
  return { ...episode, title, postId: parsePostId(article.id) }
}

export const toAnimeRecord = (info: Anime1Info, video: HTMLVideoElement, now = Date.now()): Anime => ({
  source: 'anime1',
  id: info.postId,
  seriesId: info.seriesId,
  title: info.title,
  timestamp: now,
  episode: info.episode,
  // anime1 沒有封面圖，首頁卡片改用文字佔位
  episodePicUrl: '',
  animePicUrl: '',
  videoWatchTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
  videoTotalTime: Number.isFinite(video.duration) ? video.duration : 0
})

// 有系列 id 就比系列 id，沒有才退回比標題；集數要一樣
export const matchesRecord = (record: Anime, info: Anime1Info): boolean => {
  if (record.episode !== info.episode) return false
  const seriesId = record.seriesId ?? ''
  return seriesId === '' ? record.title === info.title : seriesId === info.seriesId
}
