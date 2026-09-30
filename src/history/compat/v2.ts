// 資料版本 2.0.0 的凍結測試資料（不要修改）。
// history：0.8.0～0.10.0 可能寫出的紀錄（還沒有 note / noteTime）；
// upgraded：升級到 2.1.0 之後應有的內容——MINOR 只有新增欄位，所以內容相同。
// 刻意不使用 Anime 型別，之後型別改變時這份資料仍維持 2.0.0 的原樣。

const bahamut = {
  source: 'ani-gamer',
  id: '49874',
  title: '葬送的芙莉蓮',
  timestamp: 1789000000000,
  episode: '12',
  episodePicUrl: 'https://p2.bahamut.com.tw/B/2KU/episode.jpg',
  animePicUrl: 'https://p2.bahamut.com.tw/B/2KU/anime.jpg',
  videoWatchTime: 615.5,
  videoTotalTime: 1420.25
}

const anime1 = {
  source: 'anime1',
  id: '30152',
  title: 'LIAR GAME 詐欺遊戲',
  seriesId: '1898',
  timestamp: 1789500000000,
  episode: '24',
  episodePicUrl: '',
  animePicUrl: '',
  videoWatchTime: 300,
  videoTotalTime: 1440
}

const history = {
  tester: [
    { ...bahamut, isFavorite: true, favoriteTime: 1788000000000 },
    { ...bahamut, title: '間諜家家酒', id: '32000', timestamp: 1788400000000, removeTime: 1788400000001 }
  ],
  '@shared': [anime1]
}

export const v2 = {
  version: '2.0.0',
  history,
  upgradedVersion: '2.1.0',
  upgraded: history
}
