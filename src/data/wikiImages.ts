/**
 * Images du Hypixel SkyBlock Wiki (Fandom, CC BY-SA), téléchargées par
 * scripts/fetch-wiki-images.mjs dans src/assets/wiki/ : nom affiché → image intégrée au site.
 * Pas de lien vers Fandom au chargement : les images sont servies avec l'application.
 */
import manifest from './wikiImages.json'

// Vite intègre chaque fichier au build et donne son URL finale.
const urls = import.meta.glob<string>('../assets/wiki/*.png', { eager: true, query: '?url', import: 'default' })
const urlByFile = new Map(Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]))
const images: Readonly<Record<string, string>> = manifest.images

/** URL de l'image d'une mutation, d'un crop, d'un sol ou d'un objet ; null si le wiki n'en a pas. */
export function wikiImage(name: string): string | null {
  const file = images[name]
  return file ? (urlByFile.get(file) ?? null) : null
}

const textures: Readonly<Record<string, string>> = manifest.textures

/** URL de la texture à plat d'un sol (face du dessus du bloc) ; null si le wiki n'a pas le bloc. */
export function wikiTexture(surface: string): string | null {
  const file = textures[surface]
  return file ? (urlByFile.get(file) ?? null) : null
}

/** Source, licence et droits des images, pour les crédits. */
export const WIKI_CREDITS = manifest._meta

export interface WikiImageFile {
  readonly file: string
  /** Page du fichier sur le wiki (auteurs, historique, licence). */
  readonly page: string
}

/** Fichiers utilisés par l'application, avec leur page sur le wiki. */
export function wikiImageFiles(): WikiImageFile[] {
  return [...new Set(Object.values(images))]
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({ file, page: `${manifest._meta.sourceUrl}wiki/File:${file}` }))
}
