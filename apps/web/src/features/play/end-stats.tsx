import type { MyEndFacts, PlayerQuestionResult } from '@quizmoo/shared'
import { CheckCheckIcon, FlameIcon, type LucideIcon, TimerIcon, ZapIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { stagger } from '@/lib/motion'

function Tile({ icon: Icon, label, children, note, index }: { icon: LucideIcon; label: string; children: ReactNode; note?: string | undefined; index: number }) {
  return (
    <div className="flex animate-pop flex-col gap-1 rounded-2xl border bg-card p-3 shadow-soft" style={stagger(index, 90, 150)}>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </span>
      <span className="text-3xl font-black tabular-nums">{children}</span>
      {note && <span className="text-xs font-semibold text-muted-foreground">{note}</span>}
    </div>
  )
}

const W = 320
const H = 120
const PAD = { top: 12, right: 30, bottom: 22, left: 30 }

/** The player's rank after each question as a line, first place at the top. */
function RankLine({ ranks }: { ranks: number[] }) {
  const { t } = useTranslation()
  const worst = Math.max(2, ...ranks)
  const x = (i: number) => PAD.left + (ranks.length > 1 ? (i / (ranks.length - 1)) * (W - PAD.left - PAD.right) : (W - PAD.left - PAD.right) / 2)
  const y = (rank: number) => PAD.top + ((rank - 1) / (worst - 1)) * (H - PAD.top - PAD.bottom)
  const points = ranks.map((rank, i) => `${x(i)},${y(rank)}`).join(' ')
  const last = ranks.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('play.end.rankLineLabel', { ranks: ranks.join(', ') })}>
      {/* First and last place lines: recessive guides. */}
      {[1, worst].map((rank) => (
        <g key={rank}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(rank)} y2={y(rank)} className="stroke-border" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(rank)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-[11px] font-bold">
            {rank}.
          </text>
        </g>
      ))}
      <text x={x(0)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px] font-bold">1</text>
      {last > 0 && (
        <text x={x(last)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px] font-bold">{last + 1}</text>
      )}
      <polyline points={points} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {ranks.map((rank, i) => (
        <circle key={i} cx={x(i)} cy={y(rank)} r={i === last ? 5 : 2.5} className="fill-primary stroke-card" strokeWidth={2}>
          <title>{t('play.end.rankAfter', { index: i + 1, rank })}</title>
        </circle>
      ))}
      <text x={x(last) + 9} y={y(ranks[last]!)} dy="0.35em" className="fill-foreground text-[13px] font-black">
        {ranks[last]}.
      </text>
    </svg>
  )
}

/** Points per question as bars from the baseline; right answers in the success colour. */
function PointsBars({ results }: { results: PlayerQuestionResult[] }) {
  const { t } = useTranslation()
  const most = Math.max(1, ...results.map((r) => r.points))
  return (
    <div className="flex h-28 items-end gap-0.5" role="img" aria-label={t('play.end.pointsLabel', { points: results.map((r) => r.points).join(', ') })}>
      {results.map((result, i) => (
        <div
          key={result.question.id}
          title={t('play.end.pointsOn', { index: i + 1, count: result.points })}
          className="min-w-0 flex-1 origin-bottom animate-grow-y rounded-t-[4px] bg-success"
          style={{ height: `${Math.max(result.points > 0 ? 6 : 0, (result.points / most) * 100)}%`, ...stagger(i, 30, 300) }}
        />
      ))}
    </div>
  )
}

/** The last end-of-game page: the player's own figures and how their game went question by question. */
export function StatsPage({ facts, results, questionCount }: { facts: MyEndFacts; results: PlayerQuestionResult[]; questionCount: number }) {
  const { t, i18n } = useTranslation()
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const right = results.filter((r) => r.correct === true).length
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-center text-3xl font-black">{t('play.end.statsTitle')}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Tile icon={CheckCheckIcon} label={t('play.end.rightAnswers')} index={0}>
          {t('play.end.ofCount', { value: right, count: questionCount })}
        </Tile>
        <Tile icon={FlameIcon} label={t('play.end.bestStreak')} index={1}>
          {facts.bestStreak}
        </Tile>
        <Tile icon={TimerIcon} label={t('play.end.averageTime')} index={2}>
          {facts.averageTimeMs === null ? '–' : t('play.end.secondsShort', { seconds: seconds.format(facts.averageTimeMs / 1000) })}
        </Tile>
        <Tile
          icon={ZapIcon}
          label={t('play.end.fastestAnswer')}
          note={facts.fastest ? t('results.questionNumber', { index: facts.fastest.index + 1 }) : undefined}
          index={3}
        >
          {facts.fastest ? t('play.end.secondsShort', { seconds: seconds.format(facts.fastest.timeMs / 1000) }) : '–'}
        </Tile>
      </div>
      {facts.rankAfter.length > 1 && (
        <section className="flex animate-fade-up flex-col gap-2 rounded-2xl border bg-card p-4 shadow-soft" style={stagger(4, 90, 150)}>
          <h2 className="font-extrabold">{t('play.end.rankJourney')}</h2>
          <RankLine ranks={facts.rankAfter} />
        </section>
      )}
      {results.length > 1 && (
        <section className="flex animate-fade-up flex-col gap-2 rounded-2xl border bg-card p-4 shadow-soft" style={stagger(5, 90, 150)}>
          <h2 className="font-extrabold">{t('play.end.pointsPerQuestion')}</h2>
          <PointsBars results={results} />
          <div className="flex justify-between text-xs font-bold text-muted-foreground">
            <span>1</span>
            <span>{results.length}</span>
          </div>
        </section>
      )}
    </div>
  )
}
