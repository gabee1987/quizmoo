import { teamAnswerModes, type PlayerSnapshot, type TeamAnswerMode, type TeamPublic } from '@quizmoo/shared'
import { CrownIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChoiceCards } from '@/components/choice-cards'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'
import { PlayerAvatar } from '../../components/player-avatar'
import { emitAck } from '../../lib/socket'

/**
 * The player's team in the lobby: members with the captain's crown and how the team answers.
 * The captain picks the mode (when teams may choose) and can pass the captaincy on.
 */
export function TeamCard({ snapshot, team }: { snapshot: PlayerSnapshot; team: TeamPublic }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const members = snapshot.players.filter((p) => p.teamId === team.id)
  const isCaptain = team.captainId === snapshot.me.id
  const teammates = members.filter((p) => p.id !== snapshot.me.id && p.connected)

  async function run(send: () => Promise<{ ok: true } | { error: string }>) {
    setPending(true)
    const res = await send()
    if ('error' in res) toast.error(t(res.error), { id: res.error })
    setPending(false)
  }

  return (
    <section
      aria-labelledby="team-members"
      className="flex animate-fade-up flex-col gap-4 rounded-3xl border bg-card p-5 text-left shadow-soft"
      style={stagger(1, 0, 200)}
    >
      {/* The team's name is on the banner above: here who is in it and how it answers. */}
      <div className="flex flex-col gap-1">
        <h2 id="team-members" className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
          {t('play.team.members')}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground tabular-nums">{members.length}</span>
        </h2>
        <p className="text-sm font-semibold text-muted-foreground">
          {t('play.team.answers', { mode: t(`host.create.teamAnswerOptions.${team.answerMode}`) })}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2" aria-labelledby="team-members">
        {members.map((p) => (
          <li
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 rounded-full border-2 border-transparent bg-secondary py-0.5 pr-3 pl-0.5 text-sm font-bold text-secondary-foreground',
              // Offline: dashed border and a faded avatar, as on the host's tiles; the text keeps its contrast.
              !p.connected && 'border-dashed border-border bg-card text-foreground',
            )}
          >
            <PlayerAvatar avatar={p.avatar} className={cn('bg-card', !p.connected && 'opacity-40 grayscale')} />
            <span className="max-w-32 truncate">{p.name}</span>
            {p.id === team.captainId && <CrownIcon className="size-4 text-warning" aria-label={t('play.team.captain')} />}
            {!p.connected && <span className="text-xs font-semibold text-muted-foreground">{t('play.teammateOffline')}</span>}
          </li>
        ))}
      </ul>
      {isCaptain && (
        <p className="flex items-center gap-2 text-sm font-bold">
          <CrownIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
          {t('play.team.youLead')}
        </p>
      )}
      {/* A team of one has nobody to decide with: it plays the mode it starts with. */}
      {isCaptain && snapshot.settings.teamsChoose && members.length > 1 && (
        <ChoiceCards
          legend={t('play.team.chooseMode')}
          value={team.answerMode}
          columns={1}
          disabled={pending}
          choices={teamAnswerModes.map((mode) => ({
            value: mode,
            label: t(`host.create.teamAnswerOptions.${mode}`),
            description: t(`host.create.teamAnswerOptions.${mode}Help`),
          }))}
          onChange={(mode: TeamAnswerMode) => void run(() => emitAck('player:teamMode', { mode }))}
        />
      )}
      {isCaptain && teammates.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-bold text-primary">{t('play.team.passCaptaincy')}</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {teammates.map((p) => (
              <Button
                key={p.id}
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => void run(() => emitAck('player:captain', { playerId: p.id }))}
              >
                <PlayerAvatar avatar={p.avatar} className="bg-card" />
                {p.name}
              </Button>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
