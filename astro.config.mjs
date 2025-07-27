// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://oboenikui.github.io',
  base: process.env.NODE_ENV === 'production' ? '/mamecomi-point-scanner' : undefined,
  output: 'static',
  build: {
    assets: 'assets'
  },
  vite: {
    server: {
      fs: {
        allow: ['..']
      }
    }
  }
});
