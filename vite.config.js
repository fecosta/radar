import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vitest reads this block. The classifier under test is pure JS, so no DOM is needed.
  // Imported from 'vite' rather than 'vitest/config' so a production build never
  // requires vitest to be installed.
  test: {
    environment: 'node',
  },
});
