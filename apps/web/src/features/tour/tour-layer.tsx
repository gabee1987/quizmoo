import { Link } from '@tanstack/react-router'
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Hint } from '@/components/hint'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useMotionOk } from '@/lib/motion'
import { nextShownStep, tours } from './tours'
import { endTour, findAnchor, goToStep, tourBlocked, useActiveTour, useTourSaving, type ActiveTour } from './use-tour'

/**
 * The running tour: a light dim with a hole and a pulsing ring around the element, and the bubble
 * pointing at it. Clicks pass through the dim, so the page stays usable; only the bubble takes them.
 * Mounted once in the root layout.
 */
export function TourLayer() {
  useTourSaving()
  const tour = useActiveTour()
  if (!tour) return null
  // Keyed by run, so a replay starts fresh.
  return <RunningTour key={tour.run} tour={tour} />
}

function RunningTour({ tour }: { tour: ActiveTour }) {
  const step = tour.steps[tour.index]!
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [hidden, setHidden] = useState(false)
  const motionOk = useMotionOk()

  // Find the step's element; if it has gone since the tour started, move on in the same direction.
  const lastIndex = useRef(tour.index)
  useLayoutEffect(() => {
    const backwards = tour.index < lastIndex.current
    lastIndex.current = tour.index
    if (!step.anchor) return setAnchor(null)
    const el = findAnchor(step.anchor)
    if (el) {
      setAnchor(el)
      const box = el.getBoundingClientRect()
      const fits = box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth
      // A section taller than half the screen is shown from its top, where its bubble points.
      const block = isTall(box) ? 'start' : 'center'
      if (!fits) el.scrollIntoView({ block, inline: 'nearest', behavior: motionOk ? 'smooth' : 'auto' })
      return
    }
    const onScreen = (key: string) => findAnchor(key) !== null
    const next = nextShownStep(tour.steps, tour.index, tour.index + (backwards ? -1 : 1), onScreen)
    if (next === null) endTour()
    else goToStep(next)
  }, [tour.index, tour.steps, step.anchor, motionOk])

  // Hide while a dialog or menu the tour is not in covers the page (the host opened one).
  useEffect(() => {
    const check = () => setHidden(tourBlocked(tour.steps))
    check()
    const timer = window.setInterval(check, 250)
    return () => window.clearInterval(timer)
  }, [tour.steps])

  if (step.anchor && !anchor) return null
  if (hidden) return null
  // The bubble points at a tall section's visible top, so it stays on screen beside the part in view.
  const reference = anchor && {
    getBoundingClientRect: () => {
      const box = anchor.getBoundingClientRect()
      if (!isTall(box)) return box
      const top = Math.max(box.top, 0)
      return new DOMRect(box.left, top, box.width, Math.max(0, Math.min(96, box.bottom - top)))
    },
  }
  // Inside a dialog, the tour is drawn into it: the dialog keeps focus and clicks to itself.
  const container = (anchor?.closest<HTMLElement>('[role="dialog"]') ?? document.body) as HTMLElement
  return anchor ? (
    <>
      <Spotlight anchor={anchor} container={container} />
      <PopoverPrimitive.Root open>
        <PopoverPrimitive.Anchor virtualRef={{ current: reference! }} />
        <PopoverPrimitive.Portal container={container}>
          {/* Keyed by step, so every bubble pops in from its tail. */}
          <PopoverPrimitive.Content
            key={tour.index}
            data-tour-layer=""
            side={step.side ?? 'bottom'}
            sideOffset={14}
            collisionPadding={12}
            // In a dialog, which clips what overflows it, the bubble stays inside it.
            {...(container !== document.body && { collisionBoundary: container })}
            arrowPadding={18}
            updatePositionStrategy="always"
            className="tooltip tour-card"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onFocusOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={() => endTour()}
            aria-labelledby="tour-title"
            aria-describedby="tour-body"
          >
            <TourCard tour={tour} />
            <PopoverPrimitive.Arrow asChild>
              <svg className="tooltip-tail" width={22} height={13} viewBox="0 0 22 13" aria-hidden="true">
                <path d="M0 0H22V2L11 12L0 2Z" />
                <path d="M0 2L11 12L22 2" />
              </svg>
            </PopoverPrimitive.Arrow>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  ) : (
    createPortal(
      <div data-tour-layer="" className="tour-dim fixed inset-0 z-60 grid place-items-center p-4">
        <div role="dialog" aria-labelledby="tour-title" aria-describedby="tour-body" className="tooltip tour-card">
          <TourCard tour={tour} />
        </div>
      </div>,
      container,
    )
  )
}

