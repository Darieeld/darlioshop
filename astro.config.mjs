import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server', // <-- Asegúrate de que diga 'server'
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});