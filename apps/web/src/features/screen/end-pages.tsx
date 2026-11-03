import { LEADERBOARD_ROWS, LEADERBOARD_SET_MS, type EndFactQuestion, type HostSnapshot, type RevealInfo } from '@quizmoo/shared'
import { CrownIcon, ListChecksIcon, type LucideIcon, PercentIcon, SparklesIcon, TimerIcon, UsersIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CountUp } from '@/components/count-up'
import { DistributionBars } from '@/components/distribution-bars'
import { PlayerAvatar } from '@/components/player-avatar'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'
import { awardKinds, useAwardValue, useLength } from '../play/end-facts'
import { CorrectAnswer } from '../questions/correct-answer'
import { medalColours } from './podium'

interface LeaderRow {
  id: string
  name: string
  avatar: string | null
  rank: number
  score: number
  /** Right answers (players) or members (teams). */
  detail: string
}

/** Everyone (teams in team mode), twelve at a time, rising row by row from the bottom. */
export function EndLeaderboard({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  const rows: LeaderRow[] =
    host.mode === 'team'
      ? host.teams.map((team) => ({ ...team, detail: t('screen.end.members', { count: team.memberCount }) }))
      : host.players.map((player) => ({ ...player, detail: t('screen.end.right', { count: player.correctCount }) }))
  const sets = Math.max(1, Math.ceil(rows.length / LEADERBOARD_ROWS))
  const [set, setSet] = useState(0)
  // A long board turns over by itself, also between the host's clicks.
  useEffect(() => {
    if (sets < 2) return
    const timer = setInterval(() => setSet((s) => (s + 1) % sets), LEADERBOARD_SET_MS)
    return () => clearInterval(timer)
  }, [sets])
  const from = (set % sets) * LEADERBOARD_ROWS
  const shown = rows.slice(from, from + LEADERBOARD_ROWS)
  // Up to six rows in one wide column, more in two (top to bottom, then the second column).
  const twoColumns = shown.length > LEADERBOARD_ROWS / 2
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="animate-pop text-6xl font-black">{t('screen.end.leaderboardTitle')}</h1>
        {sets > 1 && (
          <p className="text-3xl font-bold text-muted-foreground tabular-nums">
            {t('screen.end.rows', { from: from + 1, to: from + shown.length, count: rows.length })}
          </p>
        )}
      </div>
      <ol
        key={set}
        className={cn('grid flex-1 content-center gap-4', twoColumns ? 'lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-6' : 'mx-auto w-full max-w-5xl')}
      >
        {shown.map((row, i) => (
          <li
            key={row.id}
            className={cn(
              'flex min-w-0 animate-rise items-center gap-4 rounded-2xl border bg-card px-5 py-3 shadow-soft',
              row.rank === 1 && 'border-2 border-warning',
            )}
            // From the bottom up: the last row first.
            style={stagger(shown.length - 1 - i, 90, 150)}
          >
            <span
              className={cn(
                'grid size-14 shrink-0 place-items-center rounded-xl text-3xl font-black tabular-nums',
                medalColours[row.rank - 1] ?? 'bg-secondary text-secondary-foreground',
              )}
            >
              {row.rank}
            </span>
            <PlayerAvatar avatar={row.avatar} size="lg" />
            <span className="min-w-0 flex-1 truncate text-3xl font-black">{row.name}</span>
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xl font-bold text-secondary-foreground">{row.detail}</span>
            <CountUp value={row.score} durationMs={900} delayMs={(shown.length - i) * 90 + 300} className="w-32 shrink-0 text-right text-4xl font-black" />
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The awards, one card after another, each with its winner and figure. */
export function EndAwards({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  const value = useAwardValue()
  const facts = host.endFacts
  const awards = facts
    ? awardKinds.flatMap(({ kind, icon }) => {
        const award = facts.awards[kind]
        return award ? [{ kind, icon, award, player: host.players.find((p) => p.id === award.playerId) }] : []
      })
    : []
  if (awards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <SparklesIcon className="size-24 animate-pop text-warning" aria-hidden="true" />
        <h1 className="animate-pop text-6xl font-black">{t('play.end.awardsTitle')}</h1>
        <p className="animate-fade-up text-4xl text-foreground">{t('screen.end.noAwards')}</p>
      </div>
    )
  }
  const columns = ['', 'xl:grid-cols-1 xl:max-w-xl xl:mx-auto', 'xl:grid-cols-2', 'xl:grid-cols-3', 'xl:grid-cols-4'][awards.length]
  return (
    <div className="flex flex-1 flex-col gap-8">
      <h1 className="animate-pop text-center text-6xl font-black">{t('play.end.awardsTitle')}</h1>
      <ul className={cn('grid w-full flex-1 content-center gap-6 sm:grid-cols-2', columns)}>
        {awards.map(({ kind, icon: Icon, award, player }, i) => (
          <li
            key={kind}
            className="flex animate-award-in flex-col items-center gap-4 rounded-3xl border-2 border-[color-mix(in_srgb,var(--warning)_70%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_12%,var(--card))] px-6 py-8 text-center shadow-soft"
            // One at a time: each card has the room's attention for a moment.
            style={stagger(i, 1100, 300)}
          >
            <span className="grid size-24 animate-wiggle place-items-center rounded-2xl bg-warning text-warning-foreground shadow-[0_5px_0_color-mix(in_oklch,var(--warning),black_25%)]" style={stagger(i, 1100, 900)}>
              <Icon className="size-14" aria-hidden="true" />
            </span>
            <span className="text-2xl font-extrabold tracking-wide uppercase">{t(`play.end.awards.${kind}`)}</span>
            <PlayerAvatar avatar={player?.avatar} size="xl" />
            <span className="w-full text-4xl font-black wrap-break-word">{player?.name}</span>
            <span className="text-2xl font-bold">{value(kind, award)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One big figure that counts up, with its icon and label. */
function BigFigure({ icon: Icon, label, children, index }: { icon: LucideIcon; label: string; children: ReactNode; index: number }) {
  return (
    <div className="flex animate-pop flex-col items-center gap-3 rounded-3xl border bg-card px-6 py-8 text-center shadow-soft" style={stagger(index, 150, 200)}>
      <span className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground">
        <Icon className="size-9" aria-hidden="true" />
      </span>
      <span className="text-7xl font-black tabular-nums">{children}</span>
      <span className="text-2xl font-bold text-muted-foreground">{label}</span>
    </div>
  )
}

/** The hardest or easiest question, with a bar for the share of the room that got it right. */
function BigQuestionFact({ label, question, tone, index }: { label: string; question: EndFactQuestion; tone: string; index: number }) {
  const { t } = useTranslation()
  const percent = Math.round(question.correctShare * 100)
  return (
    <div
      className="flex animate-fade-up flex-col gap-4 rounded-3xl border-2 border-[color-mix(in_srgb,var(--tone)_60%,var(--border))] bg-[color-mix(in_srgb,var(--tone)_10%,var(--card))] p-6"
      style={{ ...stagger(index, 150, 200), ['--tone' as string]: tone }}
    >
      <div className="flex items-center gap-3 text-2xl font-bold text-muted-foreground">
        <span className="font-extrabold tracking-wide uppercase">{label}</span>
        <span className="flex-1" />
        <span>{t('results.questionNumber', { index: question.index + 1 })}</span>
      </div>
      <p className="line-clamp-2 text-4xl leading-tight font-black wrap-break-word">{question.text}</p>
      <div className="flex items-center gap-4">
        <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full origin-left animate-grow-x rounded-full bg-(--tone)" style={{ width: `${percent}%`, ...stagger(index, 150, 600) }} />
        </div>
        <span className="text-3xl font-black tabular-nums">{t('play.end.percentRight', { percent })}</span>
      </div>
    </div>
  )
}

/** The room's figures: questions, players, share right, length; the hardest and easiest question. */
export function EndFactsPage({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  const length = useLength()
  const facts = host.endFacts
  if (!facts) return null
  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <h1 className="animate-pop text-center text-6xl font-black">{t('play.end.factsTitle')}</h1>
      <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
        <BigFigure icon={ListChecksIcon} label={t('play.end.questions')} index={0}>
          <CountUp value={facts.questionCount} durationMs={1200} delayMs={300} />
        </BigFigure>
        <BigFigure icon={UsersIcon} label={t('play.end.players')} index={1}>
          <CountUp value={facts.playerCount} durationMs={1200} delayMs={450} />
        </BigFigure>
        {facts.averageCorrectShare !== null && (
          <BigFigure icon={PercentIcon} label={t('play.end.rightOnAverage')} index={2}>
            <CountUp value={Math.round(facts.averageCorrectShare * 100)} durationMs={1200} delayMs={600} />%
          </BigFigure>
        )}
        {facts.lengthMs !== null && (
          <BigFigure icon={TimerIcon} label={t('play.end.length')} index={3}>
            {length(facts.lengthMs)}
          </BigFigure>
        )}
      </div>
      {(facts.hardest || facts.easiest) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {facts.hardest && <BigQuestionFact label={t('play.end.hardest')} question={facts.hardest} tone="var(--destructive)" index={4} />}
          {facts.easiest && <BigQuestionFact label={t('play.end.easiest')} question={facts.easiest} tone="var(--success)" index={5} />}
        </div>
      )}
      {facts.closestFinish !== null && (
        <p className="flex animate-fade-up items-center justify-center gap-3 text-3xl font-bold" style={stagger(6, 150, 200)}>
          <CrownIcon className="size-9 text-warning" aria-hidden="true" />
          {facts.closestFinish === 0 ? t('play.end.tieAtTop') : t('play.end.closestFinish', { count: facts.closestFinish })}
        </p>
      )}
    </div>
  )
}

/** The recap: one asked question at a time with its answer bars, as in the reveal. */
export function EndRecap({ host }: { host: HostSnapshot }) {
  return host.endShow && host.recap ? <RecapSlide host={host} show={host.endShow} reveal={host.recap} /> : null
}

function RecapSlide({
  host,
  show,
  reveal,
}: {
  host: HostSnapshot
  show: NonNullable<HostSnapshot['endShow']>
  reveal: RevealInfo
}) {
  const { t, i18n } = useTranslation()
  const index = show.recapIndex
  const { question } = reveal
  const symbols = host.settings.answerSymbols
  const averageMs = host.questionStats[index]?.averageTimeMs ?? null
  // A right answer to count: not a poll, and not text nobody graded right.
  const scored = question.type !== 'poll' && reveal.correctKeys.length > 0
  const percent = host.players.length > 0 ? Math.round((reveal.correctCount / host.players.length) * 100) : 0
  const verdict = question.type === 'poll' ? 'poll' : percent >= 80 ? 'easy' : percent >= 50 ? 'most' : percent >= 20 ? 'tricky' : 'hard'
  const tone = percent >= 50 ? 'var(--success)' : percent >= 20 ? 'var(--warning)' : 'var(--destructive)'
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  return (
    <div className="grid flex-1 items-stretch gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* The question: its number as a badge, the text, the picture and the right answer stamped below. */}
      <section className="flex min-w-0 animate-pop flex-col gap-6 rounded-3xl border bg-card p-8 shadow-soft">
        <div className="flex items-center gap-4">
          <span className="grid size-20 shrink-0 animate-wiggle place-items-center rounded-2xl bg-primary text-5xl font-black text-primary-foreground shadow-[0_5px_0_var(--primary-edge)] tabular-nums">
            {index + 1}
          </span>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-wide text-muted-foreground uppercase">{t('screen.end.recapEyebrow')}</span>
            <span className="text-2xl font-bold tabular-nums">{t('screen.end.recapHeading', { index: index + 1, count: show.recapCount })}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-8">
          <h1 className="line-clamp-4 text-5xl leading-tight font-black wrap-break-word">{question.text}</h1>
          {question.imageId && (
            <img src={`/api/images/${question.imageId}`} alt="" className="max-h-[30vh] self-start rounded-2xl object-contain shadow-soft" />
          )}
          {question.type !== 'poll' && (
            <div
              className="animate-award-in self-start rounded-2xl border-2 border-[color-mix(in_srgb,var(--success)_60%,var(--border))] bg-[color-mix(in_srgb,var(--success)_12%,var(--card))] px-6 py-4"
              style={stagger(0, 0, 500)}
            >
              <CorrectAnswer question={question} symbols={symbols} large />
            </div>
          )}
        </div>
      </section>

      {/* How the room did: the share right in a ring with a word about it, the answers, the figures. */}
      <section className="flex min-w-0 animate-pop flex-col gap-6 rounded-3xl border bg-card p-8 shadow-soft" style={stagger(1, 0, 150)}>
        <div className="flex items-center gap-6">
          {scored && (
            <div
              className="grid size-36 shrink-0 animate-pop place-items-center rounded-full"
              style={{ background: `conic-gradient(${tone} ${percent}%, var(--muted) 0)`, ...stagger(0, 0, 350) }}
            >
              <span className="grid size-26 place-items-center rounded-full bg-card text-4xl font-black tabular-nums">
                <span>
                  <CountUp value={percent} durationMs={1000} delayMs={450} />%
                </span>
              </span>
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="animate-pop text-4xl font-black" style={stagger(0, 0, 700)}>
              {t(`screen.end.verdict.${verdict}`)}
            </p>
            {scored && <p className="text-2xl font-semibold text-muted-foreground">{t('screen.end.gotItRight', { percent })}</p>}
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center">
          <DistributionBars reveal={reveal} symbols={symbols} large />
        </div>
        <ul className="flex flex-wrap gap-3">
          <li className="flex animate-fade-up items-center gap-2 rounded-full bg-secondary px-5 py-2 text-2xl font-bold text-secondary-foreground" style={stagger(0, 120, 900)}>
            <UsersIcon className="size-6" aria-hidden="true" />
            {t('results.answered', { answered: reveal.answeredCount, count: host.players.length })}
          </li>
          {averageMs !== null && (
            <li className="flex animate-fade-up items-center gap-2 rounded-full bg-secondary px-5 py-2 text-2xl font-bold text-secondary-foreground" style={stagger(1, 120, 900)}>
              <TimerIcon className="size-6" aria-hidden="true" />
              {t('results.averageTime', { seconds: seconds.format(averageMs / 1000) })}
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
