import type { GameSettings, PlayerSnapshot } from '@quizmoo/shared'
import { EyeOffIcon, FlameIcon, ListOrderedIcon, PencilIcon, UserPlusIcon, UsersIcon, ZapIcon } from 'lucide-react'
import type { ComponentType } from 'react'

export interface InfoLine {
  icon: ComponentType<{ className?: string }>
  /** i18n key. */
  text: string
  values?: Record<string, number>
}

/** The lobby's "About the game" lines: the question count, how players score, and only the rules that are on. */
export function gameInfo(settings: GameSettings, mode: PlayerSnapshot['mode'], questionCount: number, groupCount = 0): InfoLine[] {
  const lines: (InfoLine | false)[] = [
    groupCount > 0
      ? { icon: ListOrderedIcon, text: 'play.info.questionsInRounds', values: { questions: questionCount, count: groupCount } }
      : { icon: ListOrderedIcon, text: 'play.info.questions', values: { count: questionCount } },
    { icon: UsersIcon, text: mode === 'team' ? (settings.soloPlayers ? 'play.info.teamsAndSolo' : 'play.info.teams') : 'play.info.classic' },
    settings.speedBonus && { icon: ZapIcon, text: 'play.info.speedBonus' },
    settings.streakBonus && { icon: FlameIcon, text: 'play.info.streakBonus' },    settings.answerChanges &&
      (settings.answerLockSec > 0
        ? { icon: PencilIcon, text: 'play.info.answerChangesLocked', values: { count: settings.answerLockSec } }
        : { icon: PencilIcon, text: 'play.info.answerChanges' }),
    settings.revealAnswers === 'atEnd' && { icon: EyeOffIcon, text: 'play.info.answersAtEnd' },
    settings.revealAnswers === 'afterGroup' && groupCount > 0 && { icon: EyeOffIcon, text: 'play.info.answersAtRoundEnd' },
    settings.lateJoin && { icon: UserPlusIcon, text: 'play.info.lateJoin' },
  ]
  return lines.filter((line): line is InfoLine => line !== false)
}
