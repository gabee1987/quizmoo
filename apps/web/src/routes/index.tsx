import type { Avatar, GamePublicInfo } from '@quizmoo/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  CalendarClockIcon,
  CameraIcon,
  CheckIcon,
  DicesIcon,
  Gamepad2Icon,
  Loader2Icon,
  LogOutIcon,
  PlayIcon,
  PresentationIcon,
} from 'lucide-react'
import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AddToCalendarButton } from '@/components/add-to-calendar-button'
import { AvatarPicker } from '@/components/avatar-picker'
import { FloatingShapes } from '@/components/floating-shapes'
import { FormAlert } from '@/components/form-alert'
import { HomeHero } from '@/components/home-hero'
import { LegalLinks } from '@/components/legal-links'
import { PinInput } from '@/components/pin-input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoginForm } from '@/features/auth/login-form'
import { useSiteInfo } from '@/lib/site'
import { TextField } from '../components/text-field'
import { TeamPicker, teamChoice } from '../features/join/team-picker'
import { useTimeReached } from '@/lib/clock'
import { formatStart } from '@/lib/schedule'
import { apiFetch, errorCode } from '../lib/api'
import { randomAvatar } from '../lib/avatars'
import { PIN_PATTERN } from '../lib/pin'
import { forgetDraft, getDraft, getStoredPlayer, storeDraft, storePlayer } from '../lib/player-storage'
import { emitAck, ensureConnected } from '../lib/socket'

export const Route = createFileRoute('/')({
  // Allows QR codes / links like /?pin=123456 to prefill the PIN. Kept a number, as the router parses
  // it (a string of digits would be written back quoted, ?pin=%22123456%22); PINs never start with 0.
  validateSearch: z.object({ pin: z.coerce.number().int().positive().optional().catch(undefined) }),
  component: JoinPage,
})

// The scanner and its decoder load only when the camera button is pressed.
const QrScanner = lazy(() => import('../components/qr-scanner'))

/** Camera access exists only in secure contexts (HTTPS or localhost); elsewhere the button is not offered. */
const canScan = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'

function JoinPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const searchPin = search.pin === undefined ? '' : String(search.pin)
  const [pin, setPin] = useState(searchPin)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<Avatar>(() => randomAvatar())
  const [teamId, setTeamId] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pinChecked, setPinChecked] = useState(false)
  const [side, setSide] = useState<'play' | 'host'>('play')
  const site = useSiteInfo()

  const pinValid = PIN_PATTERN.test(pin)
  const info = useQuery({
    queryKey: ['gamePublic', pin],
    queryFn: () => apiFetch<GamePublicInfo>(`/api/games/${pin}/public`),
    enabled: pinValid,
    retry: false,
    // Waiting for a scheduled game: notice when the host opens it early or moves the time.
    // A team game: teams other players create (and their member counts) show up while choosing.
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.scheduledAt && data.scheduledAt > data.serverNow) return 30_000
      return data?.mode === 'team' ? 5_000 : false
    },
  })
  const game = info.data
  const teamMode = game?.mode === 'team'
  // A scheduled game: joining opens at its time, by the server's clock. Until then the player can
  // fill in their details; they are kept in this browser, and the PIN in the address, so a reload keeps both.
  const open = useTimeReached(game?.scheduledAt ?? null, game ? game.serverNow - info.dataUpdatedAt : 0)
  const waiting = !!game && game.scheduledAt !== null && !open
  useEffect(() => {
    if (waiting && searchPin !== pin) {
      void navigate({ to: '/', search: { pin: Number(pin) }, replace: true, resetScroll: false })
    }
  }, [waiting, pin, searchPin, navigate])
  useEffect(() => {
    if (!PIN_PATTERN.test(pin)) return
    const draft = getDraft(pin)
    if (!draft) return
    setName((current) => current || draft.name)
    setAvatar(draft.avatar)
    setTeamId((current) => current ?? draft.teamId)
  }, [pin])
  useEffect(() => {
    if (waiting) storeDraft(pin, { name, avatar, teamId })
  }, [waiting, pin, name, avatar, teamId])

  /** Leaves a scheduled game's waiting page: back to an empty join form. */
  function leave() {
    forgetDraft(pin)
    setPin('')
    setPinChecked(false)
    setSubmitted(false)
    setError(null)
    void navigate({ to: '/', search: {}, replace: true })
  }

  // Typing the PIN brings the card to the top; once the game is found (also after a reload or a QR
  // link) the keyboard closes and the page settles with the Quizmoo name at the top, the form below it.
  const pinBox = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  // The empty page fits the screen, so while the PIN boxes have focus a spacer below the card makes
  // room to scroll it up (the phone's keyboard covers the lower half anyway).
  const [pinFocused, setPinFocused] = useState(false)
  useEffect(() => {
    if (!pinFocused) return
    const toTop = () => card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toTop()
    // The keyboard opens after this and the browser scrolls the focused box up to it: put the card back on top.
    window.visualViewport?.addEventListener('resize', toTop)
    return () => window.visualViewport?.removeEventListener('resize', toTop)
  }, [pinFocused])
  const quizTitle = game?.quizTitle
  useEffect(() => {
    if (!quizTitle) return
    if (pinBox.current?.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    // After the blur the spacer goes and the keyboard closes; either cancels a smooth scroll already
    // under way, so scroll once the spacer is gone and again when the keyboard has finished closing.
    const toTitle = () => title.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    let timer = window.setTimeout(toTitle, 50)
    const onResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(toTitle, 120)
    }
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', onResize)
    const stop = window.setTimeout(() => viewport?.removeEventListener('resize', onResize), 1500)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(stop)
      viewport?.removeEventListener('resize', onResize)
    }
  }, [quizTitle])

  const infoError = info.error && 'code' in info.error ? (info.error as { code: string }).code : null
  const pinError = (submitted || pinChecked) && !pinValid ? t('join.pinInvalid') : infoError ? t(infoError) : undefined

  // "Surprise me": a name from the admins' list that nobody in this game has yet, with the avatar
  // that fits it, or a random one.
  const surprise = useMutation({
    mutationFn: () =>
      apiFetch<{ name: string | null; avatar: Avatar | null }>(`/api/games/${pin}/nickname?lang=${i18n.language.startsWith('en') ? 'en' : 'hu'}`),
    onSuccess: ({ name: picked, avatar: fitting }) => {
      if (picked) setName(picked)
      setAvatar(fitting ?? randomAvatar())
    },
    onError: (err) => setError(errorCode(err)),
  })

  /** OK under the PIN: closes the phone's keyboard and checks the PIN; a found game scrolls the page. */
  function confirmPin() {
    setPinChecked(true)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }
  const nameError = submitted && !name.trim() ? t('join.nameRequired') : undefined
  const team = teamChoice(teamId ?? '', newTeamName)
  const teamError = submitted && teamMode && !team ? t(teamId ? 'join.newTeamNameRequired' : 'errors.unknownTeam') : undefined

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    // Enter in the PIN boxes before the game is found: the same as OK.
    if (!game) return confirmPin()
    if (waiting) return
    setSubmitted(true)
    setError(null)
    if (!pinValid || !name.trim() || (teamMode && !team)) return
    setPending(true)
    try {
      await ensureConnected()
      // A stored token for this PIN reclaims the same player (e.g. after closing the browser).
      const stored = getStoredPlayer(pin)
      const res = await emitAck('player:join', {
        pin,
        name: name.trim(),
        avatar,
        ...(teamMode && team ? team : {}),
        ...(stored ? { token: stored.token } : {}),
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      storePlayer(pin, { token: res.token, name: name.trim(), avatar })
      forgetDraft(pin)
      void navigate({ to: '/play/$pin', params: { pin } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'errors.internal')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-sm flex-1 content-center gap-7 lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16">
      <FloatingShapes />
      <HomeHero tagline={t('home.tagline')} titleRef={title} />
      <div className="relative flex w-full flex-col gap-5 lg:max-w-sm lg:justify-self-center">
        {/* One card, two sides: playing with a PIN (the default, where QR codes land) or logging in to host. */}
        <div ref={card} className="flex animate-pop scroll-mt-4 flex-col rounded-3xl border bg-card p-5 shadow-soft">
          <Tabs value={side} onValueChange={(value) => setSide(value as typeof side)} className="gap-5">
            <TabsList variant="bold" aria-label={t('home.sides')}>
              {/* The unchosen side's text needs more than the default 60 % for 4.5:1 on the light track. */}
              <TabsTrigger value="play" className="text-foreground/80">
                <Gamepad2Icon aria-hidden="true" />
                {t('home.play')}
              </TabsTrigger>
              <TabsTrigger value="host" className="text-foreground/80">
                <PresentationIcon aria-hidden="true" />
                {t('home.host')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="play">
              <form className="flex flex-col gap-5" onSubmit={(e) => void onSubmit(e)} noValidate>
                <h2 className="sr-only">{t('join.title')}</h2>
                <div
                  ref={pinBox}
                  className="flex flex-col gap-2"
                  onFocus={() => setPinFocused(true)}
                  onBlur={(e) => {
                    if (!pinBox.current?.contains(e.relatedTarget)) setPinFocused(false)
                  }}
                >
                  <div className="flex min-h-10 items-center justify-between gap-2">
                    <span className="font-semibold">{t('join.pin')}</span>
                    {canScan && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
                        <CameraIcon aria-hidden="true" />
                        {t('join.scan')}
                      </Button>
                    )}
                  </div>
                  <PinInput value={pin} onChange={setPin} invalid={!!pinError} describedBy={pinError ? 'pin-error' : undefined} />
                  {pinError && (
                    <p id="pin-error" className="text-sm font-semibold text-destructive">
                      {pinError}
                    </p>
                  )}
                  {/* Until the game is found: OK closes the keyboard and checks the PIN. */}
                  {!game &&
                    (pinValid && info.isFetching ? (
                      <p role="status" className="flex min-h-11 items-center justify-center gap-2 font-semibold text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                        {t('join.findingGame')}
                      </p>
                    ) : (
                      <Button type="button" variant="secondary" onClick={confirmPin}>
                        <CheckIcon aria-hidden="true" />
                        {t('join.pinOk')}
                      </Button>
                    ))}
                </div>
                {/* Name, avatar and team come once the PIN has found a game: they belong to that game. */}
                {game ? (
                  <div className="flex animate-pop flex-col gap-5">
                    {waiting && game.scheduledAt !== null ? (
                      <div role="status" className="flex flex-col items-center gap-3 rounded-2xl bg-secondary p-4 text-center text-secondary-foreground">
                        <p className="font-bold wrap-break-word">{game.quizTitle}</p>
                        <CalendarClockIcon className="size-10 text-primary dark:text-ring" aria-hidden="true" />
                        <p className="text-xl font-black text-balance">
                          {t('join.scheduled', { date: formatStart(game.scheduledAt, i18n.language) })}
                        </p>
                        <p className="text-sm">{t('join.scheduledHelp')}</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <AddToCalendarButton
                            pin={pin}
                            scheduledAt={game.scheduledAt}
                            quizTitle={game.quizTitle}
                            joinUrl={game.joinUrl}
                            variant="outline"
                          />
                          <Button type="button" variant="ghost" onClick={leave}>
                            <LogOutIcon aria-hidden="true" />
                            {t('join.leave')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-xl bg-secondary px-4 py-2 text-center font-bold text-secondary-foreground wrap-break-word">
                        {game.quizTitle}
                      </p>
                    )}
                    <TextField
                      label={t('join.name')}
                      name="name"
                      maxLength={24}
                      autoComplete="off"
                      enterKeyHint="go"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('join.namePlaceholder')}
                      error={nameError}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="-mt-3 self-start"
                      disabled={surprise.isPending}
                      onClick={() => surprise.mutate()}
                    >
                      {surprise.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <DicesIcon aria-hidden="true" />}
                      {t('join.surprise')}
                    </Button>
                    <AvatarPicker value={avatar} onChange={setAvatar} />
                    {teamMode && (
                      <TeamPicker
                        teams={game.teams}
                        newTeams={game.newTeams}
                        solo={game.solo}
                        selected={teamId ?? ''}
                        newName={newTeamName}
                        onSelect={setTeamId}
                        onNewName={setNewTeamName}
                        error={teamError && <span className="font-semibold text-destructive">{teamError}</span>}
                      />
                    )}
                    {error && <FormAlert>{t(error)}</FormAlert>}
                    {/* A scheduled game: the details can be filled in now, joining opens at the start. */}
                    <Button type="submit" size="xl" disabled={pending || waiting}>
                      {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
                      {pending ? t('common.loading') : waiting ? t('join.opensAtStart') : t('join.submit')}
                    </Button>
                    {/* Players have no account to accept anything with: they are told here, where they decide. */}
                    <p className="text-center text-xs text-muted-foreground">
                      <Trans
                        i18nKey="legal.joinNote"
                        components={{
                          terms: <Link to="/terms" className={inlineLink} />,
                          privacy: <Link to="/privacy" className={inlineLink} />,
                        }}
                      />
                    </p>
                  </div>
                ) : (
                  error && <FormAlert>{t(error)}</FormAlert>
                )}
              </form>
            </TabsContent>
            <TabsContent value="host" className="flex flex-col gap-4">
              <h2 className="sr-only">{t('auth.title')}</h2>
              <p className="text-center text-muted-foreground text-balance">{t('home.hostIntro')}</p>
              <LoginForm />
              {site.data?.registrationOpen && (
                <p className="text-center text-sm text-muted-foreground">
                  {t('home.noAccount')}{' '}
                  <Link to="/register" className={inlineLink}>
                    {t('home.createAccount')}
                  </Link>
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <LegalLinks />
        {/* Room below for scrolling the card up; out of the layout, so nothing moves when it comes and goes. */}
        {pinFocused && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full h-dvh lg:hidden" />}
      </div>
      {scanning && (
        <Suspense fallback={null}>
          <QrScanner
            onResult={(scanned) => {
              setPin(scanned)
              setScanning(false)
            }}
            onClose={() => setScanning(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

const inlineLink = 'rounded-sm font-semibold underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring'
