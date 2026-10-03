import type { GuideChapter } from '../../types/game'

/** Mises en garde des fermes (données : `warning`), en rouge pour que le joueur les voie (Chorus Fruit). */
export function FarmWarning({ chapters }: { readonly chapters: readonly GuideChapter[] }) {
  const warned = chapters.filter((chapter) => chapter.warning)
  if (warned.length === 0) return null
  return (
    <div role="note" className="space-y-1 rounded-lg border border-danger/60 bg-danger/15 px-3 py-2 text-sm font-medium text-danger">
      {warned.map((chapter) => (
        <p key={chapter.id}>
          <span aria-hidden="true">⚠ </span>
          {chapter.warning}
        </p>
      ))}
    </div>
  )
}
