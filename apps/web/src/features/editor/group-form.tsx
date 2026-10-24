import type { GameSettings, GroupSettings, QuestionGroup } from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownIcon, ArrowUpIcon, LayersIcon, ListOrderedIcon, Settings2Icon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { tagStyle } from '@/lib/tags'
import { SelectField } from '../../components/select-field'
import { SwitchRow } from '../host/game-settings-form'
import { withImage, withKeepOrder, withTag } from './draft'
import { ImageField } from './image-field'
import { POINTS, TIME_LIMITS } from './question-form'
import { TagPicker } from './tag-picker'
import type { FieldErrors } from './validate'

type Field = 'timeLimitSec' | 'points'

/** A rule a group may set for itself: its values and how each is called. */
interface Rule<K extends keyof GroupSettings = keyof GroupSettings> {
  key: K
  label: string
  values: readonly NonNullable<GroupSettings[K]>[]
  name: (value: GameSettings[K]) => string
}

function rules(t: TFunction, quiz: GameSettings, own: GroupSettings): { section: 'flow' | 'scoring'; rules: Rule[] }[] {
  const onOff = (value: boolean) => (value ? t('editor.on') : t('editor.off'))
  const introValues = [...new Set([0, 5, 10, 15, 30, own.groupIntroSec ?? 0, quiz.groupIntroSec])].sort((a, b) => a - b)
  const changes = own.answerChanges ?? quiz.answerChanges
  return [
    {
      section: 'flow',
      rules: [
        {
          key: 'revealAnswers',
          label: t('host.create.revealAnswers'),
          values: ['afterQuestion', 'afterGroup'],
          name: (v) => t(`host.create.revealAnswersOptions.${v}`),
        } satisfies Rule<'revealAnswers'>,
        {
          key: 'scoreboard',
          label: t('host.create.scoreboard'),
          values: ['afterQuestion', 'onDemand'],
          name: (v) => t(`host.create.scoreboardOptions.${v}`),
        } satisfies Rule<'scoreboard'>,
        {
          key: 'groupIntroSec',
          label: t('host.create.groupIntro'),
          values: introValues,
          name: (v) => (v === 0 ? t('host.create.groupIntroWait') : t('host.create.groupIntroSeconds', { count: v })),
        } satisfies Rule<'groupIntroSec'>,
        {
          key: 'groupStandings',
          label: t('host.create.groupStandings'),
          values: ['afterGroup', 'onDemand'],
          name: (v) => t(`host.create.groupStandingsOptions.${v}`),
        } satisfies Rule<'groupStandings'>,
      ] as Rule[],
    },
    {
      section: 'scoring',
      rules: [
        { key: 'speedBonus', label: t('host.create.speedBonus'), values: [true, false], name: onOff } satisfies Rule<'speedBonus'>,
        { key: 'streakBonus', label: t('host.create.streakBonus'), values: [true, false], name: onOff } satisfies Rule<'streakBonus'>,
        { key: 'answerChanges', label: t('host.create.answerChanges'), values: [true, false], name: onOff } satisfies Rule<'answerChanges'>,
        // The lock-in only matters while answers can be changed.
        ...(changes
          ? [
              {
                key: 'answerLockSec',
                label: t('host.create.answerLock'),
                values: [...new Set([0, 5, 10, own.answerLockSec ?? 0, quiz.answerLockSec])].sort((a, b) => a - b),
                name: (v) => (v === 0 ? t('host.create.answerLockEnd') : t('host.create.answerLockBefore', { count: v })),
              } satisfies Rule<'answerLockSec'>,
            ]
          : []),
        { key: 'shuffleOptions', label: t('host.create.shuffle'), values: [true, false], name: onOff } satisfies Rule<'shuffleOptions'>,
      ] as Rule[],
    },
  ]
}

/** `item` with an optional key set, or removed for undefined (exactOptionalPropertyTypes). */
function withKey<T extends object, K extends keyof T>(item: T, key: K, value: T[K] | undefined): T {
  const { [key]: _old, ...rest } = item
  return (value === undefined ? rest : { ...rest, [key]: value }) as T
}

/**
 * The selected group: its title, info and picture for the intro, the time and points its new questions
 * take (with "Apply" for the ones that differ), and the rules it sets for itself. `path` is its error
 * prefix, e.g. "groups.1".
 */
