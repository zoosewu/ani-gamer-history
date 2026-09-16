import { describe, expect, it } from 'vitest'
import { AdapterSettings, CloudAdapterDefinition, exportAdapterSettings, importAdapterSettings } from './adapter'

const definition: CloudAdapterDefinition = {
  id: 'test',
  label: 'Test',
  instructions: [],
  fields: [
    { key: 'token', label: 'Token', type: 'password', required: true },
    { key: 'repository', label: 'Repository', type: 'text', required: true },
    { key: 'branch', label: '分支', type: 'text', required: false }
  ],
  create: () => ({ load: async () => null, save: async () => {} }),
  test: async () => ({ ok: true, message: '' })
}

const settings: AdapterSettings = { token: ' abc ', repository: 'me/data', branch: '', unknown: 'x' }

describe('adapter settings 複製 / 貼上', () => {
  it('預設只帶 fields 描述的欄位，去空白並去掉空值', () => {
    expect(exportAdapterSettings(definition, settings)).toEqual({ token: 'abc', repository: 'me/data' })
    expect(importAdapterSettings(definition, settings)).toEqual({ token: 'abc', repository: 'me/data' })
  })

  it('平台可以覆寫匯出與匯入的內容', () => {
    const custom: CloudAdapterDefinition = {
      ...definition,
      exportSettings: ({ token, ...rest }) => rest,
      importSettings: (value) => ({ ...value, branch: 'main' })
    }
    expect(exportAdapterSettings(custom, settings)).toEqual({ repository: 'me/data' })
    expect(importAdapterSettings(custom, settings)).toEqual({ token: 'abc', repository: 'me/data', branch: 'main' })
  })
})
