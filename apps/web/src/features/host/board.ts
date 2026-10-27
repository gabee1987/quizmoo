import type { CurrentAnswer, HostSnapshot, PlayerPublic, TeamPublic } from '@quizmoo/shared'

/** How the board orders its players: by name (nobody moves), rank, answer time, or the missing ones first. */
export const boardSorts = ['name', 'rank', 'answer', 'waiting'] as const
export type BoardSort = (typeof boardSorts)[number]

/**
 * A player on the board:
 * - `waiting`: the question runs, no answer yet;
 * - `answered`: has an answer to the question on the screens;
 * - `missed`: the question is over without their answer;
 * - `idle`: no question (a round's intro).
 */
export type TileStatus = 'waiting' | 'answered' | 'missed' | 'idle'

export interface BoardEntry {
  player: PlayerPublic
  status: TileStatus
  answer: CurrentAnswer | null
  /** The verdict so far while the question runs, the result afterwards; null for polls and ungraded text. */
  correct: boolean | null
}

/** A team's players in team mode (`team` null: the players on their own); one group of everyone otherwise. */
export interface BoardGroup {
  team: TeamPublic | null
  entries: BoardEntry[]
  answered: number
}

const byName = (a: BoardEntry, b: BoardEntry) => a.player.name.localeCompare(b.player.name)

function compare(sort: BoardSort): (a: BoardEntry, b: BoardEntry) => number {
  const time = (e: BoardEntry) => e.answer?.timeMs ?? Number.POSITIVE_INFINITY
  switch (sort) {
    case 'name':
      return byName
    case 'rank':
      return (a, b) => a.player.rank - b.player.rank || byName(a, b)
    case 'answer':
      return (a, b) => time(a) - time(b) || byName(a, b)
    case 'waiting':
      // Missing answers first (online before offline: those can still answer), then the answers by time.
      return (a, b) =>
        Number(a.answer !== null) - Number(b.answer !== null) ||
        Number(!a.player.connected) - Number(!b.player.connected) ||
        time(a) - time(b) ||
        byName(a, b)
  }
}

/** Every player's state for the question on the screens. */
export function boardEntries(host: HostSnapshot): BoardEntry[] {
  const answers = new Map((host.currentAnswers ?? []).map((a) => [a.playerId, a]))
  const running = host.phase === 'question'
  const questionShown = running || host.reveal !== null
  return host.players.map((player) => {
    const answer = answers.get(player.id) ?? null
    const status: TileStatus = !questionShown ? 'idle' : answer ? 'answered' : running ? 'waiting' : 'missed'
    return { player, status, answer, correct: answer?.correct ?? null }
  })
}

/**
 * The board's groups, each sorted: in team mode one per team in standings order, with the players
 * on their own (solo entries) together last; otherwise one group of everyone.
 */
export function boardGroups(host: HostSnapshot, sort: BoardSort): BoardGroup[] {
  const entries = boardEntries(host)
  const group = (team: TeamPublic | null, list: BoardEntry[]): BoardGroup => ({
    team,
    entries: [...list].sort(compare(sort)),
    answered: list.filter((e) => e.answer).length,
  })
  if (host.mode !== 'team') return [group(null, entries)]
  const teams = [...host.teams].filter((t) => !t.solo).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
  const teamIds = new Set(teams.map((t) => t.id))
  const groups = teams.map((team) => group(team, entries.filter((e) => e.player.teamId === team.id))).filter((g) => g.entries.length > 0)
  const others = entries.filter((e) => !e.player.teamId || !teamIds.has(e.player.teamId))
  return others.length > 0 ? [...groups, group(null, others)] : groups
}

export const tileSizes = ['lg', 'md', 'sm'] as const
export type TileSize = (typeof tileSizes)[number]

/** Each size's narrowest column, the gap between tiles and a tile's height, in CSS pixels (see `PlayerBoard`). */
export const tileMetrics: Record<TileSize, { width: number; gap: number; height: number }> = {
  lg: { width: 240, gap: 8, height: 72 },
  md: { width: 176, gap: 6, height: 62 },
  sm: { width: 144, gap: 4, height: 32 },
}
/** A team's header line, and the space between two groups. */
const GROUP_HEADER = 32
const GROUP_GAP = 12

/**
 * The largest tile size whose tiles all fit the board's box: big tiles while few play, smaller as
 * the room fills, so 60 players still fit a laptop screen. Without a box (a phone, where the page
 * scrolls) by the player count alone.
 */
export function fitTileSize(box: { width: number; height: number } | null, groupSizes: number[], headers: boolean): TileSize {
  const count = groupSizes.reduce((sum, n) => sum + n, 0)
  if (!box) return count <= 12 ? 'lg' : count <= 30 ? 'md' : 'sm'
  for (const size of ['lg', 'md'] as const) {
    const { width, gap, height } = tileMetrics[size]
    const columns = Math.max(1, Math.floor((box.width + gap) / (width + gap)))
    const tiles = groupSizes.reduce((sum, n) => {
      const rows = Math.ceil(n / columns)
      return sum + rows * height + Math.max(0, rows - 1) * gap
    }, 0)
    const needed = tiles + (headers ? groupSizes.length * GROUP_HEADER : 0) + Math.max(0, groupSizes.length - 1) * GROUP_GAP
    if (needed <= box.height) return size
  }
  return 'sm'
}
