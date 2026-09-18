// 資料格式版本 1 的凍結測試資料（不要修改）。
// history：0.4.0～0.7.1 可能寫出的各種紀錄；upgraded：升級到版本 2 之後應有的內容。
// 刻意不使用 Anime 型別，之後型別改變時這份資料仍維持版本 1 的原樣。

const reported = {
  id: '29681',
  title: '暴怒千金發誓復仇。 ～憑藉魔導書之力打垮祖國～',
  timestamp: 1789615380421,
  episode: '5b',
  episodePicUrl: '',
  animePicUrl: '',
  videoWatchTime: 1.203466,
  videoTotalTime: 1425.024
}

const bahamut = {
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
  id: '30152',
  title: 'LIAR GAME 詐欺遊戲',
  timestamp: 1789500000000,
  episode: '24',
  episodePicUrl: '',
  animePicUrl: '',
  videoWatchTime: 300,
  videoTotalTime: 1440
}

export const v1 = {
  version: '1.0.0',
  history: {
    tester: [
      // 0.6.0 以後寫出的動畫瘋紀錄
      { source: 'ani-gamer', ...bahamut, isFavorite: true, favoriteTime: 1788000000000, removeTime: 1787000000000 },
      // 0.5.0 以前寫出的動畫瘋紀錄（沒有 source）
      { ...bahamut, title: '孤獨搖滾！', id: '31000', timestamp: 1788500000000 },
      // 已刪除
      { source: 'ani-gamer', ...bahamut, title: '間諜家家酒', id: '32000', timestamp: 1788400000000, removeTime: 1788400000001 }
    ],
    '@shared': [
      // 回報的重複資料：原本的 anime1 紀錄，與 0.5.0 以前剝掉欄位、再被 0.6.0～0.7.1 補成動畫瘋的副本
      { source: 'anime1', ...reported, seriesId: '1959' },
      { source: 'ani-gamer', ...reported },
      // 只剩 0.5.0 以前寫出的副本（沒有 source 也沒有 seriesId）
      { ...anime1, isFavorite: true, favoriteTime: 1789500000001 },
      // 完整的 anime1 紀錄
      { source: 'anime1', ...anime1, title: '【我推的孩子】', id: '30500', seriesId: '1800', timestamp: 1789400000000 }
    ]
  },
  upgradedVersion: '2.0.0',
  upgraded: {
    tester: [
      { source: 'ani-gamer', ...bahamut, isFavorite: true, favoriteTime: 1788000000000, removeTime: 1787000000000 },
      { source: 'ani-gamer', ...bahamut, title: '孤獨搖滾！', id: '31000', timestamp: 1788500000000 },
      { source: 'ani-gamer', ...bahamut, title: '間諜家家酒', id: '32000', timestamp: 1788400000000, removeTime: 1788400000001 }
    ],
    '@shared': [
      { source: 'anime1', ...reported, seriesId: '1959' },
      { source: 'anime1', ...anime1, isFavorite: true, favoriteTime: 1789500000001 },
      { source: 'anime1', ...anime1, title: '【我推的孩子】', id: '30500', seriesId: '1800', timestamp: 1789400000000 }
    ]
  }
}
