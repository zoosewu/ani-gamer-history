import React from 'react'
import ReactDOM from 'react-dom/client'
import { filter, map, of, Subscription } from 'rxjs'
import fp from 'lodash/fp'
import { Anime, SHARED_BUCKET } from '@/history/types'
import { isRemoved } from '@/history/merge'
import { animeUrl, SOURCE_LABEL, sourceOf } from '@/history/source'
import { store } from '../redux/store'
import { Provider } from 'react-redux'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { removeAnime, toggleFavorite } from '../redux/animeHistorySlice'
import { openSettings } from '../settings/openSettings'
import { SyncIndicator } from '../settings/SyncIndicator'
import { requestCloudSync } from '@/sync/syncService'
import './HomeIndex.css'

export default (URL: URL): Subscription => of(URL)
  .pipe(
    map(fp.get('pathname')),
    filter(fp.eq('/'))
  )
  .subscribe((pathname) => {
    init(pathname)
  })

interface AnimeCardPayload {
  // 紀錄所屬的 bucket：動畫瘋是使用者 id，anime1 是不綁使用者的 SHARED_BUCKET
  bucket: string
  anime: Anime
}

const AnimeCard = ({ bucket, anime }: AnimeCardPayload): JSX.Element => {
  const dispatch = useAppDispatch()
  const { title, episodePicUrl, animePicUrl, episode, videoWatchTime, videoTotalTime, isFavorite } = anime
  const source = sourceOf(anime)
  const href = animeUrl(anime)
  const hasImage = animePicUrl !== '' || episodePicUrl !== ''
  const leftMinutes = Math.max(Math.floor((videoTotalTime - videoWatchTime) / 60), 0)
  const target = { userId: bucket, animeTitle: title, source }
  return (
    <div className='continue-watch-card' style={{ transition: '1s', paddingBottom: 'unset', height: 'unset', minWidth: '100px' }}>
      <a className='img-block' data-gtm-category='首頁' data-gtm-event='點擊繼續觀看卡片' tabIndex={0}>
        <div style={{ pointerEvents: 'none' }}>
          {hasImage
            ? (
              <>
                <div className='img-bg-blur-bg is-next' style={{ backgroundImage: `url('${episodePicUrl}')`, visibility: 'hidden' }} />
                <div className='img-bg-blur-bg' style={{ backgroundImage: `url('${animePicUrl}')` }} />
                <img className='card-img is-next lazyloaded' style={{ visibility: 'hidden' }} src={episodePicUrl} data-src={episodePicUrl} alt={title} />
                <img className='card-img lazyloaded' src={animePicUrl} data-src={animePicUrl} alt={title} />
              </>
              )
            // anime1 沒有封面圖，改用文字佔位
            : <div className='agh-placeholder'><span>{title}</span></div>}
          {source !== 'ani-gamer' && <span className='agh-source-badge'>{SOURCE_LABEL[source]}</span>}
          <a className='line-gradient' style={{ pointerEvents: 'auto' }} href={href} />
          <i className='btn-delete material-icons-round' data-gtm-category='首頁' data-gtm-event='點擊移除繼續觀看卡片' style={{ pointerEvents: 'auto' }} onClick={() => dispatch(removeAnime(target))}>close</i>
          <div
            className={'btn-card-block btn-favorite btn-not-active' + (isFavorite ?? false ? ' btn-is-active' : '')}
            style={{
              width: '40px',
              height: '40px',
              position: 'absolute',
              top: '-4px',
              right: '32px',
              pointerEvents: 'auto',
              transition: '500ms',
              zIndex: 4
            }}
            onClick={() => dispatch(toggleFavorite(target))}
          />
        </div>
      </a>
      <a className='content-block' href={href} data-gtm-category='首頁' data-gtm-event='點擊繼續觀看卡片' tabIndex={0}>
        <div className='img-progress-block' style={{ pointerEvents: 'none' }}>
          <div className='info-row'>
            <div className='episode-block'>
              <img src='https://i2.bahamut.com.tw/anime/pic-tv.svg' alt='pic-tv' />
              <p className='episode-watched' data-episode={`第 ${episode} 集`}>第 {episode} 集</p>
            </div>
            {videoTotalTime > 0 && (
              <p className='time-left' data-time={`剩餘 ${leftMinutes} 分`}>剩餘 {leftMinutes} 分</p>
            )}
          </div>
          {videoTotalTime > 0 && videoWatchTime > 0 && (
            <div className='progress-bar'>
              <div className='progress' style={{ width: `${(videoWatchTime / videoTotalTime) * 100}%` }} data-progress={`${(videoWatchTime / videoTotalTime) * 100}`} />
            </div>
          )}
        </div>
        <div className='content' style={{ pointerEvents: 'none' }}>
          <p className='anime-name'>
            {title}
          </p>
        </div>
      </a>
    </div>
  )
}

interface MainContainerPayload {
  // 沒有登入時為 null，這時只顯示不綁使用者的紀錄（anime1）
  userId: string | null
}

const MainContainer = ({ userId }: MainContainerPayload): JSX.Element => {
  const animeHistory = useAppSelector((state) => state.animeHistory)
  const buckets = userId === null ? [SHARED_BUCKET] : [userId, SHARED_BUCKET]
  const entries = buckets.flatMap((bucket) => (animeHistory[bucket] ?? []).map((anime) => ({ bucket, anime })))
  const visible = entries.filter(({ anime }) => !isRemoved(anime))
  const byTime = (a: AnimeCardPayload, b: AnimeCardPayload): number => b.anime.timestamp - a.anime.timestamp
  const sorted = [
    ...visible.filter(({ anime }) => anime.isFavorite === true).sort(byTime),
    ...visible.filter(({ anime }) => anime.isFavorite !== true).sort(byTime)
  ]

  const Histories = sorted.map(({ bucket, anime }) => (
    <AnimeCard key={`${bucket}/${sourceOf(anime)}/${anime.title}`} bucket={bucket} anime={anime} />
  ))
  return (
    <div id='watched-anime' className='continue-watch-area ani-gamer-history'>
      <div className='theme-title-block'>
        <div className='watch-more-block'>
          <h1 className='theme-title'>本機歷史紀錄</h1>
          <div className='agh-title-tools'>
            <SyncIndicator />
            <button type='button' className='agh-gear' title='同步設定' aria-label='同步設定' onClick={() => openSettings()}>
              <i className='material-icons-round'>settings</i>
            </button>
          </div>
        </div>
      </div>
      {sorted.length === 0 && <p className='agh-empty'>尚無紀錄</p>}
      <div
        id='continue-watch'
        className='continue-watch-list slick-initialized slick-slider'
      >
        <div aria-live='polite' className='slick-list draggable'>
          <div
            style={{
              opacity: '1',
              width: '100%',
              transform: 'translate3d(0px, 0px, 0px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '16px',
              transition: '1s'
            }}
            role='listbox'
          >{Histories}
          </div>
        </div>
      </div>
    </div>
  )
}

const init = (pathname: string): Subscription => of(pathname).subscribe(() => {
  // 沒有登入也要顯示，因為 anime1 的紀錄不綁使用者
  const userId = document.getElementsByClassName('user-id')[0]?.innerHTML ?? null
  const app = document.getElementById('blockContinueWatch') ?? document.getElementById('blockVideoInSeason')
  const container = document.createElement('div')
  app?.after(container)
  const root = ReactDOM.createRoot(container)
  root.render(
    <Provider store={store}>
      <MainContainer userId={userId} />
    </Provider>
  )
  // 要顯示列表時，先從雲端取得最新紀錄
  void requestCloudSync('display')
})
