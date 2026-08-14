import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Cloudflare Pages serves from the domain root, so '/' is the default. GitHub
  // Pages serves a project site from /<repo>/, and its workflow sets BASE_PATH
  // accordingly — keeping both hosts buildable from the same source.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
