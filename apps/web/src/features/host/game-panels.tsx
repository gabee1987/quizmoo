import type { HostCommand, HostSnapshot } from '@quizmoo/shared'
import { ListOrderedIcon, MegaphoneIcon, MonitorIcon, TrophyIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'
import { MessageBox } from './message-box'
import { PlayerPanel } from './player-panel'
import { ReviewPanel } from './review-panel'
import { ScreenPreview } from './screen-preview'
import { Standings } from './standings'
import { TeamModesPanel } from './team-modes-panel'

const panels = ['standings', 'message', 'players', 'questions', 'preview'] as const
type Panel = (typeof panels)[number]
const icons: Record<Panel, LucideIcon> = {
  standings: TrophyIcon,
  message: MegaphoneIcon,
  players: UsersIcon,
  questions: ListOrderedIcon,
  preview: MonitorIcon,
}

/**
 * Everything the host needs now and then, one tab at a time next to the board: the standings,
 * the message box, the players (remove, captain, move, team modes), the questions so far and the
 * preview of the screens. Only the open tab is drawn (the preview loads only while open).
 */
export function GamePanels({
  host,
  clockOffset,
  gameId,
  send,
  className,
}: {
  host: HostSnapshot
  clockOffset: number
  gameId: string | null
  send: (command: HostCommand) => Promise<boolean>
  className?: string
}) {
  const { t } = useTranslation()
  const [panel, setPanel] = useState<Panel>('standings')
  return (
    <Tabs value={panel} onValueChange={(value) => setPanel(value as Panel)} className={cn('min-h-0 gap-2', className)}>
      <TabsList className="grid h-auto! w-full shrink-0 grid-cols-5">
        {panels.map((name) => {
          const Icon = icons[name]
          return (
            <TabsTrigger key={name} value={name} className="relative h-auto flex-col gap-0.5 px-1 py-1.5 text-xs">
              <Icon aria-hidden="true" />
              <span className="max-w-full truncate">{t(`host.panels.${name}`)}</span>
              {/* A message is on every screen right now. */}
              {name === 'message' && host.announcement && (
                <span className="absolute top-1 right-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
      <div className="relative -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
        <TabsContent value="standings">
          <Standings host={host} gameId={gameId} />
        </TabsContent>
        <TabsContent value="message">
          <MessageBox announcement={host.announcement} quickMessages={host.quickMessages} clockOffset={clockOffset} onCommand={send} />
        </TabsContent>
        <TabsContent value="players" className="flex flex-col gap-4">
          <TeamModesPanel host={host} onTeamMode={(mode, teamId) => void send({ type: 'teamMode', mode, teamId })} />
          <PlayerPanel
            host={host}
            clockOffset={clockOffset}
            onKick={(playerId) => void send({ type: 'kick', playerId })}
            onCaptain={(playerId) => void send({ type: 'captain', playerId })}
            onMove={(playerId, teamId) => void send({ type: 'movePlayer', playerId, teamId })}
          />
        </TabsContent>
        <TabsContent value="questions">
          <ReviewPanel host={host} onShowQuestion={(index) => void send({ type: 'showQuestion', index })} />
        </TabsContent>
        <TabsContent value="preview">
          <ScreenPreview host={host} clockOffset={clockOffset} defaultOpen />
        </TabsContent>
      </div>
    </Tabs>
  )
}
