import React from 'react'
import ReactDOM from 'react-dom/client'
import { filter, map, of, Subscription } from 'rxjs'
import fp from 'lodash/fp'
import { globalVar, isNotNil } from '@/util'
import { Anime } from '@/util.interface'

export default (URL: URL): Subscription => of(URL)
  .pipe(
    filter(fp.F),
    map(fp.get('pathname')),
    filter(fp.eq('/mygather.php'))
  )
  .subscribe((pathname) => {
    init(pathname)
  })

const AnimeCard = ({ id, title, episodePicUrl, animePicUrl, episode, videoWatchTime, videoTotalTime, removeTime, isFavorite }: Anime): JSX.Element => {
  return (
    <div className='continue-watch-card'>
      <a className='img-block' href={`animeVideo.php?sn=${id}`} data-gtm-category='首頁' data-gtm-event='點擊繼續觀看卡片' tabIndex={0}>
        <div style={{ pointerEvents: 'none' }}>
          <div className='img-bg-blur-bg is-next' style={{ backgroundImage: `url('${episodePicUrl}')`, visibility: 'hidden' }} />
          <div className='img-bg-blur-bg' style={{ backgroundImage: `url('${animePicUrl}')` }} />
          <img className='card-img is-next lazyloaded' style={{ visibility: 'hidden' }} src={episodePicUrl} data-src={episodePicUrl} alt={title} />
          <img className='card-img lazyloaded' src={animePicUrl} data-src={animePicUrl} alt={title} style={{}} />
          <div className='line-gradient' />
          <i className='btn-delete material-icons-round' data-gtm-category='首頁' data-gtm-event='點擊移除繼續觀看卡片' style={{ pointerEvents: 'auto' }}>close</i>
        </div>
      </a>
      <a className='content-block' href={`animeVideo.php?sn=${id}`} data-gtm-category='首頁' data-gtm-event='點擊繼續觀看卡片' tabIndex={0}>
        <div className='img-progress-block' style={{ pointerEvents: 'none' }}>
          <div className='info-row'>
            <div className='episode-block'>
              <img src='https://i2.bahamut.com.tw/anime/pic-tv.svg' alt='pic-tv' />
              <p className='episode-watched' data-episode='第1集' data-next-episode='第2集'>第 {episode} 集</p>
            </div>
            <p className='time-left' data-time={`剩餘 ${videoTotalTime - videoWatchTime} 分`} data-next-episode-time={`剩餘 ${videoTotalTime - videoWatchTime} 分`}>剩餘 {videoTotalTime - videoWatchTime} 分</p>
          </div>
          <div className='progress-bar'>
            <div className='progress' style={{ width: `${(videoWatchTime / videoTotalTime) * 100}%` }} data-progress={`${(videoWatchTime / videoTotalTime) * 100}`} />
          </div>
        </div>
        <div className='content' style={{ pointerEvents: 'none' }}>
          <p className='anime-name'>
            {title}
          </p>
        </div>
      </a>
      <a className='btn-next' href={`animeVideo.php?sn=${id}`} data-gtm-category='首頁' data-gtm-event='點擊繼續觀看下一集按鈕' tabIndex={0}>
        <p style={{ pointerEvents: 'none' }}>下一集</p>
        <span className='material-icons-round' style={{ pointerEvents: 'none' }}>
          skip_next
        </span>
      </a>
    </div>
  )
}
const tabList = ['我的動畫', '本機歷史紀錄']
const MainContainer = ({ histories }: { histories: Anime[] }): JSX.Element => {
  const [index, setIndex] = React.useState(0)
  const tabDOM = tabList.map((tab, i) => (
    <a
      key={tab}
      className={(index === i ? 'now' : '')}
      onClick={() => setIndex(i)}
      style={{ width: 'unset', cursor: index !== i ? 'pointer' : 'unset' }}
    >
      <p style={{ width: 'max-content', padding: '0 10px' }}>{tab}</p>
    </a>
  ))
  const historiesDOM = histories.map(({ id, timestamp: time, title, episodePicUrl, animePicUrl, episode, videoWatchTime, videoTotalTime }) => (
    <AnimeCard
      key={title}
      id={id}
      timestamp={time}
      title={title}
      episodePicUrl={episodePicUrl}
      animePicUrl={animePicUrl}
      episode={episode}
      videoWatchTime={videoWatchTime}
      videoTotalTime={videoTotalTime}
    />
  ))
  return (
    <div className='page_control' style={{ display: 'flex', flexDirection: 'column' }}>
      <div className='page_number'>
        {tabDOM}
      </div>
      <div className='animate-theme-list spacing-top-30'>
        <div className='theme-title-block'>
          <h1 className='theme-title'>本機歷史紀錄</h1>
        </div>
        <div className='theme-list-block'>{historiesDOM}</div>
      </div>
    </div>
  )
}
const init = (pathname: string): Subscription => of(pathname).pipe(
  map(() => document.getElementsByClassName('user-id')[0]?.innerHTML),
  filter(isNotNil),
  map((userId) => globalVar.animeHistory[userId]),
  filter(fp.negate(fp.isNil))
).subscribe((histories) => {
  const app = document.getElementsByClassName('theme-title-block')?.item(0)
  const container = document.createElement('div')
  app?.before(container)
  const root = ReactDOM.createRoot(container)
  root.render(<MainContainer histories={histories} />)
})
