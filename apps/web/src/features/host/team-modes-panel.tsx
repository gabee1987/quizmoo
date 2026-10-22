import { teamAnswerModes, type HostSnapshot, type TeamAnswerMode } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { SelectField } from '@/components/select-field'

/**
 * Between questions in team mode: the host changes a team's answer mode, from the next question
 * on. Not offered while a question runs or an answer waits for grading (the server refuses then).
 */
export function TeamModesPanel({ host, onTeamMode }: { host: HostSnapshot; onTeamMode: (mode: TeamAnswerMode, teamId: string) => void }) {
  const { t } = useTranslation()
  const betweenQuestions = (host.phase === 'reveal' && !host.awaitingGrading && !host.reviewing) || host.phase === 'scoreboard'
  if (host.mode !== 'team' || !betweenQuestions) return null
  const modeOptions = teamAnswerModes.map((mode) => ({ value: mode, label: t(`host.create.teamAnswerOptions.${mode}`) }))
  return (
    <section className="flex flex-col gap-2" aria-labelledby="team-modes">
      <h2 id="team-modes" className="text-lg font-extrabold">
        {t('host.game.teamModes')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('host.game.teamModesHelp')}</p>
      <ul className="flex flex-col gap-1">
        {host.teams.filter((team) => !team.solo).map((team) => (
          <li key={team.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
            <span className="min-w-0 font-semibold wrap-break-word">{team.name}</span>
            <SelectField
              label={t('host.game.teamMode', { team: team.name })}
              hideLabel
              value={team.answerMode}
              options={modeOptions}
              onChange={(mode) => onTeamMode(mode, team.id)}
              className="w-56"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
