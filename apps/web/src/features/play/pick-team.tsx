import { MAX_TEAMS, playersCreateTeams, type PlayerSnapshot } from '@quizmoo/shared'
import { CheckIcon, Loader2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { emitAck } from '../../lib/socket'
import { TeamPicker, teamChoice } from '../join/team-picker'

/** A player in the lobby without a team (the host removed theirs) picks another one, or creates one. */
export function PickTeam({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState('')
  const [newName, setNewName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const choice = teamChoice(selected, newName)
  const newTeams = playersCreateTeams(snapshot.settings.teamSetup) && snapshot.teams.filter((x) => !x.solo).length < MAX_TEAMS

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!choice) return setError(selected ? 'join.newTeamNameRequired' : 'errors.unknownTeam')
    setPending(true)
    setError(null)
    const res = await emitAck('player:team', choice)
    if ('error' in res) setError(res.error)
    setPending(false)
  }

  return (
    <form
      className="flex w-full max-w-sm animate-fade-up flex-col gap-4 rounded-3xl border bg-card p-5 text-left shadow-soft"
      onSubmit={(e) => void submit(e)}
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold">{t('play.team.pickAgain')}</h2>
        <p className="text-sm text-muted-foreground">{t('play.team.pickAgainHelp')}</p>
      </div>
      <TeamPicker
        teams={snapshot.teams}
        newTeams={newTeams}
        solo={snapshot.settings.soloPlayers}
        selected={selected}
        newName={newName}
        onSelect={setSelected}
        onNewName={setNewName}
      />
      {error && <FormAlert>{t(error)}</FormAlert>}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
        {t('play.team.pickTeam')}
      </Button>
    </form>
  )
}
