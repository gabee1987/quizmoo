import { PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChoiceCards, type Choice } from '@/components/choice-cards'
import { Collapse } from '@/components/collapse'
import { TextField } from '@/components/text-field'

/** The picker's value for "New team" (team ids never look like this). */
export const NEW_TEAM = '+new'

/** What the join (or `player:team`) payload says about the team, or null while nothing valid is picked. */
export function teamChoice(selected: string, newName: string): { teamId: string } | { newTeamName: string } | null {
  if (selected === NEW_TEAM) return newName.trim() ? { newTeamName: newName.trim() } : null
  return selected ? { teamId: selected } : null
}

/**
 * A team game's teams with their member counts, plus "New team" with a name field when players
 * may create teams. Used on the join page and in the phone lobby (a player whose team was removed).
 */
export function TeamPicker({
  teams,
  newTeams,
  selected,
  newName,
  onSelect,
  onNewName,
  error,
}: {
  teams: readonly { id: string; name: string; memberCount: number }[]
  newTeams: boolean
  selected: string
  newName: string
  onSelect: (value: string) => void
  onNewName: (name: string) => void
  error?: ReactNode
}) {
  const { t } = useTranslation()
  const choices: Choice<string>[] = teams.map((team) => ({
    value: team.id,
    label: team.name,
    description: t('join.teamMembers', { count: team.memberCount }),
  }))
  if (newTeams) {
    choices.push({
      value: NEW_TEAM,
      label: (
        <span className="flex items-center gap-1.5">
          <PlusIcon className="size-4" aria-hidden="true" />
          {t('join.newTeam')}
        </span>
      ),
      description: t('join.newTeamHelp'),
    })
  }
  return (
    <div className="flex flex-col gap-3">
      <ChoiceCards legend={t('join.team')} value={selected} columns={1} choices={choices} onChange={onSelect} help={error} />
      <Collapse open={selected === NEW_TEAM} className="-mt-3" innerClassName="pt-3">
        <TextField
          label={t('join.newTeamName')}
          name="newTeamName"
          maxLength={40}
          autoComplete="off"
          value={newName}
          onChange={(e) => onNewName(e.target.value)}
          placeholder={t('join.newTeamPlaceholder')}
        />
      </Collapse>
    </div>
  )
}
