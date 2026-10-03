import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import { useImportDialog } from '../profile/importDialogStore'
import { PROFILE_IMPORT_VISIBLE } from '../profile/profileApi'

/**
 * Mettre le stock à jour depuis Hypixel sans quitter le guide : relit le profil déjà lié (même
 * fenêtre que l'en-tête), ou ouvre l'import. Le guide avance dès que le stock est mis à jour.
 */
export function StockRefreshButton({ className }: { readonly className: string }) {
  const name = useAppStore((s) => s.settings.player.name)
  const show = useImportDialog((s) => s.show)
  const search = useImportDialog((s) => s.search)
  if (!PROFILE_IMPORT_VISIBLE) return null
  return (
    <button
      type="button"
      onClick={() => (name ? search(name) : show())}
      title={name ? tr(`Relire le profil de ${name} sur Hypixel`, `Read ${name}’s profile on Hypixel again`) : undefined}
      className={className}
    >
      {name ? tr('↻ Mettre à jour mon stock (Hypixel)', '↻ Update my stock (Hypixel)') : tr('Importer mon stock (Hypixel)', 'Import my stock (Hypixel)')}
    </button>
  )
}
