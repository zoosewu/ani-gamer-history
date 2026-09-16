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
  // 複製 / 貼上設定時預設只帶 fields 描述的欄位，平台有特殊需求時才覆寫
  exportSettings?: (settings: AdapterSettings) => AdapterSettings
  importSettings?: (settings: AdapterSettings) => AdapterSettings
}

// 只取這個平台認得的欄位，並去掉空值
const pickFields = (definition: CloudAdapterDefinition, settings: AdapterSettings): AdapterSettings => {
  const picked: AdapterSettings = {}
  definition.fields.forEach((field) => {
    const value = (settings[field.key] ?? '').trim()
    if (value !== '') picked[field.key] = value
  })
  return picked
}

export const exportAdapterSettings = (definition: CloudAdapterDefinition, settings: AdapterSettings): AdapterSettings => {
  const picked = pickFields(definition, settings)
  return definition.exportSettings?.(picked) ?? picked
}

export const importAdapterSettings = (definition: CloudAdapterDefinition, settings: AdapterSettings): AdapterSettings => {
  const picked = pickFields(definition, settings)
  return definition.importSettings?.(picked) ?? picked
}
