import { teamAnswerModes, type PlayerSnapshot, type TeamAnswerMode, type TeamPublic } from '@quizmoo/shared'
import { CrownIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChoiceCards } from '@/components/choice-cards'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
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
    <section className="flex w-full max-w-sm animate-fade-up flex-col gap-4 rounded-3xl border bg-card p-5 text-left shadow-soft">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold wrap-break-word">{team.name}</h2>
        <p className="text-sm font-semibold text-muted-foreground">
          {t('play.team.answers', { mode: t(`host.create.teamAnswerOptions.${team.answerMode}`) })}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label={t('play.team.members')}>
        {members.map((p) => (
          <li
            key={p.id}
            className={cn(
              'flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-3 pl-1 text-sm font-bold text-secondary-foreground',
              !p.connected && 'opacity-50',
            )}
          >
            <PlayerAvatar avatar={p.avatar} className="bg-card" />
            <span className="max-w-32 truncate">{p.name}</span>
            {p.id === team.captainId && <CrownIcon className="size-4 text-warning" aria-label={t('play.team.captain')} />}
          </li>
        ))}
      </ul>
      {isCaptain && (
        <p className="flex items-center gap-2 text-sm font-bold">
          <CrownIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
          {t('play.team.youLead')}
        </p>
      )}
      {isCaptain && snapshot.settings.teamsChoose && (
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
