import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare'; // <--- Esto debe estar instalado

import vercel from '@astrojs/vercel';

import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server', // O 'hybrid' si solo algunas páginas son dinámicas
  adapter: netlify(),
});