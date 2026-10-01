import { useEffect, useId, useRef } from 'react'
import { goToTab } from '../../app/navigation'
import { BestiaryLine } from '../../components/game/BestiaryLine'
import { CropLabel } from '../../components/game/CropLabel'
import { HarvestBadge } from '../../components/game/MutationBadges'
import { WikiIcon } from '../../components/game/WikiIcon'
import { formatNumber, formatRarity } from '../../components/labels'
import { NumberStepper } from '../../components/NumberStepper'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { recipeInputs, recipesUsing, type RecipeUse } from '../../logic/graph'
import type { MutationNeed } from '../../logic/recipes'
import { useAppStore } from '../../store/appStore'
import { rarityColor, soilBackground } from '../../theme/palette'
import type { CropRef } from '../../types/game'
import { DetailRow, FieldChip, Section, StatChip } from './detailParts'
import type { MutationState } from './graphModel'
import { PlantingPreview } from './PlantingPreview'
import { STATE_INFO } from './stateInfo'

interface MutationDetailsProps {
  readonly mutationId: string
  readonly state: MutationState
  readonly need: MutationNeed | undefined
  readonly onClose: () => void
  /** Ouvre la fiche d'une autre mutation (ingrédient, recette). */
  readonly onSelect: (mutationId: string) => void
}

const DIALOG_CLASS =
  'flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-line bg-panel-solid shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-3rem)]'

/** Ce qu'une recette fait de la mutation : « 6 à poser », « 1 consommé », « 1 en catalyseur ». */
function recipeUseText(use: RecipeUse): string {
  switch (use.relation) {
    case 'condition':
      return tr(`${use.units} à poser`, `${use.units} to place`) + (use.cells !== use.units ? tr(` (${use.cells} cases)`, ` (${use.cells} cells)`) : '')
    case 'consumed':
      return tr(`${use.units} consommé`, `${use.units} consumed`)
    case 'catalyst':
      return tr(`${use.units} en catalyseur`, `${use.units} as catalyst`)
  }
}

/**
 * Fiche d'une mutation (dans une Modal, voir inventory/MutationDialog), au style du wiki de
 * skymutations.eu, pensée pour tenir sans défiler : en-tête à la couleur de la rareté, une bande
 * (taille, sol, stages, stock, besoin, analyse, « calculer »), puis les sections en colonnes
 * équilibrées par le navigateur, autant que la largeur le permet (une seule sur mobile, où la fiche
 * défile).
 */
