import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const inferredPagesBase =
  process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : './';

function devSpaFallback() {
  return {
    name: 'dev-spa-fallback',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '/').split('?')[0];
        const acceptsHtml = req.headers.accept?.includes('text/html') !== false;
        const isClientRoute = pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/@') && !pathname.startsWith('/src/'));

        if (!['GET', 'HEAD'].includes(req.method || '') || !acceptsHtml || !isClientRoute) {
          next();
          return;
        }

        try {
          const template = readFileSync(resolve(__dirname, 'index.html'), 'utf8');
          const html = await server.transformIndexHtml(req.url || '/', template);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    }
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || inferredPagesBase,
  plugins: [
    devSpaFallback(),
    react({
      include: /\.(js|jsx)$/
    })
  ]
});
