import { useNavigate } from '@tanstack/react-router'
import { CrownIcon, LogOutIcon, Settings2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/dialog'
import { PlayerAvatar } from '@/components/player-avatar'
import { SeasonMenuItem } from '@/components/season-greeting'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { languages, setLanguage, type Language } from '@/i18n'
import { modes, setMode, useMode, type Mode } from '@/lib/mode'
import { forgetPlayer } from '@/lib/player-storage'
import { emitAck, useGameStore } from '@/lib/socket'

/**
 * Phones in a game have no header: the screen belongs to the game. Language and colour mode sit
 * behind this round button at the right end of the game's top bar (`GameBar`) instead, with the
 * game and who the player joined as, and "Leave game". A team's captain can pass the captaincy from
 * here at any point of the game (in the lobby the team card offers it too).
 */

/** Touch-sized rows: the menu is used on phones, often in a hurry mid-game. */
const touchItem = 'min-h-12 text-base'
const touchRadio = 'min-h-12 rounded-xl pl-9 text-base font-semibold'

export function GameMenu() {
  const { t, i18n } = useTranslation()
  const { mode } = useMode()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const [pending, setPending] = useState(false)
  const snapshot = useGameStore().player
  const team = snapshot?.teams.find((x) => x.id === snapshot.me.teamId)
  const teammates =
    snapshot && team?.captainId === snapshot.me.id && snapshot.phase !== 'finished'
      ? snapshot.players.filter((p) => p.teamId === team.id && p.id !== snapshot.me.id && p.connected)
      : []

  async function passCaptaincy(playerId: string) {
    const res = await emitAck('player:captain', { playerId })
    if ('error' in res) toast.error(t(res.error), { id: res.error })
  }

  async function leave(pin: string) {
    setPending(true)
    const res = await emitAck('player:leave', {})
    setPending(false)
    // Not found: the server no longer has this player, so there is nothing to leave.
    if ('error' in res && res.error !== 'errors.playerNotFound') return void toast.error(t(res.error), { id: res.error })
    setLeaving(false)
    forgetPlayer(pin)
    toast.success(t('play.leave.done'), { id: 'left-game' })
    void navigate({ to: '/' })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('app.settings')}
            title={t('app.settings')}
            // Above the dimmed page of `PausedNote` (z-40): the menu stays usable while the host pauses.
            className="relative z-50 size-11 shrink-0 rounded-full bg-card/90 shadow-soft backdrop-blur"
          >
            <Settings2Icon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="min-w-64">
          {snapshot && (
            <>
              {/* The room code at any point of the game, for someone who wants to join. */}
              <div className="flex flex-col px-2 py-1.5">
                <span className="text-xs font-semibold text-muted-foreground">{t('join.pin')}</span>
                <span className="text-2xl font-black tracking-widest tabular-nums">{snapshot.pin}</span>
                <span className="max-w-56 truncate text-xs text-muted-foreground">{snapshot.quizTitle}</span>
              </div>
              {/* Who the player joined as. */}
              <div className="flex max-w-64 items-center gap-2 px-2 py-1.5">
                <PlayerAvatar avatar={snapshot.me.avatar} className="bg-accent" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-bold wrap-break-word">{snapshot.me.name}</span>
                  {team && (
                    <span className="text-xs text-muted-foreground wrap-break-word">
                      {team.solo ? t('play.solo') : t('play.yourTeam', { team: team.name })}
                    </span>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          {teammates.length > 0 && (
            <>
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <CrownIcon className="size-4 text-warning" aria-hidden="true" />
                {t('play.team.passCaptaincy')}
              </DropdownMenuLabel>
              {teammates.map((p) => (
                <DropdownMenuItem key={p.id} className={touchItem} onSelect={() => void passCaptaincy(p.id)}>
                  <PlayerAvatar avatar={p.avatar} className="bg-secondary" />
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>{t('app.language')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={i18n.language} onValueChange={(lang) => setLanguage(lang as Language)}>
            {languages.map((lang) => (
              <DropdownMenuRadioItem key={lang} value={lang} lang={lang} className={touchRadio}>
                {t(`app.languages.${lang}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('app.mode')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as Mode)}>
            {modes.map((value) => (
              <DropdownMenuRadioItem key={value} value={value} className={touchRadio}>
                {t(`app.modes.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <SeasonMenuItem className={touchRadio} />
          {snapshot && snapshot.phase !== 'finished' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className={touchItem} onSelect={() => setLeaving(true)}>
                <LogOutIcon aria-hidden="true" />
                {t('play.leave.action')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {leaving && snapshot && (
        <ConfirmDialog
          title={t('play.leave.title')}
          confirmLabel={t('play.leave.confirm')}
          danger
          pending={pending}
          onConfirm={() => void leave(snapshot.pin)}
          onCancel={() => setLeaving(false)}
        >
          {snapshot.phase === 'lobby' ? t('play.leave.lobby') : t('play.leave.running')}
        </ConfirmDialog>
      )}
    </>
  )
}
