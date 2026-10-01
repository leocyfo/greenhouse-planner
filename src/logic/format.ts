import { tr } from '../i18n/locale'

/**
 * Durée lisible : « 45s », « 12m 05s », « 1h 44m 20s », « 3j 04h 12m » (« 3d 04h 12m » en anglais).
 * Les secondes sont tronquées ; au-delà d'un jour, elles ne sont plus affichées.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return '∞'
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  if (days > 0) return `${days}${tr('j', 'd')} ${pad(hours)}h ${pad(minutes)}m`
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(rest)}s`
  if (minutes > 0) return `${minutes}m ${pad(rest)}s`
  return `${rest}s`
}
