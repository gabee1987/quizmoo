import type { Question, TagColor } from '@quizmoo/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownIcon,
  ArrowDownToLineIcon,
  ArrowUpIcon,
  ArrowUpToLineIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  LayersIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TagPicker } from './tag-picker'
import { typeIcons } from './type-picker'

/**
 * Header of the question being edited: its number and type, and the actions on it.
 * Move up and down are buttons (the accessible alternative to dragging; one row, so each step past a
 * group's header or end takes it into or out of that group); top, bottom and starting a group here are
 * in the menu.
 */
export function QuestionToolbar({
  question,
  index,
  count,
  canMove,
  onMove,
  onDuplicate,
  onDelete,
  onNewGroup,
  onColor,
}: {
  question: Question
  index: number
  count: number
  canMove: { up: boolean; down: boolean }
  onMove: (where: 'up' | 'down' | 'top' | 'bottom') => void
  onDuplicate: () => void
  onDelete: () => void
  /** Null when the quiz has as many groups as it may. */
  onNewGroup: (() => void) | null
  onColor: (color: TagColor | undefined) => void
}) {
  const { t } = useTranslation()
  const Icon = typeIcons[question.type]
  const first = !canMove.up
  const last = !canMove.down
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="min-w-0 flex-1 basis-40 leading-tight">
        <span className="block text-lg font-black">{t('editor.questionNOfCount', { n: index + 1, count })}</span>
        <span className="block text-sm font-semibold text-muted-foreground">{t(`questionTypes.${question.type}`)}</span>
      </h2>
      <div className="ml-auto flex items-center gap-0.5">
        <ToolButton label={t('editor.moveUp')} disabled={first} onClick={() => onMove('up')}>
          <ArrowUpIcon aria-hidden="true" />
        </ToolButton>
        <ToolButton label={t('editor.moveDown')} disabled={last} onClick={() => onMove('down')}>
          <ArrowDownIcon aria-hidden="true" />
        </ToolButton>
        <TagPicker value={question.color} onChange={onColor} />
        <ToolButton label={t('editor.duplicateQuestion')} onClick={onDuplicate}>
          <CopyIcon aria-hidden="true" />
        </ToolButton>
        <ToolButton label={t('editor.deleteQuestion')} onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2Icon aria-hidden="true" />
        </ToolButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('editor.moreQuestionActions')}>
              <EllipsisVerticalIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem className="min-h-11" disabled={first} onSelect={() => onMove('top')}>
              <ArrowUpToLineIcon aria-hidden="true" />
              {t('editor.moveToTop')}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" disabled={last} onSelect={() => onMove('bottom')}>
              <ArrowDownToLineIcon aria-hidden="true" />
              {t('editor.moveToBottom')}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" disabled={!onNewGroup} onSelect={() => onNewGroup?.()}>
              <LayersIcon aria-hidden="true" />
              {t('editor.groupFromHere')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function ToolButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={className}>
      {children}
    </Button>
  )
}
