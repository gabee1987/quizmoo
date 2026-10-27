import type { HostSnapshot, PlayerPublic } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { BrandingMark } from '@/components/branding-mark'
import { WaitingCow } from '@/components/waiting-cow'
import { lengthMinutes } from '@/lib/game-length'
import { PlayerAvatar } from '../../components/player-avatar'
import { QrCode } from '../../components/qr-code'

export function ScreenLobby({ host, joinUrl }: { host: HostSnapshot; joinUrl: string | null }) {
  const { t } = useTranslation()
  const teamMode = host.mode === 'team'
  const soloIds = new Set(host.teams.filter((team) => team.solo).map((team) => team.id))
  return (
    <div className="grid flex-1 items-center gap-10 lg:grid-cols-[auto_1fr]">
      {joinUrl && <QrCode value={joinUrl} className="mx-auto w-[min(60vh,80vw)] animate-pop" />}
      <div className="flex flex-col gap-6">
        {host.branding && <BrandingMark branding={host.branding} size="lobby" />}
        <div>
          <p className="text-3xl font-semibold text-muted-foreground wrap-break-word">{host.quizTitle}</p>
          {(host.groupCount > 0 || host.estimatedLeftSec > 0) && (
            <p className="text-2xl text-muted-foreground">
              {[
                host.groupCount > 0 ? t('play.info.questionsInRounds', { questions: host.questionCount, count: host.groupCount }) : null,
                host.estimatedLeftSec > 0 ? t('common.aboutMin', { count: lengthMinutes(host.estimatedLeftSec) }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <div className="animate-fade-up">
          <p className="text-3xl">{t('screen.joinAt')}</p>
          <p className="text-4xl font-bold break-all">{joinUrl}</p>
        </div>
        <div className="flex items-end gap-8">
          <div className="glow-border flex w-fit animate-pop flex-col rounded-3xl bg-card px-8 py-4 shadow-soft">
            <p className="text-3xl">{t('screen.pin')}</p>
            <p className="text-8xl font-black tracking-widest tabular-nums">{host.pin}</p>
          </div>
          <WaitingCow size="lg" className="mb-2" />
        </div>
        {/* Keyed by the count so the badge pops each time someone joins. */}
        <p key={host.players.length} className="w-fit animate-pop rounded-full bg-secondary px-5 py-1.5 text-3xl font-bold text-secondary-foreground">
          {t('play.playerCount', { count: host.players.length })}
        </p>
        {teamMode ? (
          <div className="grid gap-4 md:grid-cols-2">
            {host.teams
              .filter((team) => !team.solo)
              .map((team) => (
                <div key={team.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <p className="mb-2 text-3xl font-bold">{team.name}</p>
                  <Names players={host.players.filter((p) => p.teamId === team.id)} />
                </div>
              ))}
            {/* Solo players together in one card. */}
            {soloIds.size > 0 && (
              <div className="rounded-2xl border bg-card p-4 shadow-soft">
                <p className="mb-2 text-3xl font-bold">{t('play.soloGroup')}</p>
                <Names players={host.players.filter((p) => p.teamId !== null && soloIds.has(p.teamId))} />
              </div>
            )}
          </div>
        ) : (
          <Names players={host.players} />
        )}
      </div>
    </div>
  )
}

/** Each name pops in when its player joins; keys are player ids, so existing names stay put. */
function Names({ players }: { players: PlayerPublic[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {players.map((player) => (
        <li
          key={player.id}
          className="flex animate-pop items-center gap-2 rounded-full border bg-card py-1 pr-4 pl-1.5 text-2xl font-semibold shadow-soft"
        >
          <PlayerAvatar avatar={player.avatar} size="md" />
          {player.name}
        </li>
      ))}
    </ul>
  )
}
