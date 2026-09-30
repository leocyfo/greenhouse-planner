import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Chemins relatifs : le build fonctionne aussi dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // Les images du wiki restent des fichiers à part (mis en cache, chargés à l'affichage) au
    // lieu d'être intégrées en base64 dans le JavaScript, comme Vite le fait sous 4 ko.
    assetsInlineLimit: (filePath) => (/[\\/]assets[\\/]wiki[\\/]/.test(filePath) ? false : undefined),
    rolldownOptions: {
      output: {
        // Les bibliothèques changent rarement : dans leurs propres fichiers, elles restent en
        // cache d'un déploiement à l'autre. Les paquets sont listés un par un pour que React
        // Flow reste dans le chunk de l'Encyclopédie, chargé à la demande.
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
