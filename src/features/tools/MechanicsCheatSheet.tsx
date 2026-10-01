import type { ReactNode } from 'react'
import { BestiaryLine } from '../../components/game/BestiaryLine'
import { WikiIcon } from '../../components/game/WikiIcon'
import { Panel } from '../../components/Panel'
import { getGameData } from '../../data'
import { tr } from '../../i18n/locale'

function Card({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-canvas/40 p-3">
      <h4 className="mb-1 text-sm font-semibold">{title}</h4>
      <div className="space-y-1 text-sm text-ink-muted">{children}</div>
    </div>
  )
}

/**
 * Aide-mémoire des mécaniques, tiré de mutations.json (wiki et guide AVRG). Le cycle de
 * croissance et les Rosewater flasks sont dans les conseils AVRG, les Ethereal Vines dans leur
 * suivi : ils ne sont pas répétés ici.
 */
export function MechanicsCheatSheet() {
  const { mechanics: m, bestiary } = getGameData()
  return (
    <Panel title={tr('Aide-mémoire des mécaniques', 'Mechanics cheat sheet')}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Lock-in">
          <p>{m.lockIn}</p>
        </Card>
        <Card title={tr(`Decay (~${m.decayDays} jours)`, `Decay (~${m.decayDays} days)`)}>
          <p>{m.decay}</p>
          <p>{m.decayAvrg}</p>
        </Card>
        <Card title={tr('Eau', 'Water')}>
          <p>{tr(`Perte : ${m.water.lossPerStage}.`, `Loss: ${m.water.lossPerStage}.`)}</p>
          <p>{tr(`Niveau : de ${m.water.range}.`, `Level: from ${m.water.range}.`)}</p>
          <p>{m.water.rule}</p>
          <p>{tr(`Bonus : ${m.water.modifiers}.`, `Bonuses: ${m.water.modifiers}.`)}</p>
        </Card>
        <Card title="Harvest Bounty">
          <p>
            {m.harvestBounty.description}
            {tr(' :', ':')}
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-ink">
            {m.harvestBounty.possibleDrops.map((drop) => (
              <li key={drop} className="flex items-center gap-1.5">
                <WikiIcon name={drop} size={20} />
                {drop}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={tr('Analyse', 'Analysis')}>
          <p>{m.analysis}</p>
          <p>{m.analysisAvrg}</p>
          <p>
            {m.bazaarUnlockAfterAnalysis.text}
          </p>
        </Card>
        <Card title="Bestiary">
          <ul className="space-y-1.5">
            {bestiary.map((entry) => (
              <li key={entry.mob}>
                <BestiaryLine entry={entry} showSource />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h4 className="mt-5 mb-2 text-sm font-semibold">{tr('Conseils du guide AVRG', 'Tips from the AVRG guide')}</h4>
      <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {m.tips.map((tip) => (
          <div key={tip.id} className="rounded-lg border border-line bg-canvas/40 p-3">
            <dt className="text-sm font-semibold">{tip.title}</dt>
            <dd className="mt-1 text-sm text-ink-muted">{tip.text}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
