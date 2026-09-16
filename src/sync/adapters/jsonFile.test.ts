import { describe, expect, it } from 'vitest'
import { createSnapshot } from '@/history/merge'
import { createJsonFileAdapter, exportFileName, FileIO } from './jsonFile'

const history = {
  使用者: [{ id: '1', timestamp: 5, title: '葬送的芙莉蓮', episodePicUrl: '', animePicUrl: '', episode: '3', videoWatchTime: 1, videoTotalTime: 2 }]
}

const createIO = (file: string | null): FileIO & { downloads: Array<{ filename: string, content: string }> } => {
  const io = {
    downloads: [] as Array<{ filename: string, content: string }>,
    download: (filename: string, content: string) => { io.downloads.push({ filename, content }) },
    pickFile: async () => file
  }
  return io
}

describe('jsonFile adapter', () => {
  it('匯出的檔案可以原樣匯入', async () => {
    const io = createIO(null)
    const snapshot = createSnapshot(history, 7)
    await createJsonFileAdapter(io, () => new Date(2026, 8, 5, 8, 3)).save(snapshot)
    expect(io.downloads).toHaveLength(1)
    expect(io.downloads[0].filename).toBe('ani-gamer-history-20260905-0803.json')
    expect(await createJsonFileAdapter(createIO(io.downloads[0].content)).load()).toEqual(snapshot)
  })

  it('取消選擇檔案時回傳 null', async () => {
    expect(await createJsonFileAdapter(createIO(null)).load()).toBeNull()
  })

  it('接受舊版格式', async () => {
    expect(await createJsonFileAdapter(createIO(JSON.stringify(history))).load()).toEqual(createSnapshot(history, 0))
  })

  it('內容不是 JSON 或格式錯誤時拋出錯誤', async () => {
    await expect(createJsonFileAdapter(createIO('{oops')).load()).rejects.toThrow('不是有效的 JSON')
    await expect(createJsonFileAdapter(createIO('{"alice": 1}')).load()).rejects.toThrow('不是陣列')
  })

  it('檔名使用本地時間', () => {
    expect(exportFileName(new Date(2026, 11, 31, 23, 59))).toBe('ani-gamer-history-20261231-2359.json')
  })
})
