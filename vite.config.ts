import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const isHostedPreview = Boolean(
  process.env.DISABLE_HMR === 'true' ||
    process.env.NG_ALLOWED_HOSTS ||
    process.env.CONTROL_PLANE_PORT,
);

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Копируем пользовательские ресурсы из src/assets в dist при сборке, если папка существует.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    server: {
      port: 3000,
      strictPort: false,
      host: true,
      allowedHosts: true as const,
      hmr: isHostedPreview ? false : undefined,
      watch: isHostedPreview ? null : undefined,
    },
    preview: {
      port: 3000,
      host: true,
      allowedHosts: true as const,
    },
  };
});
