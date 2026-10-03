import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'
import { formatDuration } from '../../logic/format'
import type { ChapterView } from './guideModel'

const days = (count: number) => tr(`${count} j`, `${count}d`)

/** Durée courte, pour une pastille : « 4 j 10 h », « 17 h 23 min », « 40 min ». */
function shortDuration(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60))
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return tr(`${d} j ${h} h`, `${d}d ${h}h`)
  if (h > 0) return tr(`${h} h ${String(m).padStart(2, '0')}`, `${h}h ${String(m).padStart(2, '0')}m`)
  return tr(`${m} min`, `${m}m`)
}

/** Pastille de durée des fermes (la plus longue), au moins : rien quand il n'y a plus rien à obtenir. */
export function FarmTimeChip({ views }: { readonly views: readonly ChapterView[] }) {
  const longest = views.reduce((best, view) => (view.timing.stages > best.stages ? view.timing : best), { stages: 0, seconds: 0 })
  if (longest.stages === 0) return null
  return (
    <span
      title={tr(`Au moins ${longest.stages} growth stages`, `At least ${longest.stages} growth stages`)}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-canvas/60 px-3 text-sm"
    >
      <span aria-hidden="true">⏱</span>
      <strong className="tabular-nums">{shortDuration(longest.seconds)}</strong>
      <span className="text-xs text-ink-muted">{tr('au moins', 'at least')}</span>
    </span>
  )
}

/** Decay de ce qui est posé dans chaque ferme ; en rouge quand la ferme dure plus longtemps. */
export function FarmDecay({ views }: { readonly views: readonly ChapterView[] }) {
  const data = getGameData()
  const name = (id: string) => data.mutationsById.get(id)?.name ?? id
  const shown = views.filter((view) => view.timing.decays.length > 0)
  if (shown.length === 0) return null
  return (
    <div className="space-y-1 text-xs text-ink-muted">
      {shown.map(({ chapter, timing }) => (
        <div key={chapter.id}>
          <p>
            <span aria-hidden="true">☠ </span>
            {views.length > 1 ? `${chapter.title} · ` : ''}
            {tr('Decay : ', 'Decay: ')}
            {timing.decays.map((decay) => `${name(decay.mutationId)} ${decay.days === null ? tr('jamais', 'never') : days(decay.days)}`).join(' · ')}
          </p>
          {timing.tooLong && timing.firstDecay && (
            <p className="font-medium text-danger">
              {tr(
                `⚠ La ferme dure plus que la decay de ${name(timing.firstDecay.mutationId)} (${days(timing.firstDecay.days)}) : il faudra la replanter.`,
                `⚠ The farm lasts longer than the decay of ${name(timing.firstDecay.mutationId)} (${days(timing.firstDecay.days)}): it will need replanting.`,
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Durée de chaque ferme (minimum, d'après les growth stages et la durée d'un stage) et decay de ce
 * qu'on y pose ; en rouge quand ce qui est posé meurt avant la fin.
 */
export function FarmTimingInfo({ views }: { readonly views: readonly ChapterView[] }) {
  return (
    <section className="space-y-2 rounded-lg bg-canvas/40 px-3 py-2 text-sm">
      {views.map(({ chapter, timing }) => (
        <p key={chapter.id}>
          {views.length > 1 && <strong>{chapter.title} — </strong>}
          <span aria-hidden="true">⏱ </span>
          {tr('Durée : ', 'Time: ')}
          {timing.stages === 0 ? (
            <span className="text-ink-muted">{tr('plus rien à obtenir', 'nothing left to get')}</span>
          ) : (
            <>
              <strong className="tabular-nums">{formatDuration(timing.seconds)}</strong>
              <span className="text-ink-muted">{tr(` au moins (${timing.stages} growth stages)`, ` at least (${timing.stages} growth stages)`)}</span>
            </>
          )}
        </p>
      ))}
      <FarmDecay views={views} />
    </section>
  )
}
