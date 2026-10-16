import type { GameSettings, PlayerSnapshot } from '@quizmoo/shared'
import { CheckIcon, CopyIcon, EyeOffIcon, FlameIcon, ListOrderedIcon, PencilIcon, UserPlusIcon, UsersIcon, ZapIcon } from 'lucide-react'
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

export function Lobby({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const team = snapshot.teams.find((x) => x.id === snapshot.me.teamId)
  return (
    // Top padding keeps the game menu's button clear of the card once the page is taller than the screen.
    <div className="flex flex-1 flex-col items-center justify-center gap-6 pt-12 text-center">
      {snapshot.branding && <BrandingMark branding={snapshot.branding} size="phone" />}
      <div className="glow-border flex w-full max-w-sm animate-pop flex-col items-center gap-3 rounded-3xl bg-card p-6 shadow-soft">
        <PlayerAvatar avatar={snapshot.me.avatar} size="xl" className="animate-float bg-accent" />
        <h1 className="text-3xl font-black wrap-break-word">{t('play.youAreIn', { name: snapshot.me.name })}</h1>
        {team && (
          <p className="rounded-full bg-secondary px-3 py-1 font-bold text-secondary-foreground">
            {team.solo ? t('play.solo') : t('play.yourTeam', { team: team.name })}
          </p>
        )}
        <PinBox pin={snapshot.pin} />
      </div>
      {team && !team.solo && <TeamCard snapshot={snapshot} team={team} />}
      {snapshot.mode === 'team' && !snapshot.me.teamId && <PickTeam snapshot={snapshot} />}
      <GameInfo snapshot={snapshot} />
      <p className="flex items-center gap-2 font-semibold text-muted-foreground">
        {t('play.waitingForHost')}
        <WaitingDots />
      </p>
      {/* Keyed by the count so the badge pops each time someone joins. */}
      <p key={snapshot.players.length} className="animate-pop rounded-full bg-muted px-4 py-1.5 text-sm font-bold">
        {t('play.playerCount', { count: snapshot.players.length })}
      </p>
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
    <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-muted px-4 py-3">
      <span className="text-sm font-semibold text-muted-foreground">{t('join.pin')}</span>
      <span className="text-5xl font-black tracking-[0.15em] tabular-nums">{pin}</span>
      <Button variant="outline" size="sm" onClick={() => void copy()} aria-label={t('play.copyPinLabel', { pin })}>
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {copied ? t('play.copied') : t('play.copyPin')}
      </Button>
    </div>
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
      style={stagger(1, 0, 200)}
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
