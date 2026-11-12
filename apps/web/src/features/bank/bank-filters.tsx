import { questionTypes, type QuestionType } from '@quizmoo/shared'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SelectField } from '@/components/select-field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { bankTagsQueryOptions, type BankFilters } from './queries'

const ALL = '*'

/** Search, type and tag for the bank's lists (the page and the editor's picker). */
export function BankFiltersBar({ value, onChange, className }: { value: BankFilters; onChange: (next: BankFilters) => void; className?: string }) {
  const { t } = useTranslation()
  const tags = useQuery(bankTagsQueryOptions)
  return (
    <div className={cn('@container', className)}>
    <div className="grid gap-2 @lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder={t('bank.filters.search')}
          aria-label={t('bank.filters.search')}
          autoComplete="off"
          maxLength={100}
          className="pl-9"
        />
      </div>
      <SelectField<QuestionType | typeof ALL>
        label={t('bank.filters.type')}
        hideLabel
        value={value.type ?? ALL}
        options={[{ value: ALL, label: t('bank.filters.anyType') }, ...questionTypes.map((type) => ({ value: type, label: t(`questionTypes.${type}`) }))]}
        onChange={(type) => onChange({ ...value, type: type === ALL ? null : type })}
      />
      <SelectField<string>
        label={t('bank.filters.tag')}
        hideLabel
        value={value.tag ?? ALL}
        options={[
          { value: ALL, label: t('bank.filters.anyTag') },
          ...(tags.data ?? []).map((s) => ({ value: s.tag, label: `${s.tag} (${s.count})` })),
          // A tag no question carries any more stays pickable until the filter changes.
          ...(value.tag && !tags.data?.some((s) => s.tag === value.tag) ? [{ value: value.tag, label: value.tag }] : []),
        ]}
        onChange={(tag) => onChange({ ...value, tag: tag === ALL ? null : tag })}
      />
    </div>
    </div>
  )
}
