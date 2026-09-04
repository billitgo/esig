import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // pdfjs-dist v4 使用 Top-level await（ES2022），需提升构建目标；
  // 且预构建会破坏其内部类（#pagePromises 私有字段），必须排除、走原生 ESM
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
    esbuildOptions: { target: 'esnext' },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 5173,
    // 监听所有网卡，允许局域网内其他终端访问（http://<本机IP>:5173）
    host: '0.0.0.0',
    // 开发环境将 /api 请求代理到后端，实现前后端分离联调
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
