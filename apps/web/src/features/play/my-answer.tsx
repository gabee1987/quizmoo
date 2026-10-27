import type { Answer, PlayerSnapshot } from '@quizmoo/shared'
import { ClockIcon, HashIcon, TimerIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RoundChip } from '@/components/round-chip'
import { cn } from '@/lib/cn'
import { lengthMinutes } from '@/lib/game-length'
import { OptionSymbol } from '../../components/icons'
import { optionFill, optionVars } from '../../components/option-colours'
import { stagger } from '../../lib/motion'

/**
 * What the player sent: the answer in its option colours and symbols as on the buttons, how long
 * it took and which question it was. Shown from the answer until the next question (also in the
 * reveal). Says nothing about whether it is right.
 */
export function MyAnswer({ snapshot, answer }: { snapshot: PlayerSnapshot; answer: Answer }) {
  const { t, i18n } = useTranslation()
  const question = snapshot.question ?? snapshot.reveal?.question ?? null
  const options = question && 'options' in question ? question.options : []
  const symbols = snapshot.settings.answerSymbols
  const option = (id: string) => {
    const index = options.findIndex((o) => o.id === id)
    return { index, text: options[index]?.text ?? id }
  }
  let chips: { index: number; text: string }[] | null = null
  let ordered: string[] | null = null
  let text: string | null = null
  switch (answer.type) {
    case 'single':
    case 'poll':
      chips = [option(answer.optionId)]
      break
    case 'multiple':
      chips = answer.optionIds.map(option).sort((a, b) => a.index - b.index)
      break
    case 'truefalse':
      // The buttons' order: true first.
      chips = [{ index: answer.value ? 0 : 1, text: answer.value ? t('play.true') : t('play.false') }]
      break
    case 'order':
      ordered = answer.optionIds.map((id) => option(id).text)
      break
    case 'text':
      text = answer.value
      break
    case 'number':
      text = new Intl.NumberFormat(i18n.language).format(answer.value)
      break
  }
  const seconds =
    snapshot.myAnswerTimeMs === null
      ? null
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(snapshot.myAnswerTimeMs / 1000)

  return (
    <div role="group" aria-label={t('play.yourAnswer')} className="flex w-full max-w-sm flex-col items-center gap-3">
      <h2 className="animate-fade-up text-sm font-bold tracking-wide text-muted-foreground uppercase" style={stagger(1, 0, 150)}>
        {t('play.yourAnswer')}
      </h2>
      {chips && (
        <ul className="flex w-full flex-col gap-2">
          {chips.map((chip, i) => (
            <li
              key={chip.index}
              style={{ ...optionVars(Math.max(chip.index, 0)), ...stagger(i, 70, 220) }}
              className={cn('flex animate-pop items-center gap-3 rounded-2xl px-5 py-4 text-left text-2xl font-black wrap-break-word shadow-soft', optionFill)}
            >
              <OptionSymbol symbols={symbols} index={Math.max(chip.index, 0)} className="size-7 shrink-0" />
              <span className="min-w-0">{chip.text}</span>
            </li>
          ))}
        </ul>
      )}
      {ordered && (
        <ol className="flex w-full flex-col gap-1.5">
          {ordered.map((item, i) => (
            <li
              key={item + i}
              style={stagger(i, 70, 220)}
              className="flex animate-pop items-center gap-3 rounded-xl border-2 bg-card px-4 py-2 text-left text-lg font-bold wrap-break-word"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground tabular-nums">{i + 1}</span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      )}
      {text !== null && (
        <p
          className="w-full animate-pop rounded-2xl border-2 border-primary bg-secondary px-5 py-4 text-2xl font-black wrap-break-word text-secondary-foreground"
          style={stagger(1, 0, 220)}
        >
          {text}
        </p>
      )}
      <div className="flex animate-fade-up flex-wrap justify-center gap-2 text-sm font-semibold" style={stagger(1, 0, 300)}>
        {seconds !== null && (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <TimerIcon className="size-4" aria-hidden="true" />
            {t('play.answeredIn', { seconds })}
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
          <HashIcon className="size-4" aria-hidden="true" />
          {t('play.questionOf', { index: snapshot.questionIndex + 1, count: snapshot.questionCount })}
        </span>
        {/* While the question runs; between questions the progress card says it. */}
        {snapshot.phase === 'question' && snapshot.estimatedLeftSec > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <ClockIcon className="size-4" aria-hidden="true" />
            {t('common.aboutMinLeft', { count: lengthMinutes(snapshot.estimatedLeftSec) })}
          </span>
        )}
        {/* The reveal shows its round on top. */}
        {snapshot.phase === 'question' && <RoundChip group={snapshot.group} className="bg-muted py-1 font-semibold text-foreground" />}
      </div>
    </div>
  )
}
