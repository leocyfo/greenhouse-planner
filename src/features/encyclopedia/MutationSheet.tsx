import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { McItem } from '../../components/minecraft/McItem'
import { McSlot } from '../../components/minecraft/McSlot'
import { McText } from '../../components/minecraft/McText'
import { NumberStepper } from '../../components/NumberStepper'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { recipeInputs, recipesUsing, type RecipeInput } from '../../logic/graph'
import { cropSide } from '../../logic/grid'
import { plantingPreview } from '../../logic/plantingPreview'
import type { MutationNeed } from '../../logic/recipes'
import { useAppStore } from '../../store/appStore'
import type { CropRef } from '../../types/game'
import { showInEncyclopedia } from './encyclopediaFocus'
import type { MutationState } from './graphModel'
import { coloredName, cropName, infoLines, ingredientTooltip, spotTooltip, wikiUrl } from './sheetText'
import { STATE_INFO } from './stateInfo'

type SheetTab = 'garden' | 'info'

interface MutationSheetProps {
  readonly mutationId: string
  readonly state: MutationState
  readonly need: MutationNeed | undefined
  readonly onClose: () => void
  /** Ouvre la fiche d'une autre mutation (ingrédient, flèches). */
  readonly onSelect: (mutationId: string) => void
}

const sameCrop = (a: CropRef, b: CropRef) =>
  a.kind === 'mutation' ? b.kind === 'mutation' && a.id === b.id : b.kind === 'base' && a.name === b.name

interface PlotSlotProps {
  readonly x: number
  readonly y: number
  /** Côté du crop en cases : l'objet couvre toute son empreinte. */
  readonly side: number
  readonly tint: 'spot' | 'ingredient'
  readonly name: string
  readonly tooltip: readonly string[]
  readonly label: string
  readonly onClick?: () => void
}

/** Crop de la plantation, teinté (emplacement ou ingrédient), à l'échelle de son empreinte. */
function PlotSlot({ x, y, side, tint, name, tooltip, label, onClick }: PlotSlotProps) {
  // Un crop 2x2 ou 3x3 est une case agrandie : pixel d'interface multiplié par son côté.
  const style = {
    gridColumn: `${x + 1} / span ${side}`,
    gridRow: `${y + 1} / span ${side}`,
    '--mc-px': `calc(var(--mc-unit) * ${side})`,
    '--mc-slot': `calc(var(--mc-unit) * ${side * 18})`,
  } as CSSProperties
  return (
    <div className="relative z-[1]" style={style}>
      <McSlot
        icon={
          <>
            <span aria-hidden="true" className={`mc-tint mc-tint--${tint}`} />
            <McItem name={name} />
          </>
        }
        tooltip={tooltip}
        label={label}
        onClick={onClick}
      />
    </div>
  )
}

/**
 * Fiche d'une mutation (dans une Modal, voir inventory/MutationDialog), à la manière du menu
 * « Garden Mutation » du jeu : deux onglets (la plantation, les infos), les flèches pour passer à
 * la mutation voisine, le bouton W du wiki. Sous la fenêtre : stock, analyse, besoin et calcul.
 */
