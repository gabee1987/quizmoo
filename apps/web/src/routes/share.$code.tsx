import type { PublicQuestion, SharePreview, ShareRedeem } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CopyPlusIcon, EyeOffIcon, KeyRoundIcon, LibraryIcon, LogInIcon, SearchXIcon, SquarePlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyToQuizDialog } from '@/features/bank/copy-to-quiz-dialog'
import { typeIcons } from '@/features/editor/type-picker'
import { EnterCodeDialog } from '@/features/share/enter-code-dialog'
import { redeemShareCode, sharePreviewQueryOptions } from '@/features/share/queries'
import { useExpiryText } from '@/features/share/share-dialog'
import { ApiError } from '@/lib/api'
import { useHomePath } from '@/lib/auth'
import { stagger } from '@/lib/motion'
import { toastError } from '@/lib/toast'

export const Route = createFileRoute('/share/$code')({ component: SharePage })

/**
 * A share code's page: anyone with the link sees the questions without their answers; a logged-in
 * host copies them into their library, one of their quizzes, or (a whole quiz) a new quiz of their own.
 */
function SharePage() {
  const { t } = useTranslation()
  const { code } = Route.useParams()
  const preview = useQuery(sharePreviewQueryOptions(code))
  const [entering, setEntering] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-4">
      {preview.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label={t('common.loading')}>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : preview.isError ? (
        preview.error instanceof ApiError && preview.error.code === 'errors.shareCodeNotFound' ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-4 py-12 text-center shadow-soft">
            <SearchXIcon className="size-12 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-2xl font-black">{t('share.page.notFoundTitle')}</h1>
            <p className="max-w-md text-muted-foreground">{t('share.page.notFoundBody')}</p>
            <Button variant="secondary" onClick={() => setEntering(true)}>
              <KeyRoundIcon aria-hidden="true" />
              {t('share.enter.open')}
            </Button>
          </div>
        ) : (
          <FormAlert>{t(preview.error instanceof ApiError ? preview.error.code : 'errors.internal')}</FormAlert>
        )
      ) : (
        <>
          <ShareHeader preview={preview.data} />
          <ol className="flex flex-col gap-3" aria-label={t('share.page.questions')}>
            {preview.data.questions.map((question, i) => (
              <li key={question.id} className="animate-fade-up" style={stagger(Math.min(i, 10))}>
                <PreviewQuestion question={question} index={i} />
              </li>
            ))}
          </ol>
        </>
      )}
      {entering && <EnterCodeDialog onClose={() => setEntering(false)} />}
    </div>
  )
}

/** Title, what was shared, how long the code works, and what the visitor can do with it. */
function ShareHeader({ preview }: { preview: SharePreview }) {
  const { t } = useTranslation()
  const expiry = useExpiryText()
  const loggedIn = useHomePath() === '/host'
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{preview.kind === 'quiz' ? t('share.list.kindQuiz') : t('share.list.kindQuestions')}</Badge>
        <span className="font-mono font-bold tracking-wider">{preview.code}</span>
        <span className="text-muted-foreground">{expiry(preview.expiresAt)}</span>
      </div>
      <div>
        <h1 className="text-3xl font-black tracking-tight wrap-break-word">{preview.title}</h1>
        {preview.description && <p className="mt-1 wrap-break-word text-muted-foreground">{preview.description}</p>}
        <p className="mt-1 font-semibold text-muted-foreground">{t('editor.questionCount', { count: preview.questionCount })}</p>
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
        <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('share.page.answersHidden')}
      </p>
      {loggedIn ? (
        <RedeemActions preview={preview} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">
            {preview.kind === 'quiz' ? t('share.page.loginHintQuiz') : t('share.page.loginHint')}
          </p>
          <Button asChild>
            <Link to="/" search={{ side: 'host', redirect: `/share/${preview.code}` }}>
              <LogInIcon aria-hidden="true" />
              {t('share.page.login')}
            </Link>
          </Button>
        </div>
      )}
    </section>
  )
}

/** The logged-in host's choices: a shared quiz joins their quizzes; shared questions go to the library or the end of a quiz. */
function RedeemActions({ preview }: { preview: SharePreview }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [picking, setPicking] = useState(false)
  const redeem = useMutation({
    mutationFn: (body: ShareRedeem) => redeemShareCode(preview.code, body),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      void queryClient.invalidateQueries({ queryKey: ['bank'] })
      if (result.target === 'newQuiz' && result.quizId) {
        toast.success(t('share.page.quizAdded'))
        void navigate({ to: '/host/quizzes/$quizId', params: { quizId: result.quizId } })
      } else if (result.target === 'bank') {
        toast.success(t('share.page.addedToLibrary', { count: result.added }), {
          action: { label: t('share.page.openLibrary'), onClick: () => void navigate({ to: '/host/library' }) },
        })
      }
    },
    onError: toastError,
  })
  // A shared quiz arrives as a quiz of the host's own; shared questions go to the library or a quiz.
  if (preview.kind === 'quiz') {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">{t('share.page.quizHelp')}</p>
        <Button disabled={redeem.isPending} onClick={() => redeem.mutate({ target: 'newQuiz' })}>
          <CopyPlusIcon aria-hidden="true" />
          {t('share.page.addQuiz')}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('share.page.questionsHelp', { count: preview.questionCount })}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="sm:flex-1" disabled={redeem.isPending} onClick={() => redeem.mutate({ target: 'bank' })}>
          <LibraryIcon aria-hidden="true" />
          {t('share.page.toLibrary')}
        </Button>
        <Button variant="outline" className="sm:flex-1" disabled={redeem.isPending} onClick={() => setPicking(true)}>
          <SquarePlusIcon aria-hidden="true" />
          {t('share.page.toQuiz')}
        </Button>
      </div>
      {picking && (
        <CopyToQuizDialog
          count={preview.questionCount}
          copy={(quizId) => redeemShareCode(preview.code, { target: 'quiz', quizId })}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

/** One question as players would see it: its text, picture and options, never the answer. */
function PreviewQuestion({ question, index }: { question: PublicQuestion; index: number }) {
  const { t } = useTranslation()
  const Icon = typeIcons[question.type]
  const options = 'options' in question ? question.options : null
  return (
    <article className="flex gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground" title={t(`questionTypes.${question.type}`)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t('share.page.questionNumber', { number: index + 1 })} · {t(`questionTypes.${question.type}`)}
        </p>
        <h2 className="font-bold wrap-break-word">{question.text}</h2>
        {options && (
          <ul className="flex flex-wrap gap-1.5">
            {options.map((option) => (
              <li key={option.id} className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold wrap-break-word">
                {option.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      {question.imageId && (
        <img src={`/api/images/${question.imageId}`} alt="" loading="lazy" className="size-20 shrink-0 rounded-lg border object-cover" />
      )}
    </article>
  )
}
