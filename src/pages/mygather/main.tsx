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

const AnimeCard = ({ id, title, pictureUrl, episode }: Anime): JSX.Element => {
  return (
    <a href={'animeRef.php?sn=' + id} className='theme-list-main' data-gtm-category='我的動畫頁' data-gtm-event='點擊我的動畫卡片'>
      <div className='theme-img-block' style={{ pointerEvents: 'none' }}>
        <div className='theme-img-bg' style={{ backgroundImage: `url('${pictureUrl}')` }} />
        <img className='theme-img lazyloaded' src={pictureUrl} data-src={pictureUrl} alt={title} />

        <div className='anime-label-block' />
      </div>
      <div className='theme-info-block' style={{ pointerEvents: 'none' }}>
        <p className='theme-name'>{title}</p>
        <div className='theme-detail-info-block'>
          <p className='theme-time'>第 {episode} 集</p>
        </div>
      </div>
    </a>
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
  const historiesDOM = histories.map(({ id, time, title, pictureUrl, episode }) => (
    <AnimeCard
      key={title}
      id={id}
      time={time}
      title={title}
      pictureUrl={pictureUrl}
      episode={episode}
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
  console.log('app', app)
  app?.before(container)
  const root = ReactDOM.createRoot(container)
  root.render(<MainContainer histories={histories} />)
})
