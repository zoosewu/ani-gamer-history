import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

// 與 vite.config.ts 分開，測試時不載入 vite-plugin-monkey
export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }
    ]
  },
  test: {
    include: ['src/**/*.test.ts', '.github/scripts/**/*.test.mjs']
  }
})
