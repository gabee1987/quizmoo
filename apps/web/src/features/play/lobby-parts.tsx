import type { PlayerSnapshot, TeamPublic } from '@quizmoo/shared'
import { CheckIcon, CopyIcon, UserIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/cn'
import { PlayerAvatar } from '../../components/player-avatar'
import { WaitingCow } from '../../components/waiting-cow'
import { WaitingDots } from '../../components/waiting-dots'
import { stagger } from '../../lib/motion'
import { gameInfo } from './lobby-info'

// The waiting screen's parts. Each fills the width it is given: the phone and desktop layouts in
// lobby.tsx decide how wide and where.

/** Who the player is and which team they play for, that the game is about to start and how many have joined. */
export function PlayerCard({ snapshot, team, className }: { snapshot: PlayerSnapshot; team: TeamPublic | undefined; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={cn('glow-border flex animate-pop flex-col items-center gap-4 rounded-3xl bg-card p-6 text-center shadow-soft', className)}>
      {/* In the corner, clear of the centred avatar; its bubble speaks to the right. */}
      <WaitingCow bubble="right" className="absolute top-4 left-4" />
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
export function PinCard({ pin, className }: { pin: string; className?: string }) {
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
      className={cn('flex animate-fade-up flex-col items-center gap-2 rounded-3xl border bg-card px-5 py-4 shadow-soft', className)}
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

/**
 * What the game is like before it starts: the quiz, how many questions, and the rules that change
 * how to play. The lines go into two columns when the card is wide enough (a container query).
 */
export function GameInfoCard({ snapshot, className }: { snapshot: PlayerSnapshot; className?: string }) {
  const { t } = useTranslation()
  const items = gameInfo(snapshot.settings, snapshot.mode, snapshot.questionCount)
  return (
    <section
      aria-labelledby="game-info"
      className={cn('@container flex animate-fade-up flex-col gap-3 rounded-3xl border bg-card p-5 text-left shadow-soft', className)}
      style={stagger(1, 0, 280)}
    >
      <div className="min-w-0">
        <h2 id="game-info" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
          {t('play.info.title')}
        </h2>
        <p className="text-lg font-extrabold wrap-break-word">{snapshot.quizTitle}</p>
      </div>
      <ul className="grid gap-x-6 gap-y-2 @lg:grid-cols-2">
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
