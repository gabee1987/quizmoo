import { CheckIcon, PencilIcon, ShuffleIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayerAvatar } from '@/components/player-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { useMotionOk } from '@/lib/motion'
import { MAX_NAME_LENGTH, type NameEntry, type NameProblem } from './draft'

/** One "Surprise me" name: its avatar, the name, and edit and remove; edited in place. */
export function NameRow({
  entry,
  problem,
  entering,
  onRename,
  onRemove,
}: {
  entry: NameEntry
  problem: NameProblem | null
  /** Added in this visit: pops in. */
  entering: boolean
  onRename: (name: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const motionOk = useMotionOk()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(entry.name)
  // Removing plays the row out first; the list drops it when the animation ends.
  const [leaving, setLeaving] = useState(false)

  const commit = () => {
    const name = text.trim()
    setEditing(false)
    if (name && name !== entry.name) onRename(name)
    else setText(entry.name)
  }

  return (
    <li
      data-flip-id={entry.key}
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onRemove()
      }}
      className={cn(
        'flex flex-col gap-1 rounded-xl border-2 bg-card px-2 py-1.5',
        problem ? 'border-destructive' : 'border-border',
        leaving ? 'pointer-events-none animate-pop-out' : entering && 'animate-pop',
      )}
    >
      <div className="flex min-h-10 items-center gap-2">
        <Avatar entry={entry} />
        {editing ? (
          <Input
            autoFocus
            value={text}
            maxLength={MAX_NAME_LENGTH + 20}
            aria-label={t('nicknames.editLabel', { name: entry.name })}
            className="h-9 min-w-0 flex-1"
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setText(entry.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <span className="min-w-0 flex-1 font-semibold wrap-break-word">{entry.name}</span>
        )}
        {editing ? (
          // onMouseDown: commit before the input's blur would.
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t('nicknames.done')} onMouseDown={(e) => e.preventDefault()} onClick={commit}>
            <CheckIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t('nicknames.edit', { name: entry.name })} onClick={() => setEditing(true)}>
            <PencilIcon aria-hidden="true" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('nicknames.remove', { name: entry.name })}
          onClick={() => (motionOk ? setLeaving(true) : onRemove())}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      {problem && (
        <p className="pl-11 text-sm font-semibold text-destructive">
          {t(problem, { max: MAX_NAME_LENGTH })}
        </p>
      )}
    </li>
  )
}

/** The avatar the name gets; a shuffle mark when none fits (the phone picks one at random). */
function Avatar({ entry }: { entry: NameEntry }) {
  const { t } = useTranslation()
  if (entry.avatar === undefined) return <span aria-hidden="true" className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
  if (entry.avatar === null) {
    return (
      <span
        title={t('nicknames.randomAvatar')}
        className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-dashed text-muted-foreground"
      >
        <ShuffleIcon className="size-4" aria-hidden="true" />
        <span className="sr-only">{t('nicknames.randomAvatar')}</span>
      </span>
    )
  }
  return <PlayerAvatar avatar={entry.avatar} size="md" />
}
