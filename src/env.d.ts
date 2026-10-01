/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse du petit serveur de l'import Hypixel (voir le README) ; vide : import désactivé. */
  readonly VITE_PROFILE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Version de package.json (« 1.8.0 »), remplacée au build (vite.config.ts). */
declare const __APP_VERSION__: string
