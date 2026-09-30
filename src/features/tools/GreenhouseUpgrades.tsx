import { useEffect, useRef, useState, type ReactNode } from 'react'
import { McSlot, type PaneColor } from '../../components/minecraft/McSlot'
import { MC_COLUMNS, McWindow } from '../../components/minecraft/McWindow'
import { McItem } from '../../components/minecraft/McItem'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { plotLimitTier, vineProgress, withPlotLimitTier } from '../../logic/tools'
import {
  clickedTier,
  cumulativeBonus,
  romanNumeral,
  spreadColumns,
  tierFromTotal,
  tierState,
  type TierState,
} from '../../logic/upgrades'
import { useAppStore } from '../../store/appStore'
import type { Upgrade, UpgradeEffect } from '../../types/game'
import { tierBonusText, tierLabel, tierTooltip, upgradeLabel, upgradeTooltip, upgradeValue } from './upgradeText'

/** Ce que change chaque effet dans l'application. */
const EFFECT_HINT: Record<UpgradeEffect, string> = {
  growthSpeed: 'sert au calcul des growth stages',
  plantYield: 'affiché seulement',
  plotLimit: 'greenhouses 2 et 3, comptés dans les Ethereal Vines',
}

/** Vitre de chaque état, comme dans le jeu : verte, jaune, rouge. */
const PANE: Record<TierState, PaneColor> = { unlocked: 'lime', next: 'yellow', locked: 'red' }

const MAIN_ROWS = 3
const TIERS_ROWS = 5
const at = (row: number, column: number) => row * MC_COLUMNS + column

/**
 * Menu « Greenhouse Upgrades » à la manière du jeu : un upgrade par case, puis ses tiers en
 * vitres colorées. Growth Speed règle la durée des stages, Plot Limit les greenhouses achetés
 * (même état que les Ethereal Vines), Plant Yield est gardé pour l'affichage.
 */
