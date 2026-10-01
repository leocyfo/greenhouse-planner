import { tabHref } from '../../app/navigation'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { upgradeByEffect } from '../../logic/upgrades'

interface LockedGreenhouseProps {
  /** Index du greenhouse (0 = le 1er). */
  readonly index: number
  /** Prix au NPC en Ethereal Vines, s'il est connu. */
  readonly price: number | undefined
  /** Le greenhouse précédent est lui aussi verrouillé (le déblocage se fait dans l'ordre). */
  readonly previousLocked: boolean
}

/** Greenhouse pas encore acheté : pas d'édition, lien vers l'upgrade Plot Limit (onglet Outils). */
export function LockedGreenhouse({ index, price, previousLocked }: LockedGreenhouseProps) {
  const upgrade = upgradeByEffect(getGameData(), 'plotLimit')
  return (
    <div className="rounded-xl border border-dashed border-line bg-panel/50 px-6 py-12 text-center">
      <p aria-hidden="true" className="text-3xl">
        🔒
      </p>
      <h3 className="mt-2 text-lg font-semibold">{tr(`Greenhouse ${index + 1} verrouillé`, `Greenhouse ${index + 1} locked`)}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        {tr(
          `Débloque-le dans l'onglet Outils${upgrade ? `, avec l'upgrade ${upgrade.name} au tier ${index}` : ''}${price ? ` (${price} Ethereal Vines)` : ''}.${previousLocked ? ` Il faut d'abord le greenhouse ${index}.` : ''} Tu pourras alors y poser tes crops.`,
          `Unlock it in the Tools tab${upgrade ? `, with the ${upgrade.name} upgrade at tier ${index}` : ''}${price ? ` (${price} Ethereal Vines)` : ''}.${previousLocked ? ` Greenhouse ${index} comes first.` : ''} You can then place your crops there.`,
        )}
      </p>
      <a
        href={tabHref('outils')}
        className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-canvas transition-colors hover:bg-accent-strong"
      >
        {tr('Aller aux Upgrades du Greenhouse', 'Go to the Greenhouse Upgrades')}
      </a>
    </div>
  )
}
