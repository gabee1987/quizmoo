import { createFileRoute } from '@tanstack/react-router'
import { LibraryQuestionEditor } from '@/features/bank/library-question-editor'

export const Route = createFileRoute('/host/library/new')({
  component: () => <LibraryQuestionEditor item={null} />,
})
