import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos: funciona no Capacitor (Android) e em qualquer subpasta na web (ex.: GitHub Pages).
  base: './',
  build: {
    outDir: process.env.SINGLE_FILE ? 'dist-single' : 'dist',
    target: 'es2020',
    // Na versão de ficheiro único, todos os recursos (fonte incluída) ficam embutidos.
    assetsInlineLimit: process.env.SINGLE_FILE ? Number.MAX_SAFE_INTEGER : 4096,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