export function GroupForm({
  group,
  index,
  count,
  canMove,
  questionCount,
  quizSettings,
  differing,
  errors,
  path,
  onChange,
  onApply,
  onMove,
  onDelete,
  questions,
}: {
  group: QuestionGroup
  index: number
  count: number
  /** Whether there is a question or group above or below it to move past. */
  canMove: { up: boolean; down: boolean }
  questionCount: number
  quizSettings: GameSettings
  /** How many of its questions differ from the group's time and points. */
  differing: Record<Field, number>
  errors: FieldErrors
  path: string
  onChange: (group: QuestionGroup) => void
  onApply: (field: Field) => void
  onMove: (where: 'up' | 'down') => void
  onDelete: () => void
  /** The "Questions" tab: the group's questions to reorder and open. */
  questions: ReactNode
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const infoId = useId()
  const titleError = errors[`${path}.title`]
  const infoError = errors[`${path}.info`]
  const ownError = errors[path]
  const encode = (value: unknown) => String(value)

  const amount = (field: Field, values: number[], label: (n: number) => string) => {
    const value = group[field]
    const all = value === undefined || values.includes(value) ? values : [...values, value].sort((a, b) => a - b)
    return (
      <div className="flex flex-col gap-2">
        <SelectField<number | 'none'>
          label={field === 'timeLimitSec' ? t('editor.timeLimit') : t('editor.points')}
          value={value ?? 'none'}
          options={[{ value: 'none', label: t('editor.notSet') }, ...all.map((n) => ({ value: n, label: label(n) }))]}
          onChange={(next) => onChange(withKey(group, field, next === 'none' ? undefined : next))}
        />
        {differing[field] > 0 && (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => onApply(field)}>
            {t('editor.applyToQuestions', { count: differing[field] })}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span style={tagStyle(group.color)} className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--tag)/20 text-foreground">
          <LayersIcon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 basis-40 leading-tight">
          <span className="block text-lg font-black">{t('editor.groupNOfCount', { n: index + 1, count })}</span>
          <span className="block text-sm font-semibold text-muted-foreground">{t('editor.questionCount', { count: questionCount })}</span>
        </h2>
        <div className="ml-auto flex items-center gap-0.5">
          <TagPicker value={group.color} onChange={(color) => onChange(withTag(group, color))} />
          {[
            { label: t('editor.moveGroupUp'), disabled: !canMove.up, where: 'up' as const, Icon: ArrowUpIcon },
            { label: t('editor.moveGroupDown'), disabled: !canMove.down, where: 'down' as const, Icon: ArrowDownIcon },
          ].map(({ label, disabled, where, Icon }) => (
            <Button key={label} variant="ghost" size="icon" aria-label={label} title={label} disabled={disabled} onClick={() => onMove(where)}>
              <Icon aria-hidden="true" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('editor.deleteGroup')}
            title={t('editor.deleteGroup')}
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </div>
      </div>
      {ownError && <p className="text-sm font-semibold text-destructive">{t(ownError)}</p>}

      <Tabs defaultValue="settings" className="gap-4">
        <TabsList className="h-auto! w-full gap-1 rounded-2xl p-1.5">
          <TabsTrigger value="settings" className="min-h-11 rounded-xl font-extrabold">
            <Settings2Icon aria-hidden="true" />
            {t('editor.groupTabs.settings')}
          </TabsTrigger>
          <TabsTrigger value="questions" className="min-h-11 rounded-xl font-extrabold">
            <ListOrderedIcon aria-hidden="true" />
            {t('editor.groupTabs.questions', { count: questionCount })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="questions">{questions}</TabsContent>
        <TabsContent value="settings" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={titleId} className="font-semibold">
              {t('editor.groupTitle')}
            </Label>
            <Input
              id={titleId}
              data-field={`${path}.title`}
              value={group.title}
              maxLength={120}
              onChange={(e) => onChange({ ...group, title: e.target.value })}
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? `${titleId}-error` : undefined}
              className="text-lg font-semibold"
            />
            {titleError && (
              <span id={`${titleId}-error`} className="text-sm font-semibold text-destructive">
                {t(titleError)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={infoId} className="font-semibold">
              {t('editor.groupInfo')}
            </Label>
            <Textarea
              id={infoId}
              data-field={`${path}.info`}
              value={group.info}
              maxLength={500}
              rows={3}
              onChange={(e) => onChange({ ...group, info: e.target.value })}
              aria-invalid={infoError ? true : undefined}
              aria-describedby={`${infoId}-help`}
            />
            <span id={`${infoId}-help`} className={infoError ? 'text-sm font-semibold text-destructive' : 'text-sm text-muted-foreground'}>
              {infoError ? t(infoError) : t('editor.groupInfoHelp')}
            </span>
          </div>
          <ImageField label={t('editor.groupImage')} imageId={group.imageId} onChange={(imageId) => onChange(withImage(group, imageId))} pasteAnywhere />

          <section className="flex flex-col border-t pt-4">
            <h3 className="font-extrabold">{t('editor.groupOrder')}</h3>
            <SwitchRow
              label={t('editor.keepOrder')}
              description={t('editor.keepOrderHelp')}
              checked={group.keepOrder ?? false}
              onChange={(keepOrder) => onChange(withKeepOrder(group, keepOrder))}
            />
          </section>

          <section className="flex flex-col gap-3 border-t pt-4">
            <div>
              <h3 className="font-extrabold">{t('editor.groupDefaults')}</h3>
              <p className="text-sm text-muted-foreground">{t('editor.groupDefaultsHelp')}</p>
            </div>
            <div className="grid grid-cols-2 items-start gap-3">
              {amount('timeLimitSec', TIME_LIMITS, (s) => t('editor.seconds', { count: s }))}
              {amount('points', POINTS, (p) => t('editor.pointsValue', { count: p }))}
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t pt-4">
            <div>
              <h3 className="font-extrabold">{t('editor.groupRules')}</h3>
              <p className="text-sm text-muted-foreground">{t('editor.groupRulesHelp')}</p>
            </div>
            {rules(t, quizSettings, group.settings).map(({ section, rules }) => (
              <div key={section} className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-muted-foreground">{t(`host.batch.groups.${section}`)}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rules.map((rule) => {
                    const own = group.settings[rule.key]
                    return (
                      <SelectField
                        key={rule.key}
                        label={rule.label}
                        value={own === undefined ? 'same' : encode(own)}
                        options={[
                          { value: 'same', label: t('editor.sameAsQuiz', { value: rule.name(quizSettings[rule.key] as never) }) },
                          ...rule.values.map((value) => ({ value: encode(value), label: rule.name(value as never) })),
                        ]}
                        onChange={(next) =>
                          onChange({
                            ...group,
                            settings: withKey(group.settings, rule.key, next === 'same' ? undefined : rule.values.find((v) => encode(v) === next)),
                          })
                        }
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