export function GreenhouseUpgrades() {
  const data = getGameData()
  const { menu, items } = data.mechanics.greenhouseUpgrades
  const growthUpgrades = useAppStore((s) => s.settings.growth.upgrades)
  const setGrowth = useAppStore((s) => s.setGrowth)
  const vines = useAppStore((s) => s.tools.vines)
  const setVines = useAppStore((s) => s.setVines)
  const storedTiers = useAppStore((s) => s.tools.upgradeTiers)
  const setUpgradeTier = useAppStore((s) => s.setUpgradeTier)
  const [openId, setOpenId] = useState<string | null>(null)
  const itemButtons = useRef(new Map<string, HTMLButtonElement>())
  const firstTierButton = useRef<HTMLButtonElement | null>(null)
  const lastOpened = useRef<string | null>(null)

  // Clavier : le focus va au 1er tier à l'ouverture, et revient sur l'upgrade au retour.
  useEffect(() => {
    if (openId) firstTierButton.current?.focus()
    else if (lastOpened.current) itemButtons.current.get(lastOpened.current)?.focus()
  }, [openId])

  const tierOf = (upgrade: Upgrade): number => {
    switch (upgrade.effect) {
      case 'growthSpeed':
        return tierFromTotal(upgrade, growthUpgrades * 100)
      case 'plotLimit':
        return plotLimitTier(data, vines)
      case 'plantYield':
        return Math.min(upgrade.tiers.length, storedTiers[upgrade.id] ?? 0)
    }
  }

  const setTier = (upgrade: Upgrade, tier: number) => {
    switch (upgrade.effect) {
      case 'growthSpeed':
        setGrowth({ upgrades: cumulativeBonus(upgrade, tier).value / 100 })
        break
      case 'plotLimit':
        setVines(withPlotLimitTier(data, vines, tier))
        break
      case 'plantYield':
        setUpgradeTier(upgrade.id, tier)
        break
    }
  }

  // Lignes propres à Plot Limit : le greenhouse débloqué et son prix en Ethereal Vines.
  const extraLines = (upgrade: Upgrade, tier: number): string[] => {
    if (upgrade.effect !== 'plotLimit') return []
    const price = vineProgress(data, vines).purchases[tier - 1]?.price
    return [`§7Débloque le greenhouse ${tier + 1}`, ...(price ? [`§7Prix : §d${price} Ethereal Vines`] : [])]
  }

  if (items.length === 0) return null
  const open = items.find((upgrade) => upgrade.id === openId) ?? null

  const mainSlots = new Map<number, ReactNode>()
  const itemColumns = spreadColumns(items.length)
  items.forEach((upgrade, index) => {
    const tier = tierOf(upgrade)
    mainSlots.set(
      at(1, itemColumns[index] ?? index),
      <McSlot
        icon={<McItem name={upgrade.icon} />}
        count={tier}
        tooltip={upgradeTooltip(upgrade, tier)}
        label={upgradeLabel(upgrade, tier)}
        onClick={() => {
          lastOpened.current = upgrade.id
          setOpenId(upgrade.id)
        }}
        onButtonRef={(element) => {
          if (element) itemButtons.current.set(upgrade.id, element)
          else itemButtons.current.delete(upgrade.id)
        }}
      />,
    )
  })

  const tiersSlots = (upgrade: Upgrade): Map<number, ReactNode> => {
    const current = tierOf(upgrade)
    const columns = spreadColumns(upgrade.tiers.length)
    const slots = new Map<number, ReactNode>()
    slots.set(at(0, 4), <McSlot icon={<McItem name={upgrade.icon} />} count={current} />)
    upgrade.tiers.forEach((_, index) => {
      const tier = index + 1
      const state = tierState(tier, current)
      slots.set(
        at(2, columns[index] ?? index),
        <McSlot
          pane={PANE[state]}
          count={tier}
          tooltip={tierTooltip(upgrade, tier, current, state, extraLines(upgrade, tier))}
          label={tierLabel(upgrade, tier, state)}
          onClick={() => setTier(upgrade, clickedTier(current, tier))}
          onButtonRef={
            tier === 1
              ? (element) => {
                  firstTierButton.current = element
                }
              : undefined
          }
        />,
      )
    })
    slots.set(
      at(4, 4),
      <McSlot
        icon={<McItem name="Arrow" />}
        tooltip={['§aRetour', `§7Vers ${menu}`]}
        label={`Retour au menu ${menu}`}
        onClick={() => setOpenId(null)}
      />,
    )
    return slots
  }

  return (
    <Panel title="Upgrades du Greenhouse">
      {/* Une fenêtre par menu (key) : ses cases repartent de zéro, comme un nouvel écran dans le jeu. */}
      <div className="overflow-x-auto pb-1">
        {open ? (
          <McWindow
            key={open.id}
            title={open.menu}
            rows={TIERS_ROWS}
            slots={tiersSlots(open)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpenId(null)
            }}
          />
        ) : (
          <McWindow key="main" title={menu} rows={MAIN_ROWS} slots={mainSlots} />
        )}
      </div>

      {open ? (
        <OpenUpgradeSummary upgrade={open} tier={tierOf(open)} />
      ) : (
        <>
          <dl className="mt-3 space-y-1 text-sm">
            {items.map((upgrade) => (
              <div key={upgrade.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt>
                  {upgrade.name} <span className="text-xs text-ink-muted">({EFFECT_HINT[upgrade.effect]})</span>
                </dt>
                <dd className="ml-auto tabular-nums">
                  tier {tierOf(upgrade)}/{upgrade.tiers.length} · {upgradeValue(upgrade, tierOf(upgrade))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-muted">Clique sur un upgrade pour choisir ton tier.</p>
        </>
      )}
    </Panel>
  )
}

/** Résumé écrit du sous-menu ouvert (lu aussi par les lecteurs d'écran à chaque changement). */
function OpenUpgradeSummary({ upgrade, tier }: { readonly upgrade: Upgrade; readonly tier: number }) {
  const max = upgrade.tiers.length
  const next = tier + 1
  return (
    <div className="mt-3 space-y-1">
      <p aria-live="polite" className="text-sm">
        {upgrade.name} : tier {tier}/{max} · {upgradeValue(upgrade, tier)}
      </p>
      <p className="text-xs text-ink-muted">
        {next <= max
          ? `Prochain tier (${romanNumeral(next)}) : ${tierBonusText(upgrade, next) ?? 'bonus inconnu'}. `
          : 'Tous les tiers sont débloqués. '}
        Clique sur un tier pour le régler ; recliquer le dernier le retire. Échap ou la flèche pour revenir.
      </p>
    </div>
  )
}
