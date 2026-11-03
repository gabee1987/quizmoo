import { endLoopPages, type EndShow, type HostCommand } from '@quizmoo/shared'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { endPageIcons } from '../screen/end-show'
import { SwitchRow } from './game-settings-form'

/**
 * The projector's end pages, from the host's Finished card: a button per results page (the current
 * one pressed), Back and Next, automatic mode, and the question recap, which only the host opens.
 */
export function EndShowPanel({
  show,
  send,
}: {
  show: EndShow & { recapCount: number }
  send: (command: HostCommand) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const recap = show.page === 'recap'
  const RecapIcon = endPageIcons.recap
  return (
    <section aria-labelledby="end-show-title" className="flex flex-col gap-3 rounded-xl border p-3">
      <h3 id="end-show-title" className="font-extrabold">
        {t('host.game.endShow.title')}
      </h3>
      {/* The buttons share each row, so a last one alone stretches across. */}
      <div className="flex flex-wrap gap-2 *:grow *:basis-32">
        {endLoopPages.map((page) => {
          const Icon = endPageIcons[page]
          const current = page === show.page
          return (
            <Button
              key={page}
              variant={current ? 'default' : 'secondary'}
              size="sm"
              aria-pressed={current}
              onClick={() => void send({ type: 'endPage', page })}
            >
              <Icon aria-hidden="true" />
              {t(`screen.end.pages.${page}`)}
            </Button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => void send({ type: 'endPageStep', step: -1 })}>
          <ChevronLeftIcon aria-hidden="true" />
          {t(recap ? 'host.game.endShow.previousQuestion' : 'host.game.endShow.back')}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => void send({ type: 'endPageStep', step: 1 })}>
          {t(recap ? 'host.game.endShow.nextQuestion' : 'host.game.endShow.next')}
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
      <SwitchRow
        label={t('host.game.endShow.auto')}
        description={t('host.game.endShow.autoHelp')}
        checked={show.auto}
        onChange={(auto) => void send({ type: 'endAuto', auto })}
      />
      {show.recapCount > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="font-semibold">{t('host.game.endShow.recapTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('host.game.endShow.recapHelp')}</p>
          {recap ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="status" className="flex-1 font-semibold">
                {t('host.game.endShow.recapAt', { index: show.recapIndex + 1, count: show.recapCount })}
              </p>
              <Button variant="secondary" size="sm" onClick={() => void send({ type: 'endPage', page: 'leaderboard' })}>
                <XIcon aria-hidden="true" />
                {t('host.game.endShow.recapClose')}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => void send({ type: 'endPage', page: 'recap' })}>
              <RecapIcon aria-hidden="true" />
              {t('host.game.endShow.recapShow')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
