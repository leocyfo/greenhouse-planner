import { tr } from '../../i18n/locale'
import type { ChapterStatus } from './guideModel'

const STATUS_STYLE: Record<ChapterStatus, string> = {
  done: 'bg-accent/15 text-accent-strong',
  placed: 'bg-sky-400/15 text-sky-300',
  ready: 'bg-warning/15 text-warning',
  missing: 'bg-white/5 text-ink-muted',
}

/** État d'une ferme du guide : faite, en cours (et où), prête à poser, ou il manque des mutations. */
export function StatusBadge({ status, placedIn = [] }: { readonly status: ChapterStatus; readonly placedIn?: readonly number[] }) {
  const where = placedIn.map((index) => index + 1).join(', ')
  const text =
    status === 'done'
      ? tr('✓ Faite', '✓ Done')
      : status === 'placed'
        ? tr(`En cours · Greenhouse ${where}`, `Running · Greenhouse ${where}`)
        : status === 'ready'
          ? tr('Prête à poser', 'Ready to place')
          : tr('Il manque des mutations', 'Mutations missing')
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}>{text}</span>
}
