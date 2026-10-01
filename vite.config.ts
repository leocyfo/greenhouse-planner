import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Version affichée sous le nom du site (« v1.8 ») : celle de package.json, montée à chaque push.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  // Chemins relatifs : le build fonctionne aussi dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Web Worker du remplissage automatique : module ES, comme le reste du site.
  worker: { format: 'es' },
  build: {
    // Les images du wiki restent des fichiers à part (mis en cache, chargés à l'affichage) au
    // lieu d'être intégrées en base64 dans le JavaScript, comme Vite le fait sous 4 ko.
    assetsInlineLimit: (filePath) => (/[\\/]assets[\\/]wiki[\\/]/.test(filePath) ? false : undefined),
    rolldownOptions: {
      output: {
        // Les bibliothèques changent rarement : dans leurs propres fichiers, elles restent en
        // cache d'un déploiement à l'autre.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/](zod|zustand)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    environment: 'node',
  },
})
