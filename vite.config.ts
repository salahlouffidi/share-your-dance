import { defineConfig } from 'vite';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [
    devvit({
      client: {
        build: {
          chunkSizeWarningLimit: 2000,
          // The Phaser source map is 11 MB; leaving it out keeps uploads small.
          sourcemap: false,
        },
      },
    }),
  ],
});
