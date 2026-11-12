import { REACTION_COOLDOWN_MS, reactionGlyphs, reactions, type PlayerSnapshot } from '@quizmoo/shared'
import { SmilePlusIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hint } from '@/components/hint'
import { cn } from '@/lib/cn'
import { sendReaction } from './reaction-store'
import { reactionsOpen } from './reactions'

/** Delay between two emoji bubbles as the column opens or closes. */
const STAGGER_MS = 40

/**
 * The phone's reactions: one round button in the bottom left corner. Tapping it blows the six emoji
 * up into a column above it, one bubble after the other; a tap on an emoji sends it and folds the
 * column away. The button then rests for `REACTION_COOLDOWN_MS`, a ring on its edge running out; the server
 * would drop faster taps anyway. Escape or a tap elsewhere closes the column. Hidden while reactions
 * are closed (during a question, or muted).
 */
export function ReactionButton({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [resting, setResting] = useState(0)
  const menuId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const available = reactionsOpen(snapshot)

  useEffect(() => {
    if (!resting) return
    const timer = setTimeout(() => setResting(0), REACTION_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [resting])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  // A question starting (or the host muting) folds the column, so it is closed when it comes back.
  useEffect(() => {
    if (!available) setOpen(false)
  }, [available])

  if (!available) return null
  return (
    <div
      ref={root}
      data-testid="reaction-button"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-30 flex flex-col-reverse items-center gap-2"
    >
      <Hint label={t('reactions.bar')} side="right">
        <button
          ref={trigger}
          type="button"
          data-tour="reaction-button"
          aria-label={t('reactions.bar')}
          aria-expanded={open}
          aria-controls={menuId}
          disabled={resting !== 0}
          onClick={() => setOpen(!open)}
          // The size of the game menu's button in the opposite corner (`size-11`, 20 px icon).
          className="relative grid size-11 place-items-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--primary-edge)] transition-[transform,box-shadow] duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none enabled:active:translate-y-1 enabled:active:shadow-none"
        >
          <SmilePlusIcon
            aria-hidden="true"
            className={cn(
              'size-5 transition-[transform,opacity] duration-300 ease-spring',
              open && 'scale-50 -rotate-90 opacity-0',
              resting !== 0 && 'opacity-60',
            )}
          />
          <XIcon
            aria-hidden="true"
            className={cn('absolute size-5 transition-[transform,opacity] duration-300 ease-spring', !open && 'scale-50 rotate-90 opacity-0')}
          />
          {resting !== 0 && (
            // While it rests, a ring along the button's edge runs out clockwise.
            <svg key={resting} viewBox="0 0 44 44" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
              <circle cx="22" cy="22" r="19.5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <circle
                cx="22"
                cy="22"
                r="19.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="100"
                className="animate-ring-drain"
                style={{ animationDuration: `${REACTION_COOLDOWN_MS}ms` }}
              />
            </svg>
          )}
        </button>
      </Hint>
      <div
        id={menuId}
        role="group"
        aria-label={t('reactions.bar')}
        inert={!open}
        className={cn('flex flex-col-reverse items-center gap-2', !open && 'pointer-events-none')}
      >
        {reactions.map((reaction, index) => (
          <button
            key={reaction}
            type="button"
            aria-label={t(`reactions.names.${reaction}`)}
            onClick={() => {
              if (!sendReaction(reaction, snapshot.me)) return
              setResting(Date.now())
              setOpen(false)
              trigger.current?.focus()
            }}
            // Opening, the bubble nearest the button goes first; closing, the top one.
            style={{ transitionDelay: `${(open ? index : reactions.length - 1 - index) * STAGGER_MS}ms` }}
            className={cn(
              'grid size-12 origin-bottom place-items-center rounded-full border-2 bg-card text-2xl shadow-lg transition-[transform,opacity] duration-400 ease-spring hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
              open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-30 opacity-0',
            )}
          >
            <span aria-hidden="true">{reactionGlyphs[reaction]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
