import type { HostSnapshot } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { AnnouncementBanner } from '@/components/announcement-banner'
import { Timer } from '@/components/timer'
import { resultsWhen } from '@/lib/results-when'
import { useScreenLook } from '@/lib/season'
import { gameVars } from '@/lib/themes'
import { reviewPosition } from '../play/review-position'
import { PhoneRoundIntro } from '../play/round-intro'
import { RankList, TeamRankList, standingsHeading } from '../play/scoreboard'
import { CorrectAnswer } from '../questions/correct-answer'
import { QuestionInput } from '../questions/question-input'

/**
 * What the host has put on the phones right now, drawn from the host's own snapshot in a phone
 * frame: the screen every player gets, not one player's live phone (their own answer and result
 * differ per phone, and the preview says so).
 */
export function PhoneScreenPreview({ host, clockOffset }: { host: HostSnapshot; clockOffset: number }) {
  const { settings } = host
  // The phones' own look, which can differ from the host's (`seasonalLook`).
  const { theme } = useScreenLook(settings, 'phones')
  return (
    <div
      data-theme={theme}
      style={gameVars({ ...settings, theme })}
      data-palette={settings.answerPalette}
      className="mx-auto w-[375px] max-w-full rounded-[2.5rem] border-8 border-foreground/85 bg-background p-4 text-foreground shadow-soft"
    >
      {/* Inert: a picture of the phones, nothing to press. */}
      <div className="pointer-events-none flex min-h-[32rem] flex-col gap-4" inert>
        {host.announcement && <AnnouncementBanner announcement={host.announcement} clockOffset={clockOffset} />}
        <PhoneBody host={host} clockOffset={clockOffset} />
      </div>
    </div>
  )
}

function PhoneBody({ host, clockOffset }: { host: HostSnapshot; clockOffset: number }) {
  const { t } = useTranslation()
  const label = (extra = '') => (
    <p className="text-sm font-semibold text-muted-foreground">
      {t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}
      {extra}
    </p>
  )
  const card = (title: string, text?: string) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="text-3xl font-black">{title}</p>
      {text && <p className="font-semibold text-muted-foreground">{text}</p>}
    </div>
  )

  switch (host.phase) {
    case 'lobby':
      return card(t('host.seen.lobby'))
    case 'intro':
      return <PhoneRoundIntro snapshot={host} clockOffset={clockOffset} />
    case 'question': {
      const question = host.question
      if (!question || host.questionEndsAt === null) return null
      return (
        <>
          {label()}
          <Timer endsAt={host.questionEndsAt} totalMs={question.timeLimitSec * 1000} clockOffset={clockOffset} pausedAt={host.pausedAt} />
          <p className="text-2xl font-black wrap-break-word">{question.text}</p>
          {question.imageId && <img src={`/api/images/${question.imageId}`} alt="" className="max-h-40 self-center rounded-2xl object-contain" />}
          <QuestionInput question={question} mode="answer" colourful={host.settings.answerStyle === 'colourful'} symbols={host.settings.answerSymbols} />
        </>
      )
    }
    case 'reveal': {
      if (host.answersHidden && !host.reviewing) return card(t('play.answerKept'), t(resultsWhen(host.settings)))
      if (host.awaitingGrading && !host.reviewing) return card(t('play.awaitingGrading'))
      const reveal = host.reveal
      if (!reveal) return null
      return (
        <>
          {label(host.reviewing ? ` · ${t('play.shownAgain')}${reviewPosition(host)}` : '')}
          <p className="text-2xl font-black wrap-break-word">{reveal.question.text}</p>
          <CorrectAnswer question={reveal.question} symbols={host.settings.answerSymbols} />
          {reveal.question.type !== 'poll' && (
            <p className="rounded-xl bg-muted px-3 py-2 text-center text-sm font-semibold text-muted-foreground">
              {t(host.answersHidden ? 'host.preview.ownResult' : 'host.preview.ownResultPoints')}
            </p>
          )}
        </>
      )
    }
    case 'scoreboard': {
      // While answers are held back the phones get totals and ranks only, nothing that moved.
      const still = <T extends { rank: number }>(rows: T[]) => (host.answersHidden ? rows.map((r) => ({ ...r, previousRank: r.rank, roundPoints: 0 })) : rows)
      return (
        <>
          <p className="rounded-xl bg-muted px-3 py-2 text-center text-sm font-semibold text-muted-foreground">{t('host.preview.ownRank')}</p>
          {host.mode === 'team' && (
            <>
              <p className="text-center text-xl font-extrabold">{t(standingsHeading(host.teams))}</p>
              <TeamRankList teams={still(host.teams)} myTeamId={null} />
            </>
          )}
          <p className="text-center text-xl font-extrabold">{t('play.leaderboard')}</p>
          <RankList players={still(host.players)} limit={5} />
        </>
      )
    }
    case 'finished':
      if (host.playersWaiting) return card(t('play.gameOver'), t('play.resultsComing'))
      return (
        <>
          <p className="text-center text-3xl font-black">{t('play.gameOver')}</p>
          {host.mode === 'team' ? (
            <TeamRankList teams={host.teams.slice(0, 3)} myTeamId={null} />
          ) : (
            <RankList players={host.players} limit={3} />
          )}
        </>
      )
  }
}
