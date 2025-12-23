import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    testTimeout: 20000,
    globals: true,
  },
});
