import { HistorySnapshot } from '@/history/types'

// adapter 只負責「資料存到哪裡」；合併與同步時機由 syncEngine 與 triggers 處理
export interface HistoryAdapter {
  // null 代表目的地還沒有資料（或使用者取消選擇檔案）
  load: () => Promise<HistorySnapshot | null>
  // 目的地的資料在 load 之後被別人改過時，throw ConflictError
  save: (snapshot: HistorySnapshot) => Promise<void>
}

export class ConflictError extends Error {
  constructor (message = '雲端資料已被其他裝置更新') {
    super(message)
    this.name = 'ConflictError'
  }
}

export type AdapterSettings = Record<string, string>

export interface FieldSpec {
  key: string
  label: string
  type: 'text' | 'password'
  required: boolean
  placeholder?: string
  help?: string
}

export interface TestResult {
  ok: boolean
  message: string
}

export interface CloudAdapterDefinition {
  id: string
  label: string
  // 顯示在設定畫面的設定步驟
  instructions: string[]
  fields: FieldSpec[]
  create: (settings: AdapterSettings) => HistoryAdapter
  test: (settings: AdapterSettings) => Promise<TestResult>
}