/**
 * The bubble's content: progress, title, text, Back and Next. The arrow keys step and Escape ends
 * the tour while focus is in it; Next has focus on every step, so Enter moves on.
 */
function TourCard({ tour }: { tour: ActiveTour }) {
  const { t } = useTranslation()
  const step = tour.steps[tour.index]!
  const first = tour.index === 0
  const last = tour.index === tour.steps.length - 1
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => next.current?.focus({ preventScroll: true }), [tour.index])
  const back = () => !first && goToStep(tour.index - 1)
  const forward = () => (last ? endTour() : goToStep(tour.index + 1))
  const text = (part: 'title' | 'body') => t(`tour.${tour.id}.${step.id}.${part}`)
  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') forward()
        else if (event.key === 'ArrowLeft') back()
        else if (event.key === 'Escape') endTour()
        else return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <div className="flex items-center gap-2">
        <ol className="flex flex-1 items-center gap-1" aria-label={t('tour.progress', { current: tour.index + 1, total: tour.steps.length })}>
          {tour.steps.map((s, index) => (
            <li
              key={s.id}
              aria-hidden="true"
              className={cn(
                'h-1.5 rounded-full transition-all duration-300 ease-spring-soft',
                index === tour.index ? 'w-5 bg-primary' : index < tour.index ? 'w-1.5 bg-primary/60' : 'w-1.5 bg-muted-foreground/30',
              )}
            />
          ))}
        </ol>
        <span className="text-xs font-extrabold text-muted-foreground tabular-nums" aria-hidden="true">
          {tour.index + 1} / {tour.steps.length}
        </span>
        <Hint label={t('tour.close')}>
          <button
            type="button"
            onClick={() => endTour()}
            aria-label={t('tour.close')}
            className="-mr-1.5 grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        </Hint>
      </div>
      <h2 id="tour-title" className="text-base font-black text-balance">
        {text('title')}
      </h2>
      <p id="tour-body" className="text-sm font-semibold text-pretty text-muted-foreground">
        {text('body')}
      </p>
      {last && (
        <Link
          to="/help"
          hash={tours[tour.id].help}
          onClick={() => endTour()}
          className="self-start text-sm font-extrabold text-primary underline-offset-4 outline-none hover:underline focus-visible:underline"
        >
          {t('tour.moreHelp')}
        </Link>
      )}
      <div className="mt-1 flex items-center gap-2">
        {!first && (
          <Button type="button" variant="ghost" size="sm" onClick={back}>
            <ArrowLeftIcon aria-hidden="true" />
            {t('tour.back')}
          </Button>
        )}
        <Button ref={next} type="button" size="sm" className="ml-auto" onClick={forward}>
          {last ? t('tour.done') : t('tour.next')}
          {!last && <ArrowRightIcon aria-hidden="true" />}
        </Button>
      </div>
    </div>
  )
}

/** The dim around the element and the ring on it, following it as the page scrolls or moves. */
function Spotlight({ anchor, container }: { anchor: HTMLElement; container: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const place = () => {
      const el = ref.current
      if (el) {
        const box = anchor.getBoundingClientRect()
        const origin = fixedOrigin(container)
        const pad = 6
        el.style.transform = `translate(${box.left - origin.left - pad}px, ${box.top - origin.top - pad}px)`
        el.style.width = `${box.width + pad * 2}px`
        el.style.height = `${box.height + pad * 2}px`
      }
      frame = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(frame)
  }, [anchor, container])
  return createPortal(
    <div ref={ref} data-tour-layer="" aria-hidden="true" className="tour-spotlight">
      <span className="tour-ring" />
    </div>,
    container,
  )
}

const isTall = (box: DOMRect) => box.height > window.innerHeight / 2

/**
 * Where `position: fixed` starts inside `container`: the page's corner, unless an ancestor with a
 * transform (a dialog popping in) becomes the containing block.
 */
function fixedOrigin(container: HTMLElement): { left: number; top: number } {
  for (let el: HTMLElement | null = container; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none' || /paint|layout/.test(style.contain)) {
      const box = el.getBoundingClientRect()
      return { left: box.left + el.clientLeft, top: box.top + el.clientTop }
    }
  }
  return { left: 0, top: 0 }
}
