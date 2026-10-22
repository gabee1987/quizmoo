import type { Answer, PlayerSnapshot } from '@quizmoo/shared'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { PausedNote } from '@/components/paused-note'
import { RoundChip } from '@/components/round-chip'
import { Button } from '@/components/ui/button'
import { useNow } from '@/lib/clock'
import { Timer } from '../../components/timer'
import { stagger } from '../../lib/motion'
import { emitAck, sendAnswer } from '../../lib/socket'
import { QuestionInput } from '../questions/question-input'
import { Answered } from './answered'
import { captainDecides, changeWindow, confirmsForTeam, myTeamSize } from './change-window'
import { usePicksOpen } from './picks-open'
import { TeamPicksPanel } from './team-picks-panel'
import { picksByOption } from './team-picks'

/** Question phase. Keyed by question id by the caller, so local state resets per question. */
export function Question({ snapshot, clockOffset }: { snapshot: PlayerSnapshot; clockOffset: number }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Showing the question again to change the answer; falls back to the answered view when the lock-in starts.
  const [changing, setChanging] = useState(false)
  const [picksOpen, setPicksOpen] = usePicksOpen(snapshot.pin, false)
  const picksRef = useRef<HTMLDetailsElement>(null)
  const now = useNow(changing) + clockOffset
  const question = snapshot.question
  const paused = snapshot.pausedAt !== null
  const decides = captainDecides(snapshot)
  // A team of one has nobody to show picks to.
  const live = myTeamSize(snapshot) > 1 ? snapshot.teamLive : null
  const captain = confirmsForTeam(snapshot)
  // Captain decides: the team is done once the captain confirms; members' picks are suggestions until then.
  const confirmed = decides && Boolean(live?.answer)
  const done = decides ? confirmed : snapshot.myAnswer !== null

  if (!question) return null
  if (done && !(changing && changeWindow(snapshot, now))) {
    return <Answered snapshot={snapshot} clockOffset={clockOffset} onChange={() => setChanging(true)} />
  }

  async function submit(answer: Answer) {
    if (!question) return
    // The captain changing a confirmed answer confirms the new one at once.
    if (captain && confirmed) return confirm(answer)
    setPending(true)
    setError(null)
    // Stays pending through a reconnect and one retry.
    const res = await sendAnswer({ questionId: question.id, answer })
    if (!('error' in res)) {
      setChanging(false)
    } else if (res.error === 'errors.answerLocked') {
      // The previous answer stands (or the captain has confirmed meanwhile); back to the answered view.
      toast.error(t(res.error), { id: res.error })
      setChanging(false)
    } else {
      if (res.error === 'errors.answerNotSent') toast.error(t(res.error), { id: res.error })
      else setError(res.error)
      if (res.error === 'errors.questionClosed' || res.error === 'errors.alreadyAnswered') setClosed(true)
    }
    // On success the next snapshot carries myAnswer and switches to the answered view (a changed answer at once).
    setPending(false)
  }

  async function confirm(answer: Answer) {
    if (!question) return
    setPending(true)
    const res = await emitAck('player:confirmTeamAnswer', { questionId: question.id, answer })
    if ('error' in res) toast.error(t(res.error), { id: res.error })
    else setChanging(false)
    setPending(false)
  }

  function showPicks() {
    setPicksOpen(true)
    // The panel sits below the options; bring it up on a small screen.
    requestAnimationFrame(() => picksRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  const players = (ids: string[]) =>
    ids.flatMap((id) => {
      const player = snapshot.players.find((p) => p.id === id)
      return player ? [{ id: player.id, name: player.name, avatar: player.avatar }] : []
    })
  const picks = live ? Object.fromEntries(Object.entries(picksByOption(live, snapshot.me.id)).map(([key, ids]) => [key, players(ids)])) : undefined
  const teamNote =
    !decides ? null : captain ? t('play.team.youDecide') : snapshot.myAnswer ? t('play.team.waitingCaptain') : t('play.team.suggest')
  const disabled = pending || closed || paused

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="flex min-w-0 animate-fade-up flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-muted-foreground">
        {t('play.questionOf', { index: snapshot.questionIndex + 1, count: snapshot.questionCount })}
        <RoundChip group={snapshot.group} />
      </p>
      {snapshot.questionEndsAt !== null && (
        <Timer
          endsAt={snapshot.questionEndsAt}
          totalMs={question.timeLimitSec * 1000}
          clockOffset={clockOffset}
          pausedAt={snapshot.pausedAt}
        />
      )}
      {paused && <PausedNote />}
      <h1 className="animate-fade-up text-2xl font-black wrap-break-word" style={stagger(1, 0, 60)}>
        {question.text}
      </h1>
      {/*
        The image takes the space the answers leave (3 : 2 with them) and shrinks to fit, so the
        image and every answer are on screen together; it never gets smaller than 7 rem.
      */}
      {question.imageId && (
        <div className="relative min-h-28 flex-3">
          <img
            src={`/api/images/${question.imageId}`}
            alt=""
            className="absolute inset-0 m-auto max-h-full max-w-full animate-pop rounded-2xl object-contain shadow-soft"
            style={stagger(1, 0, 120)}
          />
        </div>
      )}
      {error && <FormAlert>{t(error)}</FormAlert>}
      {teamNote && (
        <p role="status" className="text-center text-sm font-bold">
          {teamNote}
        </p>
      )}
      <div className="flex flex-2 flex-col">
        <QuestionInput
          question={question}
          mode="answer"
          disabled={disabled}
          pending={pending}
          colourful={snapshot.settings.answerStyle === 'colourful'}
          symbols={snapshot.settings.answerSymbols}
          initial={confirmed ? live?.answer : snapshot.myAnswer}
          onSubmit={(a) => void submit(a)}
          picks={picks}
          onPicks={showPicks}
        />
        {/* The captain confirms their own pick; a teammate's is confirmed from the panel. */}
        {captain && !confirmed && snapshot.myAnswer && (
          <Button size="lg" className="mt-3" disabled={disabled} onClick={() => void confirm(snapshot.myAnswer!)}>
            {t('play.team.confirm')}
          </Button>
        )}
        {changing && (
          <Button variant="ghost" className="mt-3" disabled={pending} onClick={() => setChanging(false)}>
            {t('play.keepAnswer')}
          </Button>
        )}
      </div>
      {live && (
        <TeamPicksPanel
          ref={picksRef}
          snapshot={snapshot}
          live={live}
          open={picksOpen}
          onOpenChange={setPicksOpen}
          onUse={captain ? (answer) => void confirm(answer) : undefined}
          disabled={disabled}
        />
      )}
    </div>
  )
}
