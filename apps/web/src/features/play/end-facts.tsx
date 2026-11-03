import type { EndAward, EndFactQuestion, EndFacts, PlayerPublic } from '@quizmoo/shared'
import { CrownIcon, FlameIcon, type LucideIcon, TargetIcon, TrendingUpIcon, ZapIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CountUp } from '@/components/count-up'
import { PlayerAvatar } from '@/components/player-avatar'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'

export type AwardKind = keyof EndFacts['awards']

/** The awards in the order they are shown, with their icon; the texts are `play.end.awards.<kind>`. */
export const awardKinds: { kind: AwardKind; icon: LucideIcon }[] = [
  { kind: 'fastest', icon: ZapIcon },
  { kind: 'longestStreak', icon: FlameIcon },
  { kind: 'mostCorrect', icon: TargetIcon },
  { kind: 'biggestClimb', icon: TrendingUpIcon },
]

/** The award's figure as text: "1.2 s on question 3", "4 right in a row". */
export function useAwardValue(): (kind: AwardKind, award: EndAward) => string {
  const { t, i18n } = useTranslation()
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  return (kind, award) =>
    kind === 'fastest'
      ? t('play.end.awards.fastestValue', { seconds: seconds.format(award.value / 1000), index: (award.questionIndex ?? 0) + 1 })
      : t(`play.end.awards.${kind}Value`, { count: award.value })
}

/** A game length as "12 min", or seconds when under a minute. */
export function useLength(): (ms: number) => string {
  const { t } = useTranslation()
  return (ms) => (ms < 60_000 ? t('play.end.seconds', { count: Math.round(ms / 1000) }) : t('play.end.minutes', { count: Math.round(ms / 60_000) }))
}

function Figure({ label, children, index }: { label: string; children: ReactNode; index: number }) {
  return (
    <div className="flex animate-pop flex-col items-center justify-center gap-0.5 rounded-2xl border bg-card p-3 text-center shadow-soft" style={stagger(index, 90, 150)}>
      <span className="text-3xl font-black tabular-nums">{children}</span>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
    </div>
  )
}

/** The hardest or easiest question: its number, text and a bar for the share who got it right. */
function QuestionFact({ label, question, tone, index }: { label: string; question: EndFactQuestion; tone: string; index: number }) {
  const { t } = useTranslation()
  const percent = Math.round(question.correctShare * 100)
  return (
    <div
      className="flex animate-fade-up flex-col gap-2 rounded-2xl border-2 border-[color-mix(in_srgb,var(--tone)_60%,var(--border))] bg-[color-mix(in_srgb,var(--tone)_10%,var(--card))] p-4"
      style={{ ...stagger(index, 90, 150), ['--tone' as string]: tone }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-extrabold tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="flex-1" />
        <span className="text-sm font-bold text-muted-foreground">{t('results.questionNumber', { index: question.index + 1 })}</span>
      </div>
      <p className="line-clamp-3 text-lg leading-snug font-black wrap-break-word">{question.text}</p>
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full origin-left animate-grow-x rounded-full bg-(--tone)" style={{ width: `${percent}%`, ...stagger(index, 90, 450) }} />
        </div>
        <span className="text-sm font-extrabold tabular-nums">{t('play.end.percentRight', { percent })}</span>
      </div>
    </div>
  )
}

/** One award: its icon, title, the winner and the figure; the viewer's own award stands out. */
function AwardCard({ kind, icon: Icon, award, player, mine, index }: {
  kind: AwardKind
  icon: LucideIcon
  award: EndAward
  player: PlayerPublic | undefined
  mine: boolean
  index: number
}) {
  const { t } = useTranslation()
  const value = useAwardValue()
  return (
    <li
      className={cn(
        'flex animate-pop items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft',
        mine && 'border-2 border-primary bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))]',
      )}
      style={stagger(index, 120, 300)}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-warning text-warning-foreground shadow-[0_3px_0_color-mix(in_oklch,var(--warning),black_25%)]">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-extrabold tracking-wide text-muted-foreground uppercase">{t(`play.end.awards.${kind}`)}</span>
        <span className="flex items-center gap-2 font-black">
          <PlayerAvatar avatar={player?.avatar} />
          <span className="truncate">{player?.name}</span>
        </span>
        <span className="text-sm font-semibold">{value(kind, award)}</span>
      </div>
      {mine && (
        <span className="shrink-0 animate-pop rounded-full bg-primary px-2.5 py-1 text-xs font-black text-primary-foreground" style={stagger(index, 120, 700)}>
          {t('play.end.thatsYou')}
        </span>
      )}
    </li>
  )
}

/** The third end-of-game page: the room's figures, the hardest and easiest question, and the awards. */
export function FactsPage({ facts, players, meId }: { facts: EndFacts; players: PlayerPublic[]; meId: string }) {
  const { t } = useTranslation()
  const length = useLength()
  const awards = awardKinds.flatMap(({ kind, icon }) => {
    const award = facts.awards[kind]
    return award ? [{ kind, icon, award }] : []
  })
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-center text-3xl font-black">{t('play.end.factsTitle')}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Figure label={t('play.end.questions')} index={0}>
          <CountUp value={facts.questionCount} />
        </Figure>
        <Figure label={t('play.end.players')} index={1}>
          <CountUp value={facts.playerCount} />
        </Figure>
        {facts.averageCorrectShare !== null && (
          <Figure label={t('play.end.rightOnAverage')} index={2}>
            <CountUp value={Math.round(facts.averageCorrectShare * 100)} />%
          </Figure>
        )}
        {facts.lengthMs !== null && (
          <Figure label={t('play.end.length')} index={3}>
            {length(facts.lengthMs)}
          </Figure>
        )}
      </div>
      {facts.hardest && <QuestionFact label={t('play.end.hardest')} question={facts.hardest} tone="var(--destructive)" index={4} />}
      {facts.easiest && <QuestionFact label={t('play.end.easiest')} question={facts.easiest} tone="var(--success)" index={5} />}
      {awards.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-center text-xl font-extrabold">{t('play.end.awardsTitle')}</h2>
          <ul className="flex flex-col gap-3">
            {awards.map(({ kind, icon, award }, i) => (
              <AwardCard
                key={kind}
                kind={kind}
                icon={icon}
                award={award}
                player={players.find((p) => p.id === award.playerId)}
                mine={award.playerId === meId}
                index={i + 6}
              />
            ))}
          </ul>
        </section>
      )}
      {facts.closestFinish !== null && (
        <p className="flex items-center justify-center gap-2 text-center font-bold text-muted-foreground">
          <CrownIcon className="size-5 text-warning" aria-hidden="true" />
          {facts.closestFinish === 0 ? t('play.end.tieAtTop') : t('play.end.closestFinish', { count: facts.closestFinish })}
        </p>
      )}
    </div>
  )
}
