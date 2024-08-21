import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import monkey, { cdn, util } from 'vite-plugin-monkey';
import path from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import { fileURLToPath } from 'url';
// https://vitejs.dev/config/
export default defineConfig({
  server: { watch: { usePolling: true } },
  plugins: [
    AutoImport({
      imports: [util.unimportPreset],
    }),
    react(),
    monkey({
      entry: 'src/main.tsx',
      userscript: {
        name: 'Ani Gamer History',
        namespace: 'https://github.com/zoosewu',
        version: '0.1.0',
        description: '把你的觀看紀錄永久存在電腦中',
        author: 'zoosewu',
        match: ['https://ani.gamer.com.tw/*'],
        icon: 'https://i2.bahamut.com.tw/anime/logo.svg',
      },
      build: {
        externalGlobals: {
          react: cdn.jsdelivr('React', 'umd/react.production.min.js'),
          'react-dom': cdn.jsdelivr(
            'ReactDOM',
            'umd/react-dom.production.min.js',
          ),
          rxjs: cdn.cdnjs('rxjs', 'rxjs.umd.min.js'),
          'lodash': ['_', (version, name, _importName = '', resolveName = '') => (`https://cdnjs.cloudflare.com/ajax/libs/lodash.js/${version}/lodash.min.js`)],
          'lodash/fp': ['_.noConflict()', (version, name, _importName = '', resolveName = '') => (`https://cdnjs.cloudflare.com/ajax/libs/lodash.js/${version}/lodash.fp.min.js`)],
        },
      },
    }),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ]
  }
});
