import { Modal } from '../../components/Modal'
import { getGameData } from '../../data'
import { useAppStore } from '../../store/appStore'
import { useGoalPlan } from '../../store/useGoalPlan'
import { mutationState } from '../encyclopedia/graphModel'
import { MutationDetails } from '../encyclopedia/MutationDetails'

interface MutationDialogProps {
  readonly mutationId: string
  readonly onClose: () => void
  /** Ouvre la fiche d'une autre mutation (lien vers un ingrédient). */
  readonly onSelect: (mutationId: string) => void
}

/** Fiche complète d'une mutation dans une petite fenêtre (la fiche de l'Encyclopédie). */
export function MutationDialog({ mutationId, onClose, onSelect }: MutationDialogProps) {
  const data = getGameData()
  const inventory = useAppStore((s) => s.progress.inventory)
  const { plan } = useGoalPlan()
  const mutation = data.mutationsById.get(mutationId)
  if (!mutation) return null
  const need = plan.needs.get(mutation.id)
  return (
    <Modal onClose={onClose} width="max-w-5xl">
      <MutationDetails
        mutationId={mutation.id}
        state={mutationState(data, mutation, need, inventory)}
        need={need}
        onClose={onClose}
        onSelect={onSelect}
      />
    </Modal>
  )
}
