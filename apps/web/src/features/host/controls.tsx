import type { HostCommand, HostSnapshot } from '@quizmoo/shared'
import { AlarmClockPlusIcon, PauseIcon, SkipForwardIcon, WifiOffIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { alternativeAction, primaryAction, reconnectingCount } from './primary-action'

/**
 * Phase-aware primary button plus the secondary actions of the current phase, in a bar that stays
 * in view while the question scrolls: at the top of the main column on laptops, at the bottom
 * above the tab bar on phones (within thumb reach). "End game" is not in the bar (`EndGameButton`).
 */
export function Controls({
  host,
  onCommand,
  placement,
}: {
  host: HostSnapshot
  onCommand: (command: HostCommand) => void
  placement: 'top' | 'bottom'
}) {
  const { t } = useTranslation()
  const primary = primaryAction(host)
  const alternative = alternativeAction(host)
  const reconnecting = reconnectingCount(host)
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
  const secondary = alternative !== null || host.phase === 'question'
  const hints =
    reconnecting !== null ||
    host.resultsPending ||
    host.playersWaiting ||
    (host.phase === 'question' && host.pausedAt !== null) ||
    host.reviewing ||
    (host.phase === 'reveal' && host.awaitingGrading)
  // Nothing to press and nothing to say (a finished game with everything released).
  if (!primary && !secondary && !hints) return null

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
            {alternative && (
              <Button variant="secondary" className="flex-1" onClick={() => onCommand(alternative.command)}>
                {t(alternative.label)}
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
    </div>
  )
}

/** Ends the game after a confirmation; below the question, away from the buttons pressed every few seconds. */
export function EndGameButton({ host, onCommand }: { host: HostSnapshot; onCommand: (command: HostCommand) => void }) {
  const { t } = useTranslation()
  if (host.phase === 'finished') return null
  return (
    <Button
      variant="outline"
      className="self-start"
      onClick={() => {
        if (window.confirm(t('host.game.confirmEnd'))) onCommand({ type: 'end' })
      }}
    >
      {t('host.game.end')}
    </Button>
  )
}
