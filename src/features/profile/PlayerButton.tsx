import { useAppStore } from '../../store/appStore'
import { useImportDialog } from './importDialogStore'
import { PROFILE_IMPORT_VISIBLE } from './profileApi'

/** Bouton de l'en-tête : importer son profil, ou relire celui du joueur déjà lié. */
export function PlayerButton() {
  const name = useAppStore((s) => s.settings.player.name)
  const show = useImportDialog((s) => s.show)
  const search = useImportDialog((s) => s.search)
  if (!PROFILE_IMPORT_VISIBLE) return null

  const className =
    'flex shrink-0 items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm transition hover:border-accent/60 hover:bg-panel-raised motion-safe:active:scale-[0.97]'
  if (!name) {
    return (
      <button type="button" onClick={show} className={className}>
        {/* Un seul élément flex : l'espace reste une vraie espace (écran et lecteurs d'écran). */}
        <span>
          Importer<span className="hidden sm:inline"> mon profil</span>
        </span>
      </button>
    )
  }
  return (
    <button type="button" onClick={() => search(name)} title="Relire ton profil sur Hypixel" className={className}>
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-strong"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="font-medium">{name}</span>
      <span className="hidden text-ink-muted sm:inline">· Actualiser</span>
    </button>
  )
}
