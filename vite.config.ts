import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_URL || '/',
  plugins: [react(), vanillaExtractPlugin()],
  resolve: {
    alias: {
      '@daw-engine-source/browser-adapter': path.resolve(__dirname, './daw-engine/core/src/browser-adapter.ts'),
      '@/utils': path.resolve(__dirname, './src/layers/shared/utils'),
      '@/types': path.resolve(__dirname, './src/layers/shared/types'),
      '@/styles': path.resolve(__dirname, './src/layers/apps/web/styles'),
      '@/common': path.resolve(__dirname, './src/layers/apps/web/components/common'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
  },
});