export function MutationDetails({ mutationId, state, need, onClose, onSelect }: MutationDetailsProps) {
  const data = getGameData()
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const owned = useAppStore((s) => s.progress.inventory[mutationId] ?? 0)
  const analyzed = useAppStore((s) => s.progress.analyzed.includes(mutationId))
  const setOwned = useAppStore((s) => s.setOwned)
  const setAnalyzed = useAppStore((s) => s.setAnalyzed)
  const calculateOnly = useAppStore((s) => s.calculateOnly)
  const mutation = data.mutationsById.get(mutationId)

  // Le focus va sur le titre à l'ouverture (lecteurs d'écran, clavier) ; Échap ferme la fiche.
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
  const color = rarityColor(mutation.rarity)
  const info = STATE_INFO[state]
  const inputs = recipeInputs(data, mutation)
  const usedIn = recipesUsing(data, mutationId)
  const goals = data.goals.filter((goal) => goal.mutations.some((r) => r.mutationId === mutationId))
  const bestiary = data.bestiary.filter((entry) => entry.mutationId === mutationId)
  const drops = Object.entries(mutation.drops)
  const complete = need?.missing === 0

  const ingredientLink = (crop: CropRef) =>
    crop.kind === 'mutation' ? (
      <button
        type="button"
        onClick={() => onSelect(crop.id)}
        className="underline decoration-line underline-offset-2 hover:decoration-current"
      >
        <CropLabel crop={crop} />
      </button>
    ) : (
      <CropLabel crop={crop} />
    )

  // La fiche porte elle-même role="dialog" (voir components/Modal).
  return (
    <div role="dialog" aria-modal aria-labelledby={titleId} className={DIALOG_CLASS}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span aria-hidden="true" className="h-10 w-1 shrink-0 rounded-full" style={{ background: color }} />
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-canvas">
          <WikiIcon name={mutation.name} size={40} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} ref={headingRef} tabIndex={-1} className="truncate text-lg leading-tight font-bold" style={{ color }}>
            {mutation.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold tracking-wider uppercase">
            <span style={{ color }}>{formatRarity(mutation.rarity)}</span>
            <span className="text-ink-muted">
              · <span aria-hidden="true">{info.icon}</span> {info.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr('Fermer la fiche', 'Close the sheet')}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-panel-raised hover:text-ink"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      {/* Une clé par mutation : en passant à une autre fiche, le contenu repart du haut, en fondu. */}
      <div key={mutationId} className="flex-1 animate-fade-in overflow-y-auto p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatChip label={tr('Taille', 'Size')}>{mutation.size}</StatChip>
          <StatChip label={tr('Sol', 'Soil')}>
            <span
              aria-hidden="true"
              className="size-3 rounded-sm ring-1 ring-white/25"
              style={{ background: soilBackground(mutation.surface), imageRendering: 'pixelated' }}
            />
            {mutation.surface}
          </StatChip>
          <StatChip label="Stages">{mutation.growthStages ?? '?'}</StatChip>
          <HarvestBadge mutation={mutation} />
          <FieldChip label={tr('En stock', 'In stock')}>
            <NumberStepper value={owned} onChange={(count) => setOwned(mutationId, count)} name={mutation.name} />
          </FieldChip>
          <FieldChip label={tr('Besoin', 'Need')}>
            {need ? (
              <>
                <span className={`font-mono text-xs font-bold tabular-nums ${complete ? 'text-accent-strong' : 'text-warning'}`}>
                  {complete && '✓ '}
                  {owned} / {need.required}
                </span>
                <span className={`text-[10px] font-bold tracking-wide uppercase ${complete ? 'text-accent-strong' : 'text-danger'}`}>
                  {complete ? tr('complété', 'complete') : tr(`manque ${need.missing}`, `${need.missing} missing`)}
                  {need.buy ? tr(' · au bazar', ' · at the bazaar') : ''}
                </span>
              </>
            ) : (
              <span className="text-xs text-ink-muted">{tr('pas demandée', 'not requested')}</span>
            )}
          </FieldChip>
          <FieldChip as="label" label={tr('Analysée', 'Analyzed')}>
            <input
              type="checkbox"
              checked={analyzed}
              onChange={(event) => setAnalyzed(mutationId, event.target.checked)}
              className="size-4 accent-accent"
            />
          </FieldChip>
          <button
            type="button"
            onClick={() => {
              calculateOnly(mutationId, Math.max(need?.required ?? 0, 1))
              goToTab('calculateur')
            }}
            className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-bold text-canvas transition hover:bg-accent-strong motion-safe:active:scale-[0.97]"
          >
            {tr('Calculer', 'Calculate')}
            <span className="sr-only"> {mutation.name}</span>
          </button>
        </div>

        {/* Colonnes équilibrées : chaque section reste entière (break-inside: avoid). */}
        <div className="mt-4 columns-[16rem] gap-5">
          <Section title={tr('Conditions de spawn', 'Spawn conditions')}>
            {mutation.specialCondition && mutation.conditions.length === 0 && (
              <p className="mb-2">{mutation.specialCondition}</p>
            )}
            {inputs.length > 0 && (
              <ul className="space-y-1.5">
                {inputs.map((input) => (
                  <DetailRow key={`${input.relation}-${input.crop.kind === 'mutation' ? input.crop.id : input.crop.name}`}>
                    {input.relation === 'condition' && (
                      <>
                        {input.units} × {ingredientLink(input.crop)}
                        {input.cells !== input.units && <span className="text-ink-muted">{tr(`(${input.cells} cases)`, `(${input.cells} cells)`)}</span>}
                        <span className="text-ink-muted">{tr('autour', 'around')}</span>
                      </>
                    )}
                    {input.relation === 'consumed' && (
                      <>
                        {tr('Consomme', 'Consumes')} {input.units} × {ingredientLink(input.crop)} {tr('par exemplaire', 'per copy')}
                      </>
                    )}
                    {input.relation === 'catalyst' && (
                      <>
                        {tr('Avec', 'With')} {input.units} × {ingredientLink(input.crop)}
                        <span className="text-ink-muted">{tr('(catalyseur, non consommé)', '(catalyst, not consumed)')}</span>
                      </>
                    )}
                  </DetailRow>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-muted">{tr(`Sol de l'emplacement : ${mutation.surface}.`, `Spot soil: ${mutation.surface}.`)}</p>
          </Section>

          <PlantingPreview mutation={mutation} />

          <Section title={tr('Effets sur les crops voisins', 'Effects on neighboring crops')}>
            {mutation.effects.length === 0 ? (
              <p className="text-ink-muted">{tr('Aucun effet listé.', 'No effect listed.')}</p>
            ) : (
              <ul className="space-y-1">
                {mutation.effects.map((name) => {
                  const effect = data.effects.get(name)
                  const positive = effect?.type === 'positive'
                  return (
                    <li key={name}>
                      <span className={positive ? 'text-accent-strong' : 'text-danger'}>
                        <span aria-hidden="true">{positive ? '＋' : '−'}</span>
                        <span className="sr-only">
                          {positive ? tr('Effet positif : ', 'Positive effect: ') : tr('Effet négatif : ', 'Negative effect: ')}
                        </span>{' '}
                        {name}
                      </span>
                      {effect && <span className="text-ink-muted"> — {effect.value}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section title="Drops">
            {drops.length === 0 ? (
              <p className="text-ink-muted">{tr('Aucun drop listé.', 'No drop listed.')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {drops.map(([item, amount]) => (
                  <li key={item} className="flex justify-between gap-2">
                    <span>{item}</span>
                    <span className="font-mono tabular-nums text-ink-muted">{formatNumber(amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {(mutation.notes || mutation.avrgNotes) && (
            <Section title={tr('Mécanique spéciale', 'Special mechanic')}>
              {mutation.notes && <p>{mutation.notes}</p>}
              {mutation.avrgNotes && (
                <p className="mt-1.5 text-ink-muted">
                  <span className="font-medium text-ink">{tr('Guide AVRG : ', 'AVRG guide: ')}</span>
                  {mutation.avrgNotes}
                </p>
              )}
            </Section>
          )}

          {bestiary.length > 0 && (
            <Section title="Bestiary">
              <ul className="space-y-1">
                {bestiary.map((entry) => (
                  <li key={entry.mob}>
                    <BestiaryLine entry={entry} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={tr('Sert à', 'Used for')}>
            {usedIn.length === 0 && mutation.usages.length === 0 && goals.length === 0 ? (
              <p className="text-ink-muted">{tr('Aucune recette ni aucun usage connu.', 'No known recipe or use.')}</p>
            ) : (
              <div className="space-y-1.5">
                {usedIn.length > 0 && (
                  <ul className="space-y-1.5">
                    {usedIn.map((use) => (
                      <li key={`recipe-${use.mutationId}`}>
                        <button
                          type="button"
                          onClick={() => onSelect(use.mutationId)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-canvas/60 px-2.5 py-1 text-left transition-colors hover:border-ink-muted/50"
                        >
                          <CropLabel crop={{ kind: 'mutation', id: use.mutationId }} />
                          <span className="shrink-0 text-[11px] text-ink-muted">{recipeUseText(use)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {(mutation.usages.length > 0 || goals.length > 0) && (
                  <ul className="space-y-1.5">
                    {mutation.usages.map((usage) => (
                      <DetailRow key={`usage-${usage.target}`}>
                        {usage.target}
                        <span className="text-ink-muted">
                          ({usage.type}
                          {usage.quantity !== null ? ` × ${usage.quantity}` : tr(', quantité inconnue', ', unknown quantity')})
                        </span>
                      </DetailRow>
                    ))}
                    {goals.map((goal) => (
                      <DetailRow key={`goal-${goal.id}`}>{tr(`Objectif : ${goal.name}`, `Goal: ${goal.name}`)}</DetailRow>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Section>

          <Section title={tr('Route Rose Dragon (guide AVRG)', 'Rose Dragon route (AVRG guide)')}>
            <p>
              Optimum : <span className="font-mono tabular-nums">{mutation.roseDragonOptimum}</span>
              {' · '}Minimum : <span className="font-mono tabular-nums">{mutation.roseDragonMinimum ?? '—'}</span>
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
