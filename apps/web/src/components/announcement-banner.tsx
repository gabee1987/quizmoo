import type { Announcement } from '@quizmoo/shared'
import { MegaphoneIcon, XIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { SwipeAway } from '@/components/swipe-away'
import { cn } from '@/lib/cn'

/** Longest open or close movement; the last message stays mounted this long while it leaves. */
const MOVE_MS = 800

/**
 * The host's message, at the top of every phone and projector screen until the host clears it.
 * Same design as the toasts (`.note` in styles.css), in the theme colour, with a tooting megaphone.
 * Its space opens and closes with a spring, so the content below glides along instead of jumping,
 * and a cleared message floats away before it is removed.
 */
export function AnnouncementBanner({
  announcement,
  size = 'phone',
  flush = false,
  clockOffset = 0,
  onDismiss,
  dismissLabel,
  swipe = true,
  className,
}: {
  announcement: Announcement | null
  size?: 'phone' | 'screen'
  /** No space below (when it sits in a row instead of above content). */
  flush?: boolean
  /** The player may hide it: a swipe left or right, or the close button. Then it leaves like a cleared one. */
  onDismiss?: (() => void) | undefined
  /** The close button's name when it does more than hide it here (the host's clears it for everyone). */
  dismissLabel?: string | undefined
  /** Swiping away too; off for the host, where a stray swipe would clear it on every screen. */
  swipe?: boolean
  /** Server minus local clock, for the time bar of a message that clears itself. */
  clockOffset?: number
  className?: string
}) {
  const { t } = useTranslation()
  // The message on screen: stays set while a cleared one leaves.
  const [shown, setShown] = useState<Announcement | null>(null)
  const [open, setOpen] = useState(false)
  // A cleared message on its way out (not set on the first render, which opens).
  const [leaving, setLeaving] = useState(false)
  // Clips while the space opens or closes; afterwards the bubble's shadow may spill out.
  const [moving, setMoving] = useState(false)
  // Swiped off by the player: already gone, so it leaves without the wobble out.
  const [swiped, setSwiped] = useState(false)
  // Whether the message on show has its close button; kept while it leaves, so nothing jumps.
  const closable = useRef(false)
  if (!leaving) closable.current = Boolean(onDismiss)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(announcement)
  latest.current = announcement
  const id = announcement?.id ?? null

  const space = useRef<HTMLDivElement>(null)

  // Keyed on the id: every snapshot carries a new but equal object.
  useEffect(() => {
    clearTimeout(timer.current)
    setMoving(true)
    if (id !== null) {
      setLeaving(false)
      setSwiped(false)
      setShown(latest.current)
      timer.current = setTimeout(() => setMoving(false), MOVE_MS)
      return
    }
    setOpen(false)
    setLeaving(true)
    timer.current = setTimeout(() => {
      setShown(null)
      setMoving(false)
    }, MOVE_MS)
  }, [id])
  useEffect(() => () => clearTimeout(timer.current), [])

  // Open once the closed space is on the page. Reading its size makes the browser lay it out
  // closed first; without that, opening in the same frame skips the transition and the content
  // below jumps instead of gliding.
  useLayoutEffect(() => {
    if (!shown || leaving || open) return
    space.current?.getBoundingClientRect()
    setOpen(true)
  }, [shown, leaving, open])

  if (!shown) return null
  return (
    <div
      ref={space}
      className={cn(
        'grid transition-[grid-template-rows]',
        open
          ? 'grid-rows-[1fr] duration-550 ease-spring-soft'
          : // Closes once the bubble has wobbled, so the content follows it up instead of cutting it off;
            // a swiped one is gone already, so its space closes at once.
            cn('grid-rows-[0fr] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]', swiped ? 'delay-0' : 'delay-250'),
        className,
      )}
    >
      {/*
        While moving, the bubble flies in from above the screen and back out over the header, so
        nothing is clipped above; at the sides there is room for its shadow (60 px on the projector).
        Opening, it is clipped about 34 px below, so it does not show over the content it pushes
        down; leaving, not at all below, since the row shrinks under the bubble while it still
        wobbles. Inside the host's message box (flush) it drops in through its own top edge instead
        of flying across the host page.
      */}
      <div
        className={cn(
          'min-h-0',
          moving &&
            (flush
              ? leaving
                ? '[clip-path:inset(0_-3rem_-100vh_-3rem)]'
                : '[clip-path:inset(0_-3rem_-3rem_-3rem)]'
              : size === 'screen'
                ? leaving
                  ? '[clip-path:inset(-100vh_-5rem_-100vh_-5rem)]'
                  : '[clip-path:inset(-100vh_-5rem_-5rem_-5rem)]'
                : leaving
                  ? '[clip-path:inset(-100vh_-3rem_-100vh_-3rem)]'
                  : '[clip-path:inset(-100vh_-3rem_-3rem_-3rem)]'),
        )}
      >
        {/* The space below lives inside the collapsing row, so it closes along with the bubble. */}
        <div className={cn(!flush && (size === 'screen' ? 'pb-6' : 'pb-4'))}>
          {/* Keyed by id so a new message springs in again (and a swiped one starts in place). */}
          <SwipeAway
            key={shown.id}
            onSwipe={
              onDismiss && swipe && !leaving
                ? () => {
                    setSwiped(true)
                    onDismiss()
                  }
                : undefined
            }
          >
            <div
              role="status"
              aria-label={t('connection.announcement')}
              className={cn(
                'note note-announce',
                size === 'screen' ? 'note-lg' : 'text-lg',
                shown.expiresAt && 'note-timed',
                // Closed with × or by the host: the wobble out. Swiped: already off the screen.
                leaving && !swiped && 'note-leaving',
              )}
            >
              <span className="note-icon" aria-hidden="true">
                <MegaphoneIcon />
              </span>
              <p className="min-w-0 flex-1 wrap-break-word">{shown.text}</p>
              {closable.current && (
                <button
                  type="button"
                  aria-label={dismissLabel ?? t('connection.dismissAnnouncement')}
                  title={dismissLabel}
                  disabled={leaving || !onDismiss}
                  onClick={onDismiss}
                  className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  <XIcon className="size-5" aria-hidden="true" />
                </button>
              )}
              {shown.expiresAt && <TimeBar announcement={shown} expiresAt={shown.expiresAt} clockOffset={clockOffset} />}
            </div>
          </SwipeAway>
        </div>
      </div>
    </div>
  )
}

/**
 * The time a self-clearing message has left: a striped candy bar along the bubble's bottom that
 * drains in real time and turns warm near the end. One CSS animation over the message's whole
 * duration, started part-way through (negative delay) when the page joins late, so phones, the
 * projector and the host stay in step without timers.
 */
function TimeBar({ announcement, expiresAt, clockOffset }: { announcement: Announcement; expiresAt: number; clockOffset: number }) {
  // Fixed per message: re-renders must not restart the animation.
  const [style] = useState(() => {
    const total = Math.max(1, expiresAt - announcement.at)
    const elapsed = Math.min(total, Math.max(0, Date.now() + clockOffset - announcement.at))
    return { '--note-time': `${total}ms`, '--note-elapsed': `-${elapsed}ms` } as CSSProperties
  })
  return (
    <span className="note-time" aria-hidden="true">
      <span className="note-time-fill" style={style} />
    </span>
  )
}
