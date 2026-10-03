import { tr } from '../../i18n/locale'
import type { GuideChapter } from '../../types/game'

/**
 * Sur l'étape 1 d'une ferme en plusieurs étapes, en rouge pour que le joueur le voie : quand et
 * comment passer à l'étape suivante (conseil d'AVRG et note du plan de l'étape suivante).
 */
export function NextStageNote({ stage, titled = true }: { readonly stage: GuideChapter; readonly titled?: boolean }) {
  if (!stage.text && !stage.layout.notes) return null
  return (
    <div role="note" className="space-y-1 rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
      <p>
        {titled && <strong>{tr(`Ensuite, ${stage.title} : `, `Then, ${stage.title}: `)}</strong>}
        {stage.text}
      </p>
      {stage.layout.notes && <p className="text-xs">{stage.layout.notes}</p>}
    </div>
  )
}
