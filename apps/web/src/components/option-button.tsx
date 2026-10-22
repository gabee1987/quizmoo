import type { AnswerSymbols } from '@quizmoo/shared'
import { Loader2Icon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { CheckIcon, OptionSymbol } from './icons'
import { optionFill, optionVars } from './option-colours'
import { PickStack, type PickPlayer } from './pick-stack'

/**
 * Answer option. Plain (a neutral card with a coloured symbol badge) or coloured in its palette
 * colour with the symbol on it. The projector (`large`) is always coloured so the room can follow
 * the bars; phones follow the game's answer style. Presses sink the button like the chunky buttons.
 */
export function OptionButton({
  index,
  label,
  imageId,
  symbols = 'shapes',
  selected = false,
  dimmed = false,
  pending = false,
  large = false,
  colourful = large,
  picks,
  onPicks,
  className,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * Team mode on a phone: teammates who picked this option, shown as an avatar stack on its
   * corner (a sibling of the button, so the option keeps one wrapper while picks come and go).
   */
  picks?: readonly PickPlayer[] | undefined
  /** Tapping the stack: opens the team's picks with names. */
  onPicks?: (() => void) | undefined
  index: number
  label: string
  imageId?: string | undefined
  symbols?: AnswerSymbols | undefined
  selected?: boolean
  dimmed?: boolean
  /** The answer is on its way to the server. */
  pending?: boolean
  /** Projector size. */
  large?: boolean
  colourful?: boolean
}) {
  const size = large ? 'min-h-28 px-8 py-5 text-4xl' : 'min-h-16 px-4 py-3 text-lg'
  const look = colourful
    ? cn(
        optionFill,
        '[--option-edge:color-mix(in_oklch,var(--option),black_25%)] shadow-[0_5px_0_0_var(--option-edge)]',
        'enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_7px_0_0_var(--option-edge)] enabled:hover:brightness-105',
        'enabled:active:translate-y-1 enabled:active:shadow-none',
        // Selected: pressed down, with a ring in the theme's primary colour outside the option and a
        // gap in the page colour, so it reads against every option colour. 3 + 2 px per side stays
        // within the 12 px grid gap, also when two neighbours are selected.
        selected && 'translate-y-1 shadow-[0_1px_0_0_var(--option-edge)] ring-3 ring-primary ring-offset-2 ring-offset-background',
      )
    : cn(
        'border-2 shadow-[0_4px_0_0_var(--secondary-edge)] enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 enabled:active:shadow-none',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-card-foreground enabled:hover:border-ring',
      )
  const button = (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      style={{ ...optionVars(index), ...(picks === undefined && style) }}
      className={cn(
        'flex items-center gap-3 rounded-2xl text-left font-bold transition-[transform,box-shadow,filter] duration-150 ease-out outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default motion-reduce:transition-none',
        size,
        look,
        dimmed && 'opacity-40',
        picks === undefined && className,
      )}
    >
      {colourful ? (
        <OptionSymbol symbols={symbols} index={index} className="size-[1.4em] shrink-0" />
      ) : (
        <span
          aria-hidden="true"
          style={optionVars(index)}
          className={cn('flex shrink-0 items-center justify-center rounded-xl', optionFill, large ? 'size-14 text-2xl' : 'size-9 text-base')}
        >
          <OptionSymbol symbols={symbols} index={index} className="size-[1.2em]" />
        </span>
      )}
      {imageId && <img src={`/api/images/${imageId}`} alt="" className="h-[2.5em] w-auto shrink-0 rounded object-contain" />}
      <span className="flex-1 wrap-break-word">{label}</span>
      {pending ? (
        <Loader2Icon className="size-6 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        selected && (
          // A badge with an edge in the page colour: visible on any option colour, in the theme's colour.
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full ring-2',
              colourful ? 'bg-primary text-primary-foreground ring-background' : 'bg-primary-foreground text-primary ring-primary-foreground/40',
            )}
          >
            <CheckIcon className="size-5" />
          </span>
        )
      )}
    </button>
  )
  if (picks === undefined) return button
  return (
    <div className={cn('relative grid', className)} style={style}>
      {button}
      <PickStack players={picks} onClick={onPicks} className="absolute -top-3 right-3" />
    </div>
  )
}
