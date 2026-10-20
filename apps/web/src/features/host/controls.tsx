import type { HostCommand, HostSnapshot } from '@quizmoo/shared'
import {
  AlarmClockPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListChecksIcon,
  MonitorIcon,
  PauseIcon,
  SkipForwardIcon,
  SmartphoneIcon,
  WifiOffIcon,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { alternativeAction, primaryAction, reconnectingCount } from './primary-action'
import { screenStatus, type SeenStatus } from './screen-status'
import { ShowAnswersDialog } from './show-answers-dialog'

/**
 * Phase-aware primary button plus the secondary actions of the current phase, in a bar that stays
 * in view while the question scrolls: at the top of the main column on laptops, at the bottom
 * above the tab bar on phones (within thumb reach). "End game" is not in the bar (`EndGameButton`).
 */
export function Controls({
  host,
  send,
  placement,
}: {
  host: HostSnapshot
  /** Resolves true when the server accepted the command. */
  send: (command: HostCommand) => Promise<boolean>
  placement: 'top' | 'bottom'
}) {
  const { t } = useTranslation()
  const [choosing, setChoosing] = useState(false)
  const onCommand = (command: HostCommand) => void send(command)
  const primary = primaryAction(host)
  const alternative = alternativeAction(host)
  const reconnecting = reconnectingCount(host)
  // Between questions, not while grading: the answers of closed questions on the screens.
  const canShowAnswers =
    !host.reviewing &&
    ((host.phase === 'reveal' && !host.awaitingGrading) || host.phase === 'scoreboard') &&
    host.questionStats.length > 0
  // Stepping through the questions chosen with "Show answers".
  const queue = host.reviewing ? (host.reviewQueue ?? []) : []
  const at = queue.indexOf(host.questionIndex)
  const previous = at > 0 ? queue[at - 1] : undefined
  const following = at >= 0 && at < queue.length - 1 ? queue[at + 1] : undefined
  const hint = (text: string, tone: 'warning' | 'secondary', status = true) => (
    <p
      role={status ? 'status' : undefined}
      className={cn(
        'rounded-xl px-4 py-1.5 text-center text-sm font-semibold',
        tone === 'warning' ? 'bg-warning text-warning-foreground' : 'bg-secondary text-secondary-foreground',
      )}
    >
      {text}
    </p>
  )
  const secondary = alternative !== null || host.phase === 'question' || canShowAnswers || queue.length > 1
  return (
    <div
      className={cn(
        'sticky z-30 isolate',
        placement === 'top' ? 'top-3' : 'bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)]',
        // A halo of the page colour keeps what scrolls under the bar apart from it.
        'before:absolute before:-inset-x-3 before:-inset-y-3 before:-z-10 before:rounded-[2.5rem] before:bg-background/85 before:blur-xl',
      )}
    >
      <div
        role="group"
        aria-label={t('host.game.controls')}
        className="flex flex-col gap-2 rounded-2xl border bg-card p-2.5 shadow-soft"
      >
        <SeenChip host={host} />
        {primary && (
          <Button size={placement === 'top' ? 'xl' : 'lg'} className="w-full" onClick={() => onCommand(primary.command)}>
            {t(primary.label)}
          </Button>
        )}
        {reconnecting !== null && (
          <p role="status" className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-muted-foreground">
            <WifiOffIcon className="size-4" aria-hidden="true" />
            {t('host.game.reconnectingHint', { count: reconnecting })}
          </p>
        )}
        {(host.resultsPending || host.playersWaiting) &&
          hint(
            t(
              host.resultsPending && host.playersWaiting
                ? 'host.game.resultsPendingHint'
                : host.playersWaiting
                  ? 'host.game.playersWaitingHint'
                  : 'host.game.podiumPendingHint',
            ),
            'warning',
            false,
          )}
        {host.phase === 'question' && host.pausedAt && hint(t('host.game.pausedHint'), 'warning')}
        {host.reviewing && hint(t('host.game.shownAgainHint', { index: host.questionIndex + 1 }), 'secondary')}
        {host.phase === 'reveal' && host.awaitingGrading && hint(t('host.game.gradeFirst'), 'warning', false)}
        {secondary && (
          // One row also on a phone in Hungarian: tighter buttons, icons from sm up.
          <div className="flex gap-2 [&_button]:min-w-0 max-sm:[&_button]:px-2 max-sm:[&_svg]:hidden">
            {queue.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={previous === undefined}
                  onClick={() => previous !== undefined && onCommand({ type: 'showQuestion', index: previous })}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                  {t('host.showAnswers.previous')}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={following === undefined}
                  onClick={() => following !== undefined && onCommand({ type: 'showQuestion', index: following })}
                >
                  {t('host.showAnswers.next')}
                  <ChevronRightIcon aria-hidden="true" />
                </Button>
              </>
            )}
            {alternative && (
              <Button variant="secondary" className="flex-1" onClick={() => onCommand(alternative.command)}>
                {t(alternative.label)}
              </Button>
            )}
            {canShowAnswers && (
              <Button variant="secondary" className="flex-1" onClick={() => setChoosing(true)}>
                <ListChecksIcon aria-hidden="true" />
                {t('host.showAnswers.open')}
              </Button>
            )}
            {host.phase === 'question' && (
              <>
                {/* While paused, Resume is the primary button. */}
                {!host.pausedAt && (
                  <Button variant="secondary" className="flex-1" onClick={() => onCommand({ type: 'pause' })}>
                    <PauseIcon aria-hidden="true" />
                    {t('host.game.pause')}
                  </Button>
                )}
                <Button variant="secondary" className="flex-1" onClick={() => onCommand({ type: 'extendTime', seconds: 30 })}>
                  <AlarmClockPlusIcon aria-hidden="true" />
                  {t('host.game.extend')}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => onCommand({ type: 'skip' })}>
                  <SkipForwardIcon aria-hidden="true" />
                  {t('host.game.skip')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {choosing && <ShowAnswersDialog host={host} onCommand={send} onClose={() => setChoosing(false)} />}
    </div>
  )
}

/** What the phones and the projector show right now; one line when they show the same. */
function SeenChip({ host }: { host: HostSnapshot }) {
  const { t } = useTranslation()
  const phones = screenStatus(host, 'phones')
  const projector = screenStatus(host, 'projector')
  const text = (status: SeenStatus) => t(status.key, status.values)
  const same = phones.key === projector.key
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-xl bg-muted px-3 py-1 text-center text-sm font-semibold" role="status">
      <span className="inline-flex items-center gap-1.5">
        <SmartphoneIcon className="size-4 shrink-0" aria-hidden="true" />
        {same && <MonitorIcon className="size-4 shrink-0" aria-hidden="true" />}
        <span className="text-muted-foreground">{t(same ? 'host.seen.everyone' : 'host.seen.phones')}</span>
        {text(phones)}
      </span>
      {!same && (
        <span className="inline-flex items-center gap-1.5">
          <MonitorIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground">{t('host.seen.projector')}</span>
          {text(projector)}
        </span>
      )}
    </p>
  )
}

/**
 * Ends the game from any phase; below the question, away from the buttons pressed every few
 * seconds. The host chooses: the podium as usual, or close it at once (no podium, every phone and
 * the projector sent away), after which the host lands on the results.
 */
export function EndGameButton({
  host,
  send,
  gameId,
}: {
  host: HostSnapshot
  send: (command: HostCommand) => Promise<boolean>
  gameId: string | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  if (host.phase === 'finished') return null
  const held = host.settings.finalResults === 'onRelease'
  async function end(command: HostCommand) {
    setPending(true)
    const ok = await send(command)
    setPending(false)
    if (!ok) return
    setOpen(false)
    if (command.type === 'close') void (gameId ? navigate({ to: '/host/results/$gameId', params: { gameId } }) : navigate({ to: '/host' }))
  }
  const choice = (command: HostCommand, label: string, help: string, variant: 'default' | 'destructive') => (
    <div className="flex flex-col gap-1.5">
      <Button variant={variant} size="lg" className="w-full" disabled={pending} onClick={() => void end(command)}>
        {label}
      </Button>
      <p className="text-sm text-muted-foreground">{help}</p>
    </div>
  )
  return (
    <>
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        {t('host.game.end')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-10">{t('host.endGame.title')}</DialogTitle>
            <DialogDescription>{t('host.endGame.help')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {choice({ type: 'end' }, t('host.endGame.podium'), t(held ? 'host.endGame.podiumHeldHelp' : 'host.endGame.podiumHelp'), 'default')}
            {choice({ type: 'close' }, t('host.endGame.close'), t('host.endGame.closeHelp'), 'destructive')}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
