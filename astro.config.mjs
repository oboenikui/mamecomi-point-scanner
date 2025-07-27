// @ts-check
import { defineConfig } from 'astro/config';
import mkcert from 'vite-plugin-mkcert';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://astro.build/config
export default defineConfig({
  site: 'https://oboenikui.github.io',
  base: import.meta.env.PROD ? '/mamecomi-point-scanner' : undefined,
  output: 'static',
  build: {
    assets: 'assets',
  },
  vite: {
    plugins: [
      // HTTPS開発環境でのみmkcertプラグインを有効化
      ...(!import.meta.env.PROD
        ? [mkcert(), basicSsl()]
        : []),
    ].filter(Boolean),
    server: {
      host: true,
      https: true,
      fs: {
        allow: ['..'],
      },
    },
  },
});
