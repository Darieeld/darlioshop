import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  // Forzamos a Astro a usar la ruta que Cloudflare te obliga a poner
  outDir: './dist', 
});