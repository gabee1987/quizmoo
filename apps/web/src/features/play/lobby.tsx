import type { PlayerSnapshot, TeamPublic } from '@quizmoo/shared'
import { BrandingMark } from '@/components/branding-mark'
import { useMediaQuery } from '@/lib/use-media-query'
import { GameInfoCard, PinCard, PlayerCard } from './lobby-parts'
import { PickTeam } from './pick-team'
import { TeamCard } from './team-card'

/** From here on the waiting screen uses the desktop layout (Tailwind's `lg`). */
const DESKTOP = '(min-width: 64rem)'

/**
 * Waiting for the start: who the player is and which team they play for, that the game is about
 * to start and how many have joined, the PIN to pass on, the team and what the game is like.
 * Phones and desktops each get their own layout of the same parts (`lobby-parts.tsx`).
 */
export function Lobby({ snapshot }: { snapshot: PlayerSnapshot }) {
  const desktop = useMediaQuery(DESKTOP)
  const team = snapshot.teams.find((x) => x.id === snapshot.me.teamId)
  return desktop ? <DesktopLobby snapshot={snapshot} team={team} /> : <PhoneLobby snapshot={snapshot} team={team} />
}

interface LayoutProps {
  snapshot: PlayerSnapshot
  team: TeamPublic | undefined
}

/** The team part: the player's team, or the picker for a player without one (the host removed theirs). */
function TeamPart({ snapshot, team }: LayoutProps) {
  if (snapshot.mode === 'team' && !snapshot.me.teamId) return <PickTeam snapshot={snapshot} />
  return team && !team.solo ? <TeamCard snapshot={snapshot} team={team} /> : null
}

/** One column, phone wide, in the order a thumb scrolls: who I am, the PIN, my team, the game. */
function PhoneLobby({ snapshot, team }: LayoutProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-4">
        {snapshot.branding && (
          <div className="flex justify-center">
            <BrandingMark branding={snapshot.branding} size="phone" />
          </div>
        )}
        <PlayerCard snapshot={snapshot} team={team} />
        <PinCard pin={snapshot.pin} />
        <TeamPart snapshot={snapshot} team={team} />
        <GameInfoCard snapshot={snapshot} />
      </div>
    </div>
  )
}

/**
 * Two columns: on the left, who the player is and the PIN, staying in view; on the right, the team
 * and what the game is like, with room for the rules side by side.
 */
function DesktopLobby({ snapshot, team }: LayoutProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 py-6">
      {snapshot.branding && (
        <div className="flex justify-center">
          <BrandingMark branding={snapshot.branding} size="phone" />
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-6">
        <div className="sticky top-6 flex flex-col gap-4">
          <PlayerCard snapshot={snapshot} team={team} />
          <PinCard pin={snapshot.pin} />
        </div>
        <div className="flex flex-col gap-4">
          <TeamPart snapshot={snapshot} team={team} />
          <GameInfoCard snapshot={snapshot} />
        </div>
      </div>
    </div>
  )
}
