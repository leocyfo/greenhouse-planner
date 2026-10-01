/** Badges d'une mutation : sol, taille, growth stages et récolte anticipée. */
import { soilBackground } from '../../theme/palette'
import { tr } from '../../i18n/locale'
import type { Mutation } from '../../types/game'
import { Badge } from '../Badge'
import { plural } from '../labels'
import { Tooltip } from '../Tooltip'
import { harvestHint } from './harvestHint'

export function SoilBadge({ surface }: { readonly surface: string }) {
  return (
    <Badge swatch={soilBackground(surface)}>
      <span className="sr-only">{tr('Sol : ', 'Soil: ')}</span>
      {surface}
    </Badge>
  )
}

export function SizeBadge({ size }: { readonly size: string }) {
  return (
    <Badge>
      <span className="sr-only">{tr('Taille : ', 'Size: ')}</span>
      {size}
    </Badge>
  )
}

export function StagesBadge({ stages }: { readonly stages: number | null }) {
  return <Badge>{stages === null ? tr('stages inconnus', 'unknown stages') : plural(stages, 'stage')}</Badge>
}

/** Récolte avant la fin de la croissance (Magic Jellybean, Glasscorn, All-in Aloe). */
export function HarvestBadge({ mutation }: { readonly mutation: Mutation }) {
  const hint = harvestHint(mutation)
  const stage = mutation.harvest?.recommendedStage ?? mutation.harvest?.firstStage
  if (!hint || stage === undefined || stage === null) return null
  return (
    <Tooltip
      label={tr(`récolte : stage ${stage}`, `harvest: stage ${stage}`)}
      content={hint}
      className="inline-flex items-center whitespace-nowrap rounded-md border border-line bg-panel-raised px-2 py-0.5 text-xs text-ink underline decoration-dotted underline-offset-2"
    />
  )
}
