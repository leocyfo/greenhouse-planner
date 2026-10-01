import { useId } from 'react'
import { APP_NAME } from '../../app/brand'
import { WikiIcon } from '../../components/game/WikiIcon'
import { tr } from '../../i18n/locale'
import { useImportDialog } from '../profile/importDialogStore'
import { PlayerSearchForm } from '../profile/PlayerSearchForm'
import { PROFILE_IMPORT_VISIBLE } from '../profile/profileApi'

const REPOSITORY_URL = 'https://github.com/leocyfo/greenhouse-planner'

/**
 * Accueil à la manière de SkyCrypt : grand encadré en verre dépoli, nom du site, phrase
 * d'accroche, champ du pseudo (import Hypixel) et une carte de lien en dessous.
 */
export function HomeHero() {
  const titleId = useId()
  const search = useImportDialog((s) => s.search)

  return (
    <section
      aria-labelledby={titleId}
      className="app-header-bar mx-auto max-w-4xl rounded-2xl border border-white/10 px-5 py-7 text-center shadow-lg shadow-black/30"
    >
      <p id={titleId} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {APP_NAME}
      </p>
      <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-base font-semibold text-ink/85 sm:text-lg">
        {tr('Planifie et calcule les mutations du Greenhouse de SkyBlock', 'Plan and compute the mutations of the SkyBlock Greenhouse')}
        <WikiIcon name="Rose Dragon Pet" size={26} />
      </p>
      {PROFILE_IMPORT_VISIBLE && (
        <div className="mx-auto mt-5 max-w-xl text-left">
          <PlayerSearchForm onSearch={search} />
          <p className="mt-2 text-center text-xs text-ink-muted">
            {tr(
              'Ton pseudo : le site compte les mutations de tes sacs, inventaire, ender chest, sacs à dos et coffre personnel. Tu vérifies avant que ton stock soit remplacé.',
              'Your name: the site counts the mutations in your sacks, inventory, ender chest, backpacks and personal vault. You check before your stock is replaced.',
            )}
          </p>
        </div>
      )}
      <a
        href={REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
        className="group mx-auto mt-5 flex max-w-md items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/5"
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/90 text-canvas">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{tr(`${APP_NAME} sur GitHub`, `${APP_NAME} on GitHub`)}</span>
          <span className="block text-sm text-ink-muted">{tr('Le code du site, gratuit et ouvert', "The site's code, free and open")}</span>
        </span>
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-ink-muted transition-colors group-hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </span>
        <span className="sr-only">{tr('(nouvel onglet)', '(new tab)')}</span>
      </a>
    </section>
  )
}
