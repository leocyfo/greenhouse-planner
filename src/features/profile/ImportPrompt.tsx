import { useId } from 'react'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import { useImportDialog } from './importDialogStore'
import { PlayerSearchForm } from './PlayerSearchForm'
import { PROFILE_IMPORT_VISIBLE } from './profileApi'

/**
 * Invitation du premier lancement, à la manière de SkyCrypt : le pseudo, et le site compte tes
 * mutations. Disparaît une fois un profil importé, ou écartée par « plus tard ».
 */
export function ImportPrompt() {
  const titleId = useId()
  const player = useAppStore((s) => s.settings.player)
  const setPlayer = useAppStore((s) => s.setPlayer)
  const search = useImportDialog((s) => s.search)
  if (!PROFILE_IMPORT_VISIBLE || player.name !== '' || player.promptDismissed) return null

  return (
    <section aria-labelledby={titleId} className="rounded-xl border border-accent/40 bg-panel px-5 py-6 text-center">
      <h3 id={titleId} className="text-lg font-semibold">
        {tr('Importe ton profil Hypixel', 'Import your Hypixel profile')}
      </h3>
      <p className="mx-auto mt-1 max-w-xl text-sm text-ink-muted">
        {tr(
          'Entre ton pseudo : le site compte les mutations de tes sacs, de ton inventaire, de ton ender chest, de tes sacs à dos et de ton coffre personnel. Tu vérifies avant que ton stock soit remplacé.',
          'Enter your name: the site counts the mutations in your sacks, inventory, ender chest, backpacks and personal vault. You check before your stock is replaced.',
        )}
      </p>
      <div className="mx-auto mt-4 max-w-md text-left">
        <PlayerSearchForm onSearch={search} />
      </div>
      <button
        type="button"
        onClick={() => setPlayer({ promptDismissed: true })}
        className="mt-3 text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
      >
        {tr('Plus tard : je remplis mon stock à la main', 'Later: I fill in my stock by hand')}
      </button>
    </section>
  )
}
