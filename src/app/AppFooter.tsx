import { getGameData } from '../data'
import { WIKI_CREDITS, wikiImageFiles } from '../data/wikiImages'

const LINK = 'underline decoration-line underline-offset-2 hover:text-ink'

/** Pied de page : sources des données, crédits des images et avertissement. */
export function AppFooter() {
  const { sources } = getGameData().meta
  const files = wikiImageFiles()
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-7xl space-y-2 px-4 py-4 text-xs text-ink-muted sm:px-6">
        <p>Sources des données : {sources.join(' ; ')}.</p>
        <p>
          Images :{' '}
          <a href={WIKI_CREDITS.sourceUrl} className={LINK}>
            {WIKI_CREDITS.source}
          </a>
          , sous licence{' '}
          <a href={WIKI_CREDITS.licenseUrl} className={LINK}>
            {WIKI_CREDITS.license}
          </a>
          . {WIKI_CREDITS.changes} Les autres images sont utilisées sans modification. {WIKI_CREDITS.rights}
        </p>
        <details>
          <summary className="cursor-pointer hover:text-ink">
            Liste des {files.length} images et de leur page sur le wiki
          </summary>
          <ul className="mt-2 animate-fade-up columns-2 gap-x-6 sm:columns-3 lg:columns-5">
            {files.map((image) => (
              <li key={image.file}>
                <a href={image.page} className={LINK}>
                  {image.file.replace(/\.png$/, '').replaceAll('_', ' ')}
                </a>
              </li>
            ))}
          </ul>
        </details>
        <p>
          Outil de fan non officiel, sans lien avec Hypixel ni Mojang. Ta progression reste dans ce navigateur : rien n&apos;est
          envoyé nulle part.
        </p>
      </div>
    </footer>
  )
}
