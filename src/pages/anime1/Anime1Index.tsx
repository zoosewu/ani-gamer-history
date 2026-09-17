import { Anime, SHARED_BUCKET } from '@/history/types'
import { isRemoved } from '@/history/merge'
import { sourceOf } from '@/history/source'
import { describeProgress, formatPlaybackTime } from '@/history/time'
import { observeOnMutation } from '@/util'
import { filter } from 'rxjs'
import { store } from '../redux/store'
import { recordWatch } from '../redux/animeHistorySlice'
import { Anime1Info, matchesRecord, parseSeriesIdFromHref, readAnime1Info, toAnimeRecord } from './parse'
import '@/pages/marker.css'
import './Anime1Index.css'

// 腳本插入的元素都帶這個屬性：方便整批移除，也用來忽略自己造成的 DOM 變動
const OWN = 'data-agh'
const SIGNATURE = 'data-agh-bookmark'

export default (): void => {
  trackPlayback()
  render()
  store.subscribe(render)
  // 首頁列表由 DataTables 載入，換頁、搜尋時會重畫表格
  const tbody = document.querySelector('#table-list tbody')
  if (tbody !== null) {
    observeOnMutation({ childList: true, subtree: true })(tbody)
      .pipe(filter((mutations) => !mutations.every(isOwnMutation)))
      .subscribe(() => renderList(anime1Records()))
  }
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

const isOwnMutation = (mutation: MutationRecord): boolean =>
  [...mutation.addedNodes, ...mutation.removedNodes].every((node) => node instanceof Element && node.hasAttribute(OWN))

const anime1Records = (): Anime[] => (store.getState().animeHistory[SHARED_BUCKET] ?? [])
  .filter((anime) => sourceOf(anime) === 'anime1' && !isRemoved(anime))

const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  element.className = className
  element.setAttribute(OWN, '')
  element.textContent = text
  return element
}

const createBookmark = (record: Anime): HTMLSpanElement => {
  const bookmark = create('span', 'agh-bookmark')
  bookmark.title = `本機紀錄・第 ${record.episode} 集・看到 ${describeProgress(record)}`
  return bookmark
}

// 內容沒變就不動 DOM：播放中每秒都會觸發一次
const unchanged = (element: Element, signature: string): boolean => {
  if ((element.getAttribute(SIGNATURE) ?? '') === signature) return true
  element.setAttribute(SIGNATURE, signature)
  return false
}

const render = (): void => {
  const records = anime1Records()
  renderArticles(records)
  renderResume(records)
  renderList(records)
}

// 系列頁、文章頁：書籤掛在標題列最右側，日期旁補上看到的時間
const renderArticles = (records: Anime[]): void => {
  document.querySelectorAll('article').forEach((article) => {
    const header = article.querySelector('.entry-header')
    if (header === null) return
    const info = readAnime1Info(article)
    const record = info === undefined ? undefined : records.find((item) => matchesRecord(item, info))
    if (unchanged(header, record === undefined ? '' : `${record.episode}|${describeProgress(record)}`)) return

    header.querySelectorAll(`.agh-bookmark[${OWN}], .agh-bookmark-meta[${OWN}]`).forEach((node) => node.remove())
    header.classList.toggle('agh-bookmarked', record !== undefined)
    if (record === undefined) return
    header.append(createBookmark(record))
    ;(header.querySelector('.entry-meta') ?? header).append(create('span', 'agh-bookmark-meta', `上次看到 ${describeProgress(record)}`))
  })
}

const isSameSeries = (record: Anime, info: Anime1Info): boolean =>
  (record.seriesId ?? '') === '' ? record.title === info.title : record.seriesId === info.seriesId

// 單集文章頁：打開的是同一部的其他集時，提供回到上次那一集的連結
const renderResume = (records: Anime[]): void => {
  if (!document.body.classList.contains('single-post')) return
  const article = document.querySelector('article')
  const header = article?.querySelector('.entry-header')
  const info = article == null ? undefined : readAnime1Info(article)
  if (header == null || info === undefined) return
  const record = records.find((item) => isSameSeries(item, info) && !matchesRecord(item, info))
  const signature = record === undefined ? '' : `${record.id}|${record.episode}|${formatPlaybackTime(record.videoWatchTime)}`
  // 狀態記在連結自己身上，不和標題列的書籤共用
  const existing = header.querySelector(`a.agh-resume[${OWN}]`)
  if ((existing?.getAttribute(SIGNATURE) ?? '') === signature) return

  existing?.remove()
  if (record === undefined) return
  const link = create('a', 'agh-resume')
  link.href = `https://anime1.me/${record.id}`
  link.setAttribute(SIGNATURE, signature)
  link.append(create('span', 'agh-bookmark'), document.createTextNode(`上次看到第 ${record.episode} 集・${formatPlaybackTime(record.videoWatchTime)} →`))
  header.append(link)
}

// 首頁動畫列表：書籤掛在該列上緣，名稱後面接看到的集數
const renderList = (records: Anime[]): void => {
  document.querySelectorAll('#table-list tbody tr').forEach((row) => {
    const cell = row.querySelector('td')
    if (cell === null) return
    const href = cell.querySelector('a')?.getAttribute('href') ?? ''
    const seriesId = parseSeriesIdFromHref(href)
    const record = seriesId === '' ? undefined : records.find((item) => item.seriesId === seriesId)
    if (unchanged(cell, record === undefined ? '' : `${record.episode}|${describeProgress(record)}`)) return

    cell.querySelectorAll(`[${OWN}]`).forEach((node) => node.remove())
    cell.classList.toggle('agh-list-bookmarked', record !== undefined)
    if (record === undefined) return
    cell.prepend(createBookmark(record))
    cell.append(create('span', 'agh-list-note', `看到第 ${record.episode} 集`))
  })
}