export function MutationSheet({ mutationId, state, need, onClose, onSelect }: MutationSheetProps) {
  const data = getGameData()
  const titleId = useId()
  const tabsId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [tab, setTab] = useState<SheetTab>('garden')
  const owned = useAppStore((s) => s.progress.inventory[mutationId] ?? 0)
  const analyzed = useAppStore((s) => s.progress.analyzed.includes(mutationId))
  const setOwned = useAppStore((s) => s.setOwned)
  const setAnalyzed = useAppStore((s) => s.setAnalyzed)
  const mutation = data.mutationsById.get(mutationId)
  const preview = useMemo(() => (mutation ? plantingPreview(data, mutation) : null), [data, mutation])

  // Le focus va sur le nom à l'ouverture (lecteurs d'écran, clavier) ; Échap ferme la fiche.
  useEffect(() => {
    headingRef.current?.focus()
  }, [mutationId])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!mutation) return null
  const index = data.mutations.findIndex((m) => m.id === mutationId)
  const step = (delta: number) => {
    const next = data.mutations[(index + delta + data.mutations.length) % data.mutations.length]
    if (next) onSelect(next.id)
  }
  const inputs = recipeInputs(data, mutation)
  const others = inputs.filter((input) => input.relation !== 'condition')
  const inputFor = (crop: CropRef): RecipeInput | undefined => inputs.find((input) => input.relation === 'condition' && sameCrop(input.crop, crop))
  const openCrop = (crop: CropRef) => (crop.kind === 'mutation' ? () => onSelect(crop.id) : undefined)
  const complete = need?.missing === 0
  const panelId = `${tabsId}-panel`

  const tabs: { readonly id: SheetTab; readonly icon: string; readonly label: string }[] = [
    { id: 'garden', icon: 'Seeds', label: tr('Plantation', 'Planting') },
    { id: 'info', icon: 'Plant Diagnostics Tool', label: tr('Infos', 'Info') },
  ]

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
      className="mx-auto flex max-h-[calc(100dvh-1rem)] w-max max-w-full flex-col overflow-y-auto sm:max-h-[calc(100dvh-3rem)]"
    >
      {/* Rien autour de la fenêtre du jeu : ses onglets au-dessus, la fermeture à droite. */}
      <div className="mc flex items-end justify-between">
        <div role="tablist" aria-label={tr('Vues de la fiche', 'Sheet views')} className="mc-tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabsId}-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={panelId}
              aria-label={item.label}
              title={item.label}
              onClick={() => setTab(item.id)}
              className="mc-tab"
            >
              <McItem name={item.icon} />
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label={tr('Fermer la fiche', 'Close the sheet')} className="mc-button mc-close">
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="mc mc-window mc-sheet">
        <div className="mc-titlebar">
          <button type="button" onClick={() => step(-1)} aria-label={tr('Mutation précédente', 'Previous mutation')} className="mc-button">
            <span aria-hidden="true">◀</span>
          </button>
          <p className="mc-title">{tab === 'garden' ? 'Garden Mutation' : 'SkyBlock Info'}</p>
          <button type="button" onClick={() => step(1)} aria-label={tr('Mutation suivante', 'Next mutation')} className="mc-button">
            <span aria-hidden="true">▶</span>
          </button>
        </div>

        <div id={panelId} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="mc-inset">
          <div className="mc-sheet-head">
            <McSlot
              icon={<McItem name={mutation.surface} />}
              tooltip={[`§f${mutation.surface}`, `§7${tr("Sol de l'emplacement", 'Soil of the spot')}`]}
              label={tr(`Sol : ${mutation.surface}`, `Soil: ${mutation.surface}`)}
            />
            <h3 id={titleId} ref={headingRef} tabIndex={-1} className="mc-sheet-name">
              <McText text={coloredName(data, { kind: 'mutation', id: mutation.id })} />
            </h3>
            <a
              href={wikiUrl(mutation.name)}
              target="_blank"
              rel="noreferrer"
              title={tr('Ouvrir le wiki', 'Open the wiki')}
              aria-label={tr(`${mutation.name} sur le wiki (nouvel onglet)`, `${mutation.name} on the wiki (new tab)`)}
              className="mc-button"
            >
              W
            </a>
          </div>

          {/* Une clé par mutation et par onglet : le contenu arrive en fondu. */}
          <div key={`${mutationId}-${tab}`} className="animate-fade-in">
            {tab === 'garden' ? (
              <>
                {preview ? (
                  <div
                    role="group"
                    aria-label={tr(`Exemple de plantation : ${mutation.name} au centre`, `Planting example: ${mutation.name} in the center`)}
                    className="mc-plot"
                    style={{ gridTemplateColumns: `repeat(${preview.width}, var(--mc-slot))` }}
                  >
                    {Array.from({ length: preview.width * preview.height }, (_, cell) => (
                      <div key={cell} style={{ gridColumn: (cell % preview.width) + 1, gridRow: Math.floor(cell / preview.width) + 1 }}>
                        <McSlot />
                      </div>
                    ))}
                    <PlotSlot
                      x={preview.target.x}
                      y={preview.target.y}
                      side={preview.target.side}
                      tint="spot"
                      name={mutation.name}
                      tooltip={spotTooltip(data, mutation)}
                      label={tr(`${mutation.name}, l'emplacement`, `${mutation.name}, the spot`)}
                    />
                    {preview.placements.map((placement) => {
                      const input = inputFor(placement.crop)
                      const name = cropName(data, placement.crop)
                      return (
                        <PlotSlot
                          key={`${placement.x}-${placement.y}`}
                          x={placement.x}
                          y={placement.y}
                          side={cropSide(data, placement.crop)}
                          tint="ingredient"
                          name={name}
                          tooltip={input ? ingredientTooltip(data, input) : [coloredName(data, placement.crop)]}
                          label={tr(`${name}, ingrédient`, `${name}, ingredient`)}
                          onClick={openCrop(placement.crop)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="mc-lore">
                    <p>
                      <McText text={`§7${mutation.specialCondition ?? tr('Condition spéciale : voir les infos.', 'Special condition: see the info.')}`} defaultColor="7" />
                    </p>
                  </div>
                )}
                {others.length > 0 && (
                  <div className="mc-row" role="group" aria-label={tr('Aussi nécessaires', 'Also needed')}>
                    {others.map((input) => {
                      const name = cropName(data, input.crop)
                      return (
                        <McSlot
                          key={`${input.relation}-${name}`}
                          icon={<McItem name={name} />}
                          count={input.units}
                          countFrom={1}
                          tooltip={ingredientTooltip(data, input)}
                          label={tr(`${name} : ${input.units}`, `${name}: ${input.units}`)}
                          onClick={openCrop(input.crop)}
                        />
                      )
                    })}
                  </div>
                )}
                <p className="mc-hint">{tr("Survole une case pour plus d'infos", 'Hover a slot for more info')}</p>
              </>
            ) : (
              <div className="mc-lore">
                {infoLines(data, mutation, {
                  stateLabel: `${STATE_INFO[state].icon} ${STATE_INFO[state].label}`,
                  usedIn: recipesUsing(data, mutationId),
                  goals: data.goals.filter((goal) => goal.mutations.some((r) => r.mutationId === mutationId)),
                  bestiary: data.bestiary.filter((entry) => entry.mutationId === mutationId),
                }).map((line, lineIndex) => (
                  // Ligne vide : une espace insécable, pour qu'elle garde sa hauteur.
                  <p key={lineIndex}>{line ? <McText text={line} defaultColor="7" /> : ' '}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dans la fenêtre, au style du jeu : stock, analyse, besoin et calcul. */}
        <div className="mc-controls">
          <span className="mc-control">
            <span aria-hidden="true">{tr('En stock', 'In stock')}</span>
            <NumberStepper value={owned} onChange={(count) => setOwned(mutationId, count)} name={mutation.name} variant="mc" />
          </span>
          <label className="mc-control">
            <input type="checkbox" checked={analyzed} onChange={(event) => setAnalyzed(mutationId, event.target.checked)} className="mc-check" />
            {tr('Analysée', 'Analyzed')}
          </label>
          <span className={`mc-control ${need ? (complete ? 'mc-need--done' : 'mc-need--missing') : ''}`}>
            {need
              ? complete
                ? `✓ ${owned} / ${need.required}`
                : tr(`Besoin ${owned} / ${need.required}`, `Need ${owned} / ${need.required}`)
              : tr('Pas demandée', 'Not requested')}
          </span>
          <button type="button" onClick={() => showInEncyclopedia(mutationId)} className="mc-button mc-button--wide">
            {tr('Calculer', 'Calculate')}
            <span className="sr-only"> {mutation.name}</span>
          </button>
        </div>
        <p className="mc-page">
          {index + 1}/{data.mutations.length}
        </p>
      </div>
    </div>
  )
}
