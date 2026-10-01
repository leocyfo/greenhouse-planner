import { getGameData } from '../data'
import { WIKI_CREDITS, wikiImageFiles } from '../data/wikiImages'
import { tr } from '../i18n/locale'

const LINK = 'underline decoration-line underline-offset-2 hover:text-ink'

/** Pied de page : sources des données, crédits des images et avertissement. */
export function AppFooter() {
  const { sources } = getGameData().meta
  const files = wikiImageFiles()
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-7xl space-y-2 px-4 py-4 text-xs text-ink-muted sm:px-6">
        <p>
          {tr('Sources des données : ', 'Data sources: ')}
          {sources.join(tr(' ; ', '; '))}.
        </p>
        <p>
          {tr('Images : ', 'Images: ')}
          <a href={WIKI_CREDITS.sourceUrl} className={LINK}>
            {WIKI_CREDITS.source}
          </a>
          {tr(', sous licence ', ', under the ')}
          <a href={WIKI_CREDITS.licenseUrl} className={LINK}>
            {WIKI_CREDITS.license}
          </a>
          {tr('', ' license')}.{' '}
          {tr(WIKI_CREDITS.changes, 'Soil textures: top face of the blocks, flattened to 16 × 16.')}{' '}
          {tr('Les autres images sont utilisées sans modification.', 'The other images are used unmodified.')}{' '}
          {tr(WIKI_CREDITS.rights, 'Original textures © Mojang Studios and Hypixel Inc.')}
        </p>
        <details>
          <summary className="cursor-pointer hover:text-ink">
            {tr(`Liste des ${files.length} images et de leur page sur le wiki`, `List of the ${files.length} images and their wiki pages`)}
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
          {tr(
            "Outil de fan non officiel, sans lien avec Hypixel ni Mojang. Ta progression reste dans ce navigateur : rien n'est envoyé nulle part.",
            'Unofficial fan tool, not affiliated with Hypixel or Mojang. Your progress stays in this browser: nothing is sent anywhere.',
          )}
        </p>
      </div>
    </footer>
  )
}
