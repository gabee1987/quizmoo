import type { HostSnapshot, TeamAnswerPublic } from '@quizmoo/shared'
import { CheckCircle2Icon, EyeIcon, EyeOffIcon, HourglassIcon, SlidersHorizontalIcon, WifiOffIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { TypoTag } from '@/components/typo-tag'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { answerProgress } from '@/lib/answer-progress'
import { useMediaQuery } from '@/lib/use-media-query'
import { CheckIcon, CrossIcon } from '../../components/icons'
import { PlayerAvatar } from '../../components/player-avatar'
import { RankArrow } from '../../components/rank-arrow'
import { formatAnswer } from '../questions/format-answer'
import { AnswerChip } from './answer-chip'
import { boardGroups, boardSorts, fitTileSize, tileSizes, type BoardEntry, type BoardGroup, type TileSize as Size } from './board'
import { setBoardOptions, useBoardOptions, type BoardOptions } from './board-options'

/** Tile columns per size, matching `tileMetrics`: big tiles while few play, small ones when the room is full. */
const tileGrid: Record<Size, string> = {
  lg: 'grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2',
  md: 'grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5',
  sm: 'grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1',
}

/** The scroll box's size on a laptop, where the board has a height of its own; null on a phone. */
function useBox(ref: RefObject<HTMLElement | null>, bounded: boolean) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || !bounded) return setBox(null)
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect
      if (rect) setBox({ width: Math.round(rect.width), height: Math.round(rect.height) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, bounded])
  return box
}

/**
 * Every player at a glance, filled in live: who has answered the question on the screens, what
 * (in the option's colour), how fast and whether it is right; between questions their result.
 * Tiles or a list, in the order the host picked; in team mode grouped per team. On a laptop the
 * tiles take the largest size that fits the board.
 */
