import type { Answer, TeamLive } from '@quizmoo/shared'

/** The options an answer marks: option ids, or 'true' / 'false'. None for text, number and ordering answers. */
export function pickKeys(answer: Answer): string[] {
  switch (answer.type) {
    case 'single':
    case 'poll':
      return [answer.optionId]
    case 'multiple':
      return answer.optionIds
    case 'truefalse':
      return [String(answer.value)]
    case 'text':
    case 'number':
    case 'order':
      return []
  }
}

/** Teammates' picks per option (the player's own is shown as selected instead), in the order the team's tally lists them. */
export function picksByOption(live: TeamLive, meId: string): Record<string, string[]> {
  const byOption: Record<string, string[]> = {}
  for (const group of live.votes) {
    for (const key of pickKeys(group.answer)) {
      for (const playerId of group.playerIds) {
        if (playerId !== meId) (byOption[key] ??= []).push(playerId)
      }
    }
  }
  return byOption
}

/** Every member with their pick, most popular picks first, then those still thinking (null). */
export function memberPicks(live: TeamLive): { playerId: string; answer: Answer | null }[] {
  return [
    ...live.votes.flatMap((group) => group.playerIds.map((playerId) => ({ playerId, answer: group.answer }))),
    ...live.waiting.map((playerId) => ({ playerId, answer: null })),
  ]
}
