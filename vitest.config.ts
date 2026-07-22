import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@/styles': path.resolve(__dirname, './src/layers/apps/web/styles'),
      '@/types': path.resolve(__dirname, './src/layers/shared/types'),
      '@/utils': path.resolve(__dirname, './src/layers/shared/utils'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    include: ['src/layers/**/*.test.ts'],
  },
});
