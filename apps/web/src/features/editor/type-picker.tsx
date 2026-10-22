import { questionTypes, type QuestionType } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownWideNarrowIcon,
  ChartColumnIcon,
  CircleDotIcon,
  HashIcon,
  ListChecksIcon,
  TextCursorInputIcon,
  ToggleRightIcon,
  type LucideIcon,
} from 'lucide-react'
import { stagger } from '@/lib/motion'

export const typeIcons: Record<QuestionType, LucideIcon> = {
  single: CircleDotIcon,
  multiple: ListChecksIcon,
  truefalse: ToggleRightIcon,
  text: TextCursorInputIcon,
  number: HashIcon,
  poll: ChartColumnIcon,
  order: ArrowDownWideNarrowIcon,
}

/** One card per question type: icon, name and a one-line explanation. */
export function TypePicker({ onPick }: { onPick: (type: QuestionType) => void }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {questionTypes.map((type, index) => {
        const Icon = typeIcons[type]
        // The pop runs on a wrapper: its transform would otherwise override the hover lift.
        return (
          <div key={type} style={stagger(index, 40)} className="animate-pop">
          <button
            type="button"
            onClick={() => onPick(type)}
            className="group flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left shadow-soft transition-[transform,border-color] outline-none hover:-translate-y-0.5 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring active:translate-y-0"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground transition-transform group-hover:scale-110 group-hover:-rotate-6">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-extrabold">{t(`questionTypes.${type}`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`questionTypes.${type}Help`)}</span>
            </span>
          </button>
          </div>
        )
      })}
    </div>
  )
}
