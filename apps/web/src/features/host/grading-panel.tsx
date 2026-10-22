import type { CurrentAnswer, HostSnapshot } from '@quizmoo/shared'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface Group {
  key: string
  /** The first player's spelling, shown as the group label. */
  label: string
  answers: CurrentAnswer[]
}

/**
 * Grading of a text question without accepted answers. Answers are grouped by their
 * normalised text, so "Győr", "gyor" and " GYŐR" are one toggle.
 */
export function GradingPanel({ host, onGrade }: { host: HostSnapshot; onGrade: (correctPlayerIds: string[]) => void }) {
  const { t } = useTranslation()
  const [correct, setCorrect] = useState<Set<string>>(new Set())
  const groups = useMemo(() => {
    const byKey = new Map<string, Group>()
    for (const answer of host.currentAnswers ?? []) {
      const group = byKey.get(answer.key)
      if (group) group.answers.push(answer)
      else byKey.set(answer.key, { key: answer.key, label: answer.answer.type === 'text' ? answer.answer.value : answer.key, answers: [answer] })
    }
    return [...byKey.values()].sort((a, b) => b.answers.length - a.answers.length)
  }, [host.currentAnswers])

  const toggle = (key: string) =>
    setCorrect((current) => {
      const nextSet = new Set(current)
      if (nextSet.has(key)) nextSet.delete(key)
      else nextSet.add(key)
      return nextSet
    })

  const apply = () =>
    onGrade(groups.filter((g) => correct.has(g.key)).flatMap((g) => g.answers.map((a) => a.playerId)))

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-warning bg-card p-4 shadow-soft">
      <h2 className="text-lg font-extrabold">{t('host.grading.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('host.grading.help')}</p>
      {groups.length === 0 && <p className="text-muted-foreground">{t('host.grading.noAnswers')}</p>}
      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.key}>
            <label
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 transition-colors ${correct.has(group.key) ? 'border-success bg-success text-success-foreground' : 'bg-card hover:border-ring'}`}
            >
              <Checkbox
                checked={correct.has(group.key)}
                onCheckedChange={() => toggle(group.key)}
                className="border-current data-[state=checked]:border-success-foreground data-[state=checked]:bg-success-foreground data-[state=checked]:text-success"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold wrap-break-word">{group.label}</span>
                <span className="block text-xs opacity-80 wrap-break-word">{group.answers.map((a) => a.name).join(', ')}</span>
              </span>
              <span className="tabular-nums">×{group.answers.length}</span>
            </label>
          </li>
        ))}
      </ul>
      <Button size="lg" onClick={apply}>
        {t('host.grading.apply')}
      </Button>
    </section>
  )
}
