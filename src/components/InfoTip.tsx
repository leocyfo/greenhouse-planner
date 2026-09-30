import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'

interface InfoTipProps {
  /** Sujet de l'explication, pour le nom accessible (« Explication : … »). */
  readonly topic: string
  readonly children: ReactNode
}

/** Petite icône ⓘ qui ouvre une explication. */
export function InfoTip({ topic, children }: InfoTipProps) {
  return (
    <Tooltip
      label={<span aria-hidden="true">ⓘ</span>}
      ariaLabel={`Explication : ${topic}`}
      content={children}
      className="inline-flex size-5 items-center justify-center rounded-full text-sm text-ink-muted hover:text-ink"
    />
  )
}
