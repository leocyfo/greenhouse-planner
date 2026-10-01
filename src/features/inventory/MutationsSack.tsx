import type { ReactNode } from 'react'
import { McItem } from '../../components/minecraft/McItem'
import { McSlot } from '../../components/minecraft/McSlot'
import { MC_COLUMNS, McWindow } from '../../components/minecraft/McWindow'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { useAppStore } from '../../store/appStore'
import { useGoalPlan } from '../../store/useGoalPlan'
import { sackHelpTooltip, sackLabel, sackTooltip, untrackedTooltip } from './sackText'
import { useMutationDialog } from './useMutationDialog'

interface MutationsSackProps {
  /** Mutations qui passent les filtres ; les autres cases sont assombries. */
  readonly matches: ReadonlySet<string>
}

/**
 * Inventaire façon Mutations Sack, à toute la largeur disponible : une case par objet, dans l'ordre
 * du sac du jeu (marques expliquées par la case « ? »). Un clic ouvre la fiche complète de la
 * mutation dans une petite fenêtre, où le stock se modifie.
 */
export function MutationsSack({ matches }: MutationsSackProps) {
  const data = getGameData()
  const sack = data.mutationsSack
  const inventory = useAppStore((s) => s.progress.inventory)
  const { plan, analyzed } = useGoalPlan()
  const dialog = useMutationDialog()

  const itemRows = Math.ceil(sack.items.length / MC_COLUMNS)
  const slots = new Map<number, ReactNode>()
  sack.items.forEach((item, index) => {
    const mutation = item.mutationId ? data.mutationsById.get(item.mutationId) : undefined
    if (!mutation) {
      slots.set(
        index,
        <McSlot icon={<McItem name={item.name} />} tooltip={untrackedTooltip(item.name)} label={tr(`${item.name} : objet du sac, pas suivi`, `${item.name}: sack item, not tracked`)} />,
      )
      return
    }
    const entry = {
      mutation,
      owned: inventory[mutation.id] ?? 0,
      need: plan.needs.get(mutation.id),
      analyzed: analyzed.has(mutation.id),
    }
    slots.set(
      index,
      <McSlot
        icon={<McItem name={mutation.name} dim={entry.owned === 0} />}
        count={entry.owned}
        countFrom={1}
        badge={entry.need && entry.need.missing === 0 ? '✓' : undefined}
        glint={entry.analyzed}
        muted={!matches.has(mutation.id)}
        tooltip={sackTooltip(entry)}
        label={sackLabel(entry)}
        onClick={() => dialog.open(mutation.id)}
        onButtonRef={dialog.triggerRef(mutation.id)}
      />,
    )
  })
  // Rangée du bas : le « ? » d'aide, au centre comme dans le jeu.
  slots.set(
    itemRows * MC_COLUMNS + 4,
    <McSlot icon={<span className="mc-glyph mc-c-d">?</span>} tooltip={sackHelpTooltip(sack)} label={tr(`Aide du ${sack.name}`, `${sack.name} help`)} />,
  )

  return (
    <>
      <McWindow fit title={sack.name} rows={itemRows + 1} slots={slots} />
      {dialog.dialog}
    </>
  )
}
