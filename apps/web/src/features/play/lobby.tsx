import type { GameSettings, PlayerSnapshot } from '@quizmoo/shared'
import { CheckIcon, CopyIcon, EyeOffIcon, FlameIcon, ListOrderedIcon, PencilIcon, UserIcon, UserPlusIcon, UsersIcon, ZapIcon } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BrandingMark } from '@/components/branding-mark'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/clipboard'
import { PlayerAvatar } from '../../components/player-avatar'
import { WaitingDots } from '../../components/waiting-dots'
import { stagger } from '../../lib/motion'
import { PickTeam } from './pick-team'
import { TeamCard } from './team-card'

/**
 * Waiting for the start: who the player is and which team they play for (big, in the theme colour),
 * that the game is about to start and how many have joined, then the PIN to pass on, the team and
 * what the game is like.
 */
export function Lobby({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const team = snapshot.teams.find((x) => x.id === snapshot.me.teamId)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {snapshot.branding && <BrandingMark branding={snapshot.branding} size="phone" />}
      <div className="glow-border flex w-full max-w-sm animate-pop flex-col items-center gap-4 rounded-3xl bg-card p-6 shadow-soft">
        <PlayerAvatar avatar={snapshot.me.avatar} size="xl" className="animate-float bg-accent" />
        <h1 className="text-3xl font-black wrap-break-word">{t('play.youAreIn', { name: snapshot.me.name })}</h1>
        {team && <TeamBanner name={team.solo ? null : team.name} />}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-semibold text-muted-foreground">
          <span className="flex items-center gap-2">
            {t('play.waitingForHost')}
            <WaitingDots />
          </span>
          {/* Keyed by the count so the badge pops each time someone joins. */}
          <span key={snapshot.players.length} className="animate-pop rounded-full bg-muted px-3 py-1 text-sm font-bold text-foreground">
            {t('play.playerCount', { count: snapshot.players.length })}
          </span>
        </div>
      </div>
      {snapshot.mode === 'team' && !snapshot.me.teamId && <PickTeam snapshot={snapshot} />}
      <PinBox pin={snapshot.pin} />
      {team && !team.solo && <TeamCard snapshot={snapshot} team={team} />}
      <GameInfo snapshot={snapshot} />
    </div>
  )
}

/** The player's team, the first thing after their name: a solid banner in the theme colour. `name` null: on their own. */
function TeamBanner({ name }: { name: string | null }) {
  const { t } = useTranslation()
  const Icon = name === null ? UserIcon : UsersIcon
  return (
    <div className="flex w-full animate-pop items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-left text-primary-foreground shadow-soft" style={stagger(1, 0, 150)}>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-foreground/15">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      {name === null ? (
        <p className="text-xl font-black">{t('play.solo')}</p>
      ) : (
        <p className="flex min-w-0 flex-col">
          <span className="text-sm font-bold tracking-wide uppercase">{t('play.yourTeamLabel')}</span>
          <span className="text-2xl leading-tight font-black wrap-break-word">{name}</span>
        </p>
      )}
    </div>
  )
}

/** The room code in big digits, so the player can tell others where to join, with a copy button (also in the game menu later). */
function PinBox({ pin }: { pin: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  async function copy() {
    if (!(await copyText(pin))) return void toast.error(t('play.copyFailed'))
    setCopied(true)
    toast.success(t('play.pinCopied'), { id: 'pin-copied' })
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <section
      aria-label={t('join.pin')}
      className="flex w-full max-w-sm animate-fade-up flex-col items-center gap-2 rounded-3xl border bg-card px-5 py-4 shadow-soft"
      style={stagger(1, 0, 120)}
    >
      <span className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{t('join.pin')}</span>
      <span className="text-5xl font-black tracking-[0.15em] tabular-nums">{pin}</span>
      <Button variant="outline" size="sm" onClick={() => void copy()} aria-label={t('play.copyPinLabel', { pin })}>
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {copied ? t('play.copied') : t('play.copyPin')}
      </Button>
    </section>
  )
}

/** What the game is like before it starts: the quiz, how many questions, and the rules that change how to play. */
function GameInfo({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const items = gameInfo(snapshot.settings, snapshot.mode, snapshot.questionCount)
  return (
    <section
      aria-labelledby="game-info"
      className="flex w-full max-w-sm animate-fade-up flex-col gap-3 rounded-3xl border bg-card p-5 text-left shadow-soft"
      style={stagger(1, 0, 280)}
    >
      <div className="min-w-0">
        <h2 id="game-info" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
          {t('play.info.title')}
        </h2>
        <p className="text-lg font-extrabold wrap-break-word">{snapshot.quizTitle}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map(({ icon: Icon, text, values }) => (
          <li key={text} className="flex items-start gap-3 text-sm font-semibold">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="pt-1">{t(text, values ?? {})}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface InfoLine {
  icon: ComponentType<{ className?: string }>
  /** i18n key. */
  text: string
  values?: Record<string, number>
}

/** The lobby's info lines: the question count, how players score, and only the rules that are on. */
function gameInfo(settings: GameSettings, mode: PlayerSnapshot['mode'], questionCount: number): InfoLine[] {
  const lines: (InfoLine | false)[] = [
    { icon: ListOrderedIcon, text: 'play.info.questions', values: { count: questionCount } },
    { icon: UsersIcon, text: mode === 'team' ? (settings.soloPlayers ? 'play.info.teamsAndSolo' : 'play.info.teams') : 'play.info.classic' },
    settings.speedBonus && { icon: ZapIcon, text: 'play.info.speedBonus' },
    settings.streakBonus && { icon: FlameIcon, text: 'play.info.streakBonus' },
    settings.answerChanges &&
      (settings.answerLockSec > 0
        ? { icon: PencilIcon, text: 'play.info.answerChangesLocked', values: { count: settings.answerLockSec } }
        : { icon: PencilIcon, text: 'play.info.answerChanges' }),
    settings.revealAnswers === 'atEnd' && { icon: EyeOffIcon, text: 'play.info.answersAtEnd' },
    settings.lateJoin && { icon: UserPlusIcon, text: 'play.info.lateJoin' },
  ]
  return lines.filter((line): line is InfoLine => line !== false)
}
