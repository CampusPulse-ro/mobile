import { Screen } from '@/components/ui'
import { DeadlineForm } from '@/deadlines/DeadlineForm'

/** Adding a deadline of the student's own. */
export default function NewDeadlineScreen() {
  return (
    <Screen>
      <DeadlineForm />
    </Screen>
  )
}