export function PlayerBoard({ host, className }: { host: HostSnapshot; className?: string }) {
  const { t } = useTranslation()
  const options = useBoardOptions()
  const groups = boardGroups(host, options.sort)
  const grouped = groups.length > 1 || groups[0]?.team != null
  const scroller = useRef<HTMLDivElement>(null)
  // Tailwind's lg: the page's board layout, where the board has a height of its own.
  const box = useBox(scroller, useMediaQuery('(min-width: 64rem)'))
  const estimate = fitTileSize(box, groups.map((g) => g.entries.length), grouped)
  // The estimate can miss by a little (long names on two lines): one size smaller while the tiles overflow.
  const fit = `${estimate}:${box?.width}x${box?.height}:${host.players.length}:${groups.length}:${options.view}`
  const [smaller, setSmaller] = useState({ fit, steps: 0 })
  const steps = smaller.fit === fit ? smaller.steps : 0
  const size = tileSizes[Math.min(tileSizes.length - 1, tileSizes.indexOf(estimate) + steps)]!
  useLayoutEffect(() => {
    const element = scroller.current
    if (box && options.view === 'tiles' && size !== 'sm' && element && element.scrollHeight > element.clientHeight + 1) {
      setSmaller({ fit, steps: steps + 1 })
    }
  }, [box, options.view, size, fit, steps])
  return (
    <section aria-labelledby="board-title" className={cn('flex min-h-0 flex-col gap-2 rounded-2xl border bg-card p-3 shadow-soft', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="board-title" className="text-lg font-extrabold">
          {t('host.board.title')}
        </h2>
        <BoardSummary host={host} />
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            aria-pressed={options.hideAnswers}
            onClick={() => setBoardOptions({ hideAnswers: !options.hideAnswers })}
          >
            {options.hideAnswers ? <EyeIcon aria-hidden="true" /> : <EyeOffIcon aria-hidden="true" />}
            {t(options.hideAnswers ? 'host.board.showAnswers' : 'host.board.hideAnswers')}
          </Button>
          <BoardMenu options={options} />
        </div>
      </div>
      {host.players.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('host.standings.empty')}</p>
      ) : (
        // Relative: screen-reader-only labels further down stay inside the scroll box instead of stretching the page.
        <div ref={scroller} className="relative -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.team?.id ?? 'others'} className="flex flex-col gap-1.5">
                {grouped && <GroupHeader host={host} group={group} hideAnswers={options.hideAnswers} />}
                <ul className={cn('grid', options.view === 'tiles' ? tileGrid[size] : 'grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-x-4')}>
                  {group.entries.map((entry) =>
                    options.view === 'tiles' ? (
                      <Tile key={entry.player.id} host={host} entry={entry} size={size} hideAnswers={options.hideAnswers} />
                    ) : (
                      <Row key={entry.player.id} host={host} entry={entry} hideAnswers={options.hideAnswers} />
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** "5 of 6 answered" while a question runs; right, wrong and missing once it is over. */
function BoardSummary({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  if (host.phase === 'question') {
    const progress = answerProgress(host)
    const share = progress.count > 0 ? (progress.answered / progress.count) * 100 : 0
    return (
      <span className="flex items-center gap-2">
        <span className="font-bold tabular-nums" aria-live="polite">
          {t(progress.teams ? 'host.game.teamsAnswered' : 'host.game.answered', { answered: progress.answered, count: progress.count })}
        </span>
        <span className="h-2 w-24 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className="block h-full rounded-full bg-success transition-[width] duration-500 ease-spring" style={{ width: `${share}%` }} />
        </span>
      </span>
    )
  }
  if (!host.reveal) return null
  const answers = host.currentAnswers ?? []
  const right = answers.filter((a) => a.correct === true).length
  const wrong = answers.filter((a) => a.correct === false).length
  const missing = host.players.length - answers.length
  const scored = host.reveal.question.type !== 'poll' && !host.awaitingGrading
  return (
    <span className="flex flex-wrap items-center gap-x-3 text-sm font-bold tabular-nums">
      {scored && (
        <>
          <span className="inline-flex items-center gap-1 text-success">
            <CheckIcon className="size-4" />
            {t('host.board.rightCount', { count: right })}
          </span>
          <span className="inline-flex items-center gap-1 text-destructive">
            <CrossIcon className="size-4" />
            {t('host.board.wrongCount', { count: wrong })}
          </span>
        </>
      )}
      {!scored && <span>{t('host.game.answered', { answered: answers.length, count: host.players.length })}</span>}
      {missing > 0 && <span className="text-muted-foreground">{t('host.board.missingCount', { count: missing })}</span>}
    </span>
  )
}

/** The board's view options; the menu stays open while the host changes several of them. */
function BoardMenu({ options }: { options: BoardOptions }) {
  const { t } = useTranslation()
  const stayOpen = (event: Event) => event.preventDefault()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-8">
          <SlidersHorizontalIcon aria-hidden="true" />
          {t('host.board.view')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('host.board.showAs')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={options.view} onValueChange={(view) => setBoardOptions({ view: view as BoardOptions['view'] })}>
          <DropdownMenuRadioItem value="tiles" onSelect={stayOpen}>
            {t('host.board.tiles')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list" onSelect={stayOpen}>
            {t('host.board.list')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('host.board.order')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={options.sort} onValueChange={(sort) => setBoardOptions({ sort: sort as BoardOptions['sort'] })}>
          {boardSorts.map((sort) => (
            <DropdownMenuRadioItem key={sort} value={sort} onSelect={stayOpen}>
              {t(`host.board.sort.${sort}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={options.hideAnswers}
          onCheckedChange={(hideAnswers) => setBoardOptions({ hideAnswers })}
          onSelect={stayOpen}
        >
          {t('host.board.hideAnswers')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={options.panels} onCheckedChange={(panels) => setBoardOptions({ panels })} onSelect={stayOpen}>
          {t('host.board.panels')}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * A team's name, how it answers, its one answer (if it answers as one) with who set it, where the
 * team is with it, and how many members have answered.
 */
function GroupHeader({ host, group, hideAnswers }: { host: HostSnapshot; group: BoardGroup; hideAnswers: boolean }) {
  const { t, i18n } = useTranslation()
  const { team } = group
  const teamAnswer: TeamAnswerPublic | undefined = team ? host.teamAnswers?.find((a) => a.teamId === team.id) : undefined
  const question = host.live?.question ?? host.reveal?.question ?? host.question
  const setBy = teamAnswer?.setBy ? host.players.find((p) => p.id === teamAnswer.setBy) : undefined
  // While it runs, captain decides: "Confirmed", or how many have suggested so far (the answer shown is the majority).
  const status =
    !team || host.phase !== 'question'
      ? null
      : team.answerMode === 'captain'
        ? team.answered
          ? t('host.game.teamConfirmed')
          : group.answered > 0
            ? t('host.game.teamSuggesting', { picked: group.answered, count: team.memberCount })
            : null
        : team.answered
          ? t('host.game.teamDone')
          : null
  return (
    <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b pb-1 text-sm">
      <span className="font-extrabold">{team ? team.name : t('play.soloGroup')}</span>
      {team && <span className="text-xs font-semibold text-muted-foreground">{t(`host.create.teamAnswerOptions.${team.answerMode}`)}</span>}
      {teamAnswer?.answer && !hideAnswers && (
        <span className="min-w-0 font-semibold wrap-break-word">
          {t('host.board.teamAnswer', { answer: formatAnswer(teamAnswer.answer, question, t, i18n.language) })}
          {setBy && <span className="text-xs text-muted-foreground"> · {setBy.name}</span>}
          {/* Over without the captain's confirmation: the majority counted. */}
          {host.phase !== 'question' && teamAnswer.fallback && (
            <span className="ml-1.5 text-xs text-muted-foreground">({t('host.game.teamFallback')})</span>
          )}
        </span>
      )}
      {status && <span className="rounded-full bg-secondary px-2 text-xs font-bold text-secondary-foreground">{status}</span>}
      <span className="ml-auto font-bold tabular-nums text-muted-foreground">
        {group.answered}/{group.entries.length}
      </span>
    </h3>
  )
}

/** What a tile or row shows of a player's answer; `hideAnswers` keeps it to answered or not. */
function useEntryView(host: HostSnapshot, entry: BoardEntry, hideAnswers: boolean) {
  const { t, i18n } = useTranslation()
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const question = host.live?.question ?? host.reveal?.question ?? host.question
  const over = host.phase !== 'question'
  return {
    question,
    time: entry.answer ? t('host.shown.seconds', { seconds: seconds.format(entry.answer.timeMs / 1000) }) : null,
    // Right or wrong: live only while answers show; afterwards always (the screens show it too).
    verdict: entry.answer && (over || !hideAnswers) ? entry.correct : null,
    showAnswer: entry.answer !== null && !hideAnswers,
    points: over && entry.answer && entry.answer.points > 0 ? entry.answer.points : null,
    over,
  }
}

function Verdict({ correct, className }: { correct: boolean | null; className?: string }) {
  const { t } = useTranslation()
  if (correct === null) return null
  return correct ? (
    <span className={cn('animate-pop text-success', className)}>
      <CheckIcon className="size-full" />
      <span className="sr-only">{t('host.board.right')}</span>
    </span>
  ) : (
    <span className={cn('animate-pop text-destructive', className)}>
      <CrossIcon className="size-full" />
      <span className="sr-only">{t('host.board.wrong')}</span>
    </span>
  )
}

/** Online, offline for now, or gone for good. */
function Presence({ entry }: { entry: BoardEntry }) {
  const { t } = useTranslation()
  if (entry.player.left) return <span className="text-xs font-semibold text-muted-foreground">{t('host.game.leftGame')}</span>
  if (entry.player.connected) return null
  return (
    <span className="shrink-0 text-muted-foreground" title={t('host.game.offline')}>
      <WifiOffIcon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{t('host.game.offline')}</span>
    </span>
  )
}

/** The tile's look: dashed while waiting, the result's colour once the question is over. */
function tileTone(entry: BoardEntry, over: boolean): string {
  if (entry.status === 'waiting') return 'border-dashed border-border bg-transparent'
  if (entry.status === 'missed') return 'border-dashed border-border bg-muted/50'
  if (over && entry.correct === true) return 'border-success bg-[color-mix(in_srgb,var(--success)_12%,var(--card))]'
  if (over && entry.correct === false) return 'border-destructive/70 bg-[color-mix(in_srgb,var(--destructive)_9%,var(--card))]'
  return 'border-border bg-card'
}

function Tile({ host, entry, size, hideAnswers }: { host: HostSnapshot; entry: BoardEntry; size: Size; hideAnswers: boolean }) {
  const view = useEntryView(host, entry, hideAnswers)
  const { player } = entry
  const gone = !player.connected
  if (size === 'sm') return <SmallTile host={host} entry={entry} view={view} />
  return (
    <li
      className={cn(
        'flex min-w-0 items-center rounded-xl border-2 transition-colors',
        size === 'lg' ? 'gap-3 px-3 py-2.5' : 'gap-2 px-2.5 py-2',
        tileTone(entry, view.over),
      )}
    >
      {/* Small avatars: the tile's width goes to the name and the answer. */}
      <PlayerAvatar avatar={player.avatar} size={size === 'lg' ? 'md' : 'sm'} className={cn(gone && 'opacity-50')} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1">
          {/* Large tiles show a long name on two lines; medium ones keep one line (and their height). */}
          <span
            className={cn(
              'min-w-0 flex-1 leading-tight font-bold',
              size === 'lg' ? 'line-clamp-2 text-lg wrap-break-word' : 'truncate text-sm',
              gone && 'text-muted-foreground',
            )}
            title={size === 'md' ? player.name : undefined}
          >
            {player.name}
          </span>
          <Presence entry={entry} />
          <Verdict correct={view.verdict} className={size === 'lg' ? 'size-6 shrink-0' : 'size-5 shrink-0'} />
        </div>
        <div className={cn('flex min-h-5 min-w-0 items-center gap-1.5 text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-xs')}>
          <EntryAnswer host={host} entry={entry} view={view} />
        </div>
      </div>
    </li>
  )
}

/**
 * A full room's tile: one line with the name, the answer's colour and symbol and the verdict (the
 * time and the points in its tooltip), so 60 players fit a laptop screen.
 */
function SmallTile({ host, entry, view }: { host: HostSnapshot; entry: BoardEntry; view: ReturnType<typeof useEntryView> }) {
  const { t } = useTranslation()
  const { player } = entry
  const gone = !player.connected
  return (
    <li
      title={[player.name, view.time, view.points !== null ? `+${view.points}` : null].filter(Boolean).join(' · ')}
      className={cn('flex min-w-0 items-center gap-1 rounded-lg border-2 px-1.5 py-0.5 transition-colors', tileTone(entry, view.over))}
    >
      <PlayerAvatar avatar={player.avatar} size="sm" className={cn('size-5 text-xs', gone && 'opacity-50')} />
      <span className={cn('min-w-0 flex-1 truncate text-sm leading-tight font-bold', gone && 'text-muted-foreground')}>{player.name}</span>
      <Presence entry={entry} />
      {entry.status === 'waiting' && (
        <span className="text-muted-foreground">
          <HourglassIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">{t('host.board.waiting')}</span>
        </span>
      )}
      {entry.status === 'missed' && <span className="sr-only">{t('host.board.noAnswer')}</span>}
      {entry.answer &&
        (view.showAnswer ? (
          <AnswerChip answer={entry.answer.answer} question={view.question} symbols={host.settings.answerSymbols} compact />
        ) : (
          <span className="text-primary">
            <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{t('host.board.answered')}</span>
          </span>
        ))}
      <Verdict correct={view.verdict} className="size-3.5 shrink-0" />
    </li>
  )
}

/** The second line of a tile, or the answer cell of a row. */
function EntryAnswer({ host, entry, view }: { host: HostSnapshot; entry: BoardEntry; view: ReturnType<typeof useEntryView> }) {
  const { t } = useTranslation()
  if (entry.status === 'waiting') {
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <HourglassIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{t('host.board.waiting')}</span>
      </span>
    )
  }
  if (entry.status === 'missed') return <span className="font-semibold">{t('host.board.noAnswer')}</span>
  if (!entry.answer) return null
  return (
    <>
      {view.showAnswer ? (
        <>
          <AnswerChip answer={entry.answer.answer} question={view.question} symbols={host.settings.answerSymbols} />
          {entry.answer.nearMiss && <TypoTag />}
        </>
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <CheckCircle2Icon className="size-3.5 text-primary" aria-hidden="true" />
          {t('host.board.answered')}
        </span>
      )}
      {/* While it runs, how fast; afterwards what it earned and how the rank moved. */}
      {view.over ? (
        <span className="ml-auto flex shrink-0 items-center gap-1.5 font-black tabular-nums">
          {view.points !== null && <span className="text-success">+{view.points}</span>}
          <RankArrow previous={entry.player.previousRank} rank={entry.player.rank} />
        </span>
      ) : (
        view.time && <span className="ml-auto shrink-0 tabular-nums">{view.time}</span>
      )}
    </>
  )
}

function Row({ host, entry, hideAnswers }: { host: HostSnapshot; entry: BoardEntry; hideAnswers: boolean }) {
  const view = useEntryView(host, entry, hideAnswers)
  const { player } = entry
  return (
    <li className={cn('flex min-w-0 items-center gap-2 border-b py-1', entry.status === 'waiting' && 'opacity-80')}>
      <PlayerAvatar avatar={player.avatar} size="sm" className={cn('size-6 text-sm', !player.connected && 'opacity-50')} />
      <span className={cn('w-32 shrink-0 truncate text-sm font-bold', !player.connected && 'text-muted-foreground')} title={player.name}>
        {player.name}
      </span>
      <Presence entry={entry} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
        <EntryAnswer host={host} entry={entry} view={view} />
      </span>
      <Verdict correct={view.verdict} className="size-4 shrink-0" />
    </li>
  )
}
