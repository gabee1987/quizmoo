import {
  MAX_TEAMS,
  teamAnswerModes,
  type HostCommand,
  type HostSnapshot,
  type PlayerPublic,
  type TeamAnswerMode,
  type TeamPublic,
} from '@quizmoo/shared'
import { DndContext, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowRightLeftIcon,
  CheckIcon,
  CrownIcon,
  EllipsisVerticalIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '@/components/player-avatar'
import { SelectField } from '@/components/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WaitingDots } from '@/components/waiting-dots'
import { cn } from '@/lib/cn'
import { useNow } from '@/lib/clock'
import { lobbyGroups } from './lobby-groups'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface TeamActions {
  onMove: (playerId: string, teamId: string) => void
  onCreateTeam: (name: string) => void
  onRenameTeam: (teamId: string, name: string) => void
  onRemoveTeam: (teamId: string) => void
}

/** The team commands, sent as host commands (`send` shows their errors). */
export function teamActions(send: (command: HostCommand) => Promise<boolean>): TeamActions {
  return {
    onMove: (playerId, teamId) => void send({ type: 'movePlayer', playerId, teamId }),
    onCreateTeam: (name) => void send({ type: 'createTeam', name }),
    onRenameTeam: (teamId, name) => void send({ type: 'renameTeam', teamId, name }),
    onRemoveTeam: (teamId) => void send({ type: 'removeTeam', teamId }),
  }
}

/**
 * The players in the lobby as avatar tiles, grouped by team in team mode; a friendly wait while
 * nobody is here. In team mode the host sets each team's answer mode (or all at once) and its
 * captain, adds, renames and removes teams, and moves players: by dragging a tile onto another
 * team (mouse, or a long press on touch) or with "Move" (touch and keyboard).
 */
export function LobbyPlayers({
  host,
  clockOffset,
  onKick,
  onTeamMode,
  onCaptain,
  teamActions,
}: {
  host: HostSnapshot
  clockOffset: number
  onKick: (playerId: string) => void
  onTeamMode: (mode: TeamAnswerMode, teamId?: string) => void
  onCaptain: (playerId: string) => void
  teamActions: TeamActions
}) {
  const { t } = useTranslation()
  const online = host.players.filter((p) => p.connected).length
  // Ticks only while someone is offline. Server time, so the host's clock does not matter.
  const now = useNow(online < host.players.length) + clockOffset
  const modeOptions = teamAnswerModes.map((mode) => ({ value: mode, label: t(`host.create.teamAnswerOptions.${mode}`) }))
  const allModes = new Set(host.teams.map((team) => team.answerMode))
  const teamMode = host.mode === 'team'
  // The keyboard moves players with "Move", so dragging is for mouse and touch only.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    const player = host.players.find((p) => p.id === active.id)
    if (player && over && over.id !== player.teamId) teamActions.onMove(player.id, String(over.id))
  }

  const groups = lobbyGroups(host.players, host.teams, host.mode)
  return (
    <section className="flex flex-col gap-3" aria-labelledby="lobby-players">
      <h2 id="lobby-players" className="text-xl font-extrabold">
        {/* Keyed by the count so it pops each time someone joins. */}
        <span key={host.players.length} className="inline-block animate-pop">
          {t('play.playerCount', { count: host.players.length })}
        </span>
      </h2>
      {teamMode && host.teams.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('host.game.allTeamsMode')}>
          <span className="text-sm font-semibold text-muted-foreground">{t('host.game.allTeamsMode')}</span>
          {modeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={allModes.size === 1 && allModes.has(option.value) ? 'default' : 'outline'}
              aria-pressed={allModes.size === 1 && allModes.has(option.value)}
              onClick={() => onTeamMode(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
      {host.players.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center text-muted-foreground">
          <WaitingDots className="text-primary" />
          <p className="font-semibold">{t('host.game.waitingForPlayers')}</p>
        </div>
      )}
      {!teamMode && host.players.length > 0 && (
        <TileGrid>
          {host.players.map((player) => (
            <PlayerTile key={player.id} player={player} now={now} onKick={onKick} />
          ))}
        </TileGrid>
      )}
      {teamMode && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {groups.map(({ team, players }) =>
            team ? (
              <TeamGroup key={team.id} team={team} count={players.length} modeOptions={modeOptions} onTeamMode={onTeamMode} teamActions={teamActions}>
                {players.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('host.game.teamEmpty')}</p>
                ) : (
                  <TileGrid rows>
                    {players.map((player) => (
                      <PlayerTile
                        key={player.id}
                        player={player}
                        now={now}
                        onKick={onKick}
                        team={{ captain: team.captainId === player.id, onCaptain, teams: host.teams, onMove: teamActions.onMove }}
                      />
                    ))}
                  </TileGrid>
                )}
              </TeamGroup>
            ) : (
              // Players whose team the host removed: they pick another one on their phones, or the host moves them.
              <div key="without-team" className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-warning p-3">
                <h3 className="font-bold">{t('host.game.withoutTeam')}</h3>
                <p className="text-sm text-muted-foreground">{t('host.game.withoutTeamHelp')}</p>
                <TileGrid rows>
                  {players.map((player) => (
                    <PlayerTile
                      key={player.id}
                      player={player}
                      now={now}
                      onKick={onKick}
                      team={{ captain: null, onCaptain, teams: host.teams, onMove: teamActions.onMove }}
                    />
                  ))}
                </TileGrid>
              </div>
            ),
          )}
        </DndContext>
      )}
      {teamMode && host.teams.length < MAX_TEAMS && <AddTeamForm onCreate={teamActions.onCreateTeam} />}
    </section>
  )
}

