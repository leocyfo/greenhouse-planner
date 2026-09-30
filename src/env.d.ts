/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse du petit serveur de l'import Hypixel (voir le README) ; vide : import désactivé. */
  readonly VITE_PROFILE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
