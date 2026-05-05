import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare'; // <--- Esto debe estar instalado

export default defineConfig({
  output: 'server', // O 'hybrid' si solo algunas páginas son dinámicas
  adapter: cloudflare(),
}); 