/** Classic mode: big avatar tiles. Team mode (`rows`): draggable rows wide enough for the full name. */
function TileGrid({ children, rows = false }: { children: ReactNode; rows?: boolean }) {
  return (
    <ul className={cn('grid gap-2', rows ? 'grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]')}>
      {children}
    </ul>
  )
}

/** A team's heading (name, count, rename, remove, answer mode) over its tiles; a drop target for dragged players. */
function TeamGroup({
  team,
  count,
  modeOptions,
  onTeamMode,
  teamActions,
  children,
}: {
  team: TeamPublic
  count: number
  modeOptions: { value: TeamAnswerMode; label: string }[]
  onTeamMode: (mode: TeamAnswerMode, teamId?: string) => void
  teamActions: TeamActions
  children: ReactNode
}) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: team.id })
  const [renaming, setRenaming] = useState(false)
  return (
    <div
      ref={setNodeRef}
      className={cn('-m-2 flex flex-col gap-2 rounded-2xl p-2 transition-colors', isOver && 'bg-secondary ring-[3px] ring-ring')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <RenameForm
            name={team.name}
            label={t('host.game.renameTeam', { team: team.name })}
            onDone={(name) => {
              if (name && name !== team.name) teamActions.onRenameTeam(team.id, name)
              setRenaming(false)
            }}
          />
        ) : (
          <h3 className="flex min-w-0 items-center gap-1 font-bold">
            <span className="truncate">{team.name}</span>
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">{count}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full text-muted-foreground"
              aria-label={t('host.game.renameTeam', { team: team.name })}
              onClick={() => setRenaming(true)}
            >
              <PencilIcon className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={t('host.game.removeTeam', { team: team.name })}
              onClick={() => {
                if (count === 0 || window.confirm(t('host.game.confirmRemoveTeam', { team: team.name }))) {
                  teamActions.onRemoveTeam(team.id)
                }
              }}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
            </Button>
          </h3>
        )}
        <SelectField
          label={t('host.game.teamMode', { team: team.name })}
          hideLabel
          value={team.answerMode}
          options={modeOptions}
          onChange={(mode) => onTeamMode(mode, team.id)}
          className="w-56"
        />
      </div>
      {children}
    </div>
  )
}

/** A team name field: Enter or the check saves, Escape or the cross leaves it as it was. */
function RenameForm({ name, label, onDone }: { name: string; label: string; onDone: (name: string | null) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(name)
  function submit(e: FormEvent) {
    e.preventDefault()
    onDone(value.trim() || null)
  }
  return (
    <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={submit}>
      <Input
        autoFocus
        value={value}
        maxLength={40}
        aria-label={label}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onDone(null)
          }
        }}
        className="h-10 min-w-0 flex-1"
      />
      <Button type="submit" variant="ghost" size="icon-sm" className="size-10" aria-label={t('common.save')}>
        <CheckIcon aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" className="size-10" aria-label={t('common.cancel')} onClick={() => onDone(null)}>
        <XIcon aria-hidden="true" />
      </Button>
    </form>
  )
}

function AddTeamForm({ onCreate }: { onCreate: (name: string) => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
    setName('')
  }
  return (
    <form className="flex gap-2" onSubmit={submit}>
      <Input
        value={name}
        maxLength={40}
        aria-label={t('host.create.teamName')}
        placeholder={t('host.create.teamName')}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" variant="secondary">
        <PlusIcon aria-hidden="true" />
        {t('host.game.addTeam')}
      </Button>
    </form>
  )
}

