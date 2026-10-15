import { CrownIcon, Settings2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PlayerAvatar } from '@/components/player-avatar'
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
import { emitAck, useGameStore } from '@/lib/socket'

/**
 * Phones in a game have no header: the screen belongs to the game. Language and colour mode sit
 * behind this small round button in the top right corner instead. A team's captain can pass the
 * captaincy from here at any point of the game (in the lobby the team card offers it too).
 */
export function GameMenu() {
  const { t, i18n } = useTranslation()
  const { mode } = useMode()
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t('app.settings')}
          title={t('app.settings')}
          className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-40 size-10 rounded-full bg-card/90 shadow-soft backdrop-blur"
        >
          <Settings2Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {teammates.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <CrownIcon className="size-4 text-warning" aria-hidden="true" />
              {t('play.team.passCaptaincy')}
            </DropdownMenuLabel>
            {teammates.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => void passCaptaincy(p.id)}>
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
            <DropdownMenuRadioItem key={lang} value={lang} lang={lang}>
              {t(`app.languages.${lang}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('app.mode')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as Mode)}>
          {modes.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(`app.modes.${value}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
