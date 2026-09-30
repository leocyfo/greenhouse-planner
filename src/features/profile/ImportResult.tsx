import { useId, useState } from 'react'
import { CropLabel } from '../../components/game/CropLabel'
import { getGameData } from '../../data'
import type { InventoryImport } from '../../logic/hypixel/inventory'
import { useAppStore } from '../../store/appStore'
import { sourceList, sourcesText } from './importText'
import type { PlayerProfile, PlayerProfiles } from './profileApi'

export interface FetchedProfile {
  readonly profile: PlayerProfile
  readonly content: InventoryImport
}

interface ImportResultProps {
  readonly player: PlayerProfiles['player']
  readonly profiles: readonly FetchedProfile[]
  readonly onImported: (summary: string) => void
  readonly onSearchAgain: () => void
  readonly onCancel: () => void
}

const BUTTON = 'rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-panel-raised'
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

/** Choix du profil, aperçu des mutations trouvées (avant → après), puis remplacement du stock. */
export function ImportResult({ player, profiles, onImported, onSearchAgain, onCancel }: ImportResultProps) {
  const data = getGameData()
  const selectId = useId()
  const inventory = useAppStore((s) => s.progress.inventory)
  const savedProfileId = useAppStore((s) => s.settings.player.profileId)
  const importInventory = useAppStore((s) => s.importInventory)
  const setPlayer = useAppStore((s) => s.setPlayer)
  const [profileId, setProfileId] = useState(
    () =>
      (profiles.find((p) => p.profile.id === savedProfileId) ?? profiles.find((p) => p.profile.selected) ?? profiles[0])
        ?.profile.id ?? '',
  )
  const [keepMissing, setKeepMissing] = useState(false)
  const chosen = profiles.find((p) => p.profile.id === profileId) ?? profiles[0]

  if (!chosen) {
    return (
      <div className="space-y-4">
        <p>{player.name} n&apos;a aucun profil SkyBlock (ou Hypixel ne les montre pas).</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSearchAgain} className={BUTTON}>
            Chercher un autre joueur
          </button>
          <button type="button" onClick={onCancel} className={BUTTON}>
            Fermer
          </button>
        </div>
      </div>
    )
  }

  const { profile, content } = chosen
  const found = new Set(content.mutations.map((m) => m.mutationId))
  const zeroed = data.mutations.filter((m) => !found.has(m.id) && (inventory[m.id] ?? 0) > 0)
  const totalItems = content.mutations.reduce((sum, m) => sum + m.total, 0)
  // Sans inventaire, Hypixel ne montre rien : importer viderait le stock à tort.
  const hidden = content.missingSources.includes('inventory')
  const notRead = content.missingSources.filter((source) => source !== 'inventory')

  const confirm = () => {
    importInventory(Object.fromEntries(content.mutations.map((m) => [m.mutationId, m.total])), keepMissing)
    setPlayer({ name: player.name, profileId: profile.id })
    onImported(
      `Stock mis à jour depuis le profil ${profile.name} de ${player.name} : ${plural(content.mutations.length, 'mutation')}, ${plural(totalItems, 'exemplaire')}.`,
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          Joueur : <strong>{player.name}</strong>
        </p>
        {profiles.length > 1 ? (
          <label htmlFor={selectId} className="flex items-center gap-2">
            Profil
            <select
              id={selectId}
              value={profile.id}
              onChange={(event) => setProfileId(event.target.value)}
              className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink"
            >
              {profiles.map(({ profile: option }) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.selected ? ' (actif)' : ''}
                  {option.gameMode ? ` · ${option.gameMode}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>
            Profil : <strong>{profile.name}</strong>
          </p>
        )}
      </div>

      {hidden ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning">
          Hypixel ne montre pas l&apos;inventaire de ce profil : active l&apos;« Inventory API » dans les réglages API de
          SkyBlock, attends quelques minutes, puis réessaie.
        </p>
      ) : content.mutations.length === 0 ? (
        <p className="text-ink-muted">Aucune mutation trouvée dans ce profil.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {content.mutations.map((m) => {
            const before = inventory[m.mutationId] ?? 0
            return (
              <li
                key={m.mutationId}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-md border border-line bg-canvas/60 px-2.5 py-1.5"
              >
                <CropLabel crop={{ kind: 'mutation', id: m.mutationId }} />
                <span className="ml-auto text-xs text-ink-muted">{sourcesText(m.sources)}</span>
                <span className="w-24 text-right font-mono tabular-nums">
                  {before !== m.total && <span className="text-ink-muted">{before} → </span>}
                  <span className="font-bold text-accent-strong">{m.total}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {!hidden && (
        <div className="space-y-1.5 text-xs text-ink-muted">
          <p>
            {plural(content.mutations.length, 'mutation')} trouvée{content.mutations.length > 1 ? 's' : ''},{' '}
            {plural(totalItems, 'exemplaire')}.
            {notRead.length > 0 && ` Absents du profil : ${sourceList(notRead)}.`}
            {content.unreadableSources.length > 0 && ` Illisibles : ${sourceList(content.unreadableSources)}.`}
          </p>
          <p>Les coffres de ton île et la grille du greenhouse ne sont pas visibles par l&apos;API Hypixel.</p>
          {zeroed.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={keepMissing}
                onChange={(event) => setKeepMissing(event.target.checked)}
                className="size-4 accent-accent"
              />
              Garder mon stock pour les mutations non trouvées ({plural(zeroed.length, 'mutation')} passerai
              {zeroed.length > 1 ? 'ent' : 't'} sinon à 0)
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={hidden}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-canvas transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 motion-safe:active:scale-[0.97]"
        >
          Remplacer mon stock
        </button>
        <button type="button" onClick={onSearchAgain} className={BUTTON}>
          Chercher un autre joueur
        </button>
        <button type="button" onClick={onCancel} className={BUTTON}>
          Annuler
        </button>
      </div>
    </div>
  )
}
