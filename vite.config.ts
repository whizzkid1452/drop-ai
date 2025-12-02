import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import checker from 'vite-plugin-checker';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_URL || '/',
  plugins: [
    react({
      include: /\.(jsx|tsx)$/,
      babel: {
        plugins: [
          // other Babel plugins
          [
            '@locator/babel-jsx/dist',
            {
              env: 'development',
            },
          ],
        ],
      },
    }),
    vanillaExtractPlugin(),
    checker({
      typescript: true,
      // ESLint checker disabled due to incompat with ESLint 9
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
