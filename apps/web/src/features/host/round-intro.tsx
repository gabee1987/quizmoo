import type { HostSnapshot } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Timer } from '../../components/timer'

/**
 * A round's intro on the host control: what the screens show (its title, info and picture), how
 * many questions it holds, and its countdown when it moves on by itself.
 */
export function RoundIntro({ host, clockOffset }: { host: HostSnapshot; clockOffset: number }) {
  const { t } = useTranslation()
  const { group } = host
  if (!group) return null
  const seconds = host.settings.groupIntroSec
  return (
    <section aria-labelledby="round-intro" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{t('play.roundOf', { index: group.index + 1, count: group.count })}</Badge>
        <Badge variant="outline">{t('play.roundQuestions', { count: group.questionCount })}</Badge>
        <Badge variant="outline">
          {t('play.questionRange', { first: group.firstIndex + 1, last: group.firstIndex + group.questionCount })}
        </Badge>
      </div>
      {group.imageId && (
        <img src={`/api/images/${group.imageId}`} alt="" className="max-h-56 self-center rounded-2xl object-contain shadow-soft" />
      )}
      <h2 id="round-intro" className="text-2xl font-extrabold wrap-break-word">
        {group.title}
      </h2>
      {group.info && <p className="whitespace-pre-line wrap-break-word">{group.info}</p>}
      {host.introEndsAt !== null ? (
        <Timer endsAt={host.introEndsAt} totalMs={seconds * 1000} clockOffset={clockOffset} pausedAt={host.pausedAt} />
      ) : (
        <p className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold">{t('host.game.introWaits')}</p>
      )}
    </section>
  )
}
