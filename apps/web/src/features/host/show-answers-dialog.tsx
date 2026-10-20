import type { HostCommand, HostSnapshot } from '@quizmoo/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChoiceCards } from '@/components/choice-cards'
import { FormDialog } from '@/components/form-dialog'
import { Checkbox } from '@/components/ui/checkbox'

type Pick = 'last' | 'all' | 'choose'

/**
 * "Show answers": the host puts the answers of closed questions on the projector and the phones,
 * the last one, all so far, or the ones ticked, whatever the quiz's reveal setting. They are shown
 * one at a time; the control bar steps through them.
 */
export function ShowAnswersDialog({
  host,
  onCommand,
  onClose,
}: {
  host: HostSnapshot
  onCommand: (command: HostCommand) => Promise<boolean>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const questions = host.questionStats
  const last = questions[questions.length - 1]
  const [pick, setPick] = useState<Pick>('last')
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(last ? [last.index] : []))
  const [pending, setPending] = useState(false)
  if (!last) return null

  const indexes = pick === 'last' ? [last.index] : pick === 'all' ? questions.map((q) => q.index) : [...chosen]
  const toggle = (index: number) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <FormDialog
      title={t('host.showAnswers.title')}
      description={<p>{t('host.showAnswers.help')}</p>}
      submitLabel={t('host.showAnswers.submit', { count: indexes.length })}
      pending={pending}
      disabled={indexes.length === 0}
      error={null}
      onCancel={onClose}
      onSubmit={() => {
        setPending(true)
        void onCommand({ type: 'showAnswers', indexes }).then((ok) => {
          setPending(false)
          if (ok) onClose()
        })
      }}
    >
      <ChoiceCards
        legend={t('host.showAnswers.which')}
        value={pick}
        columns={1}
        onChange={setPick}
        choices={[
          { value: 'last', label: t('host.showAnswers.last'), description: t('host.showAnswers.question', { index: last.index + 1, text: last.text }) },
          { value: 'all', label: t('host.showAnswers.all'), description: t('host.showAnswers.allHelp', { count: questions.length }) },
          { value: 'choose', label: t('host.showAnswers.choose'), description: t('host.showAnswers.chooseHelp') },
        ]}
      />
      {pick === 'choose' && (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border p-1.5" aria-label={t('host.showAnswers.choose')}>
          {questions.map((question) => (
            <li key={question.questionId}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-muted">
                <Checkbox className="mt-0.5" checked={chosen.has(question.index)} onCheckedChange={() => toggle(question.index)} />
                <span className="min-w-0 flex-1 text-sm font-semibold wrap-break-word">
                  {t('host.showAnswers.question', { index: question.index + 1, text: question.text })}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </FormDialog>
  )
}
