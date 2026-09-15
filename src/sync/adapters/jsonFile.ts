import { parseSnapshot } from '@/history/merge'
import { HistoryAdapter } from '../adapter'

export interface FileIO {
  download: (filename: string, content: string) => void
  // 回傳檔案內容；使用者取消時回傳 null
  pickFile: () => Promise<string | null>
}

const pad = (value: number): string => String(value).padStart(2, '0')

export const exportFileName = (date: Date): string =>
  `ani-gamer-history-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`

export const browserFileIO: FileIO = {
  download: (filename, content) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  pickFile: async () => await new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file === undefined) resolve(null)
      else file.text().then(resolve, reject)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

export const createJsonFileAdapter = (io: FileIO = browserFileIO, now: () => Date = () => new Date()): HistoryAdapter => ({
  load: async () => {
    const text = await io.pickFile()
    if (text === null) return null
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('檔案不是有效的 JSON')
    }
    return parseSnapshot(data)
  },
  save: async (snapshot) => {
    io.download(exportFileName(now()), JSON.stringify(snapshot, null, 2))
  }
})
