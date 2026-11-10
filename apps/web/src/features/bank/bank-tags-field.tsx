import { MAX_BANK_TAGS } from '@quizmoo/shared'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChipsInput } from '@/components/chips'
import { bankTagsQueryOptions } from './queries'

/** Free-form tags for bank questions, with the host's most used tags offered as one-tap suggestions. */
export function BankTagsField({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const { t } = useTranslation()
  const tags = useQuery(bankTagsQueryOptions)
  const chosen = new Set(value.map((tag) => tag.toLowerCase()))
  const suggestions = (tags.data ?? []).filter((s) => !chosen.has(s.tag.toLowerCase())).slice(0, 8)
  const full = value.length >= MAX_BANK_TAGS
  return (
    <div className="flex flex-col gap-2">
      <ChipsInput label={t('bank.tags.label')} values={value} onChange={onChange} placeholder={t('bank.tags.placeholder')} maxItems={MAX_BANK_TAGS} maxLength={30} />
      {suggestions.length > 0 && !full && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('bank.tags.suggestions')}>
          <span className="text-sm text-muted-foreground">{t('bank.tags.suggestions')}:</span>
          {suggestions.map((s) => (
            <button
              key={s.tag}
              type="button"
              onClick={() => onChange([...value, s.tag])}
              className="flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-sm font-semibold outline-none hover:border-primary/60 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <PlusIcon className="size-3.5" aria-hidden="true" />
              {s.tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