/**
 * A player's tile. Classic mode: a big avatar with the name under it. Team mode (`team`): a
 * draggable row with a grip, a small avatar and the whole name; a crown marks the captain and makes
 * anyone else captain (`captain` null: the player has no team), and "Move" lists the other teams.
 */
function PlayerTile({
  player,
  now,
  onKick,
  team,
}: {
  player: PlayerPublic
  now: number
  onKick: (playerId: string) => void
  team?: {
    captain: boolean | null
    onCaptain: (playerId: string) => void
    teams: readonly TeamPublic[]
    onMove: (playerId: string, teamId: string) => void
  }
}) {
  const { t } = useTranslation()
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({ id: player.id, disabled: !team })
  const offlineSeconds =
    player.connected || player.disconnectedAt === null ? null : Math.max(0, Math.floor((now - player.disconnectedAt) / 1000))
  const offline = offlineSeconds !== null && (
    <span className="block text-xs font-semibold text-muted-foreground tabular-nums">
      {offlineSeconds < 60
        ? t('host.game.offlineForSeconds', { count: offlineSeconds })
        : t('host.game.offlineForMinutes', { count: Math.floor(offlineSeconds / 60) })}
    </span>
  )
  const avatar = (size: 'md' | 'lg') => (
    <PlayerAvatar avatar={player.avatar} size={size} className={cn(offlineSeconds !== null && 'opacity-40 grayscale')} />
  )
  const kick = (className: string) => (
    <button
      type="button"
      aria-label={t('host.game.kickPlayer', { name: player.name })}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring',
        className,
      )}
      onClick={() => {
        if (window.confirm(t('host.game.confirmKick', { name: player.name }))) onKick(player.id)
      }}
    >
      <XIcon className="size-4" aria-hidden="true" />
    </button>
  )
  const card = cn(
    'rounded-2xl border bg-card shadow-soft',
    // The pop's kept end state would override the drag's transform.
    isDragging ? 'z-20 shadow-lg ring-[3px] ring-ring' : 'animate-pop',
    // Offline: dashed border and a faded avatar; the text keeps its full contrast.
    offlineSeconds !== null && 'border-2 border-dashed shadow-none',
  )

  if (!team) {
    return (
      <li className={cn(card, 'relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-2 text-center')}>
        {avatar('lg')}
        <span className="w-full truncate font-bold">{player.name}</span>
        {offline}
        {kick('absolute top-1 right-1')}
      </li>
    )
  }
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(card, 'flex cursor-grab items-center gap-2 py-1.5 pr-1 pl-1', isDragging && 'cursor-grabbing')}
    >
      <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      {avatar('md')}
      {/* The whole name, wrapping if it must: the actions share one button so it gets the room. */}
      <span className="min-w-0 flex-1">
        <span className="font-bold leading-tight wrap-break-word">
          {player.name}
          {team.captain === true && (
            <CrownIcon className="ml-1 inline size-4 align-[-2px] text-warning" aria-label={t('play.team.captain')} />
          )}
        </span>
        {offline}
      </span>
      <PlayerActions player={player} team={team} onKick={onKick} />
    </li>
  )
}

/** One menu for a team-mode row: make captain, move to another team, remove. */
function PlayerActions({
  player,
  team,
  onKick,
}: {
  player: PlayerPublic
  team: NonNullable<Parameters<typeof PlayerTile>[0]['team']>
  onKick: (playerId: string) => void
}) {
  const { t } = useTranslation()
  const others = team.teams.filter((x) => x.id !== player.teamId)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9 shrink-0 rounded-full text-muted-foreground"
          aria-label={t('host.game.playerActions', { name: player.name })}
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 min-w-52 overflow-y-auto">
        {team.captain === false && (
          <DropdownMenuItem onSelect={() => team.onCaptain(player.id)}>
            <CrownIcon className="text-warning" aria-hidden="true" />
            {t('host.game.makeCaptainShort')}
          </DropdownMenuItem>
        )}
        {others.length > 0 && (
          <>
            <DropdownMenuLabel>{t('host.game.moveTo')}</DropdownMenuLabel>
            {others.map((other) => (
              <DropdownMenuItem key={other.id} onSelect={() => team.onMove(player.id, other.id)}>
                <ArrowRightLeftIcon aria-hidden="true" />
                <span className="truncate">{other.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            if (window.confirm(t('host.game.confirmKick', { name: player.name }))) onKick(player.id)
          }}
        >
          <XIcon aria-hidden="true" />
          {t('host.game.kick')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
