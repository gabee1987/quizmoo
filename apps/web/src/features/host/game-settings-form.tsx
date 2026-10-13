import {
  answerPalettes,
  answerSymbols,
  gameSettingsSchema,
  gameThemes,
  teamAnswerModes,
  type AnswerPalette,
  type AnswerSymbols,
  type GameSettings,
} from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { XIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChoiceCards } from '@/components/choice-cards'
import { OptionSymbol } from '@/components/icons'
import { OPTION_COLOURS } from '@/components/option-colours'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { themeSwatches } from '@/lib/themes'

/** i18n key of the first settings problem (team names), or null when the settings are valid. */
export function settingsError(settings: GameSettings): string | null {
  const result = gameSettingsSchema.safeParse(settings)
  return result.success ? null : (result.error.issues[0]?.message ?? 'errors.invalidInput')
}

/** The settings in each group of the form; a batch edit changes a group as a whole. */
export const settingsSections = {
  flow: ['mode', 'teamNames', 'teamAnswer', 'teamsChoose', 'revealAnswers', 'scoreboard', 'finalResults'],
  look: ['theme', 'answerPalette', 'answerSymbols', 'answerStyle'],
  scoring: ['speedBonus', 'streakBonus', 'answerChanges', 'answerLockSec', 'shuffleOptions'],
} as const satisfies Record<string, readonly (keyof GameSettings)[]>
export type SettingsSection = keyof typeof settingsSections
export const allSections = Object.keys(settingsSections) as SettingsSection[]

/** Short descriptions of one group's settings, e.g. ["Classic", "Answers: after each question", ...]. */
export function sectionSummary(settings: GameSettings, section: SettingsSection, t: TFunction): string[] {
  const items = {
    flow: [
      t(`host.create.modes.${settings.mode}`),
      settings.mode === 'team' ? settings.teamNames.join(', ') : null,
      settings.mode === 'team' ? teamAnswerLabel(settings, t) : null,
      `${t('host.create.revealAnswers')}: ${t(`host.create.revealAnswersOptions.${settings.revealAnswers}`)}`,
      settings.revealAnswers === 'afterQuestion'
        ? `${t('host.create.scoreboard')}: ${t(`host.create.scoreboardOptions.${settings.scoreboard}`)}`
        : null,
      `${t('host.create.finalResults')}: ${t(`host.create.finalResultsOptions.${settings.finalResults}`)}`,
    ],
    look: [
      `${t('host.create.theme')}: ${t(`host.create.themeOptions.${settings.theme}`)}`,
      t(`host.create.answerStyleOptions.${settings.answerStyle}`),
      settings.answerPalette !== 'vivid' ? t(`host.create.answerPaletteOptions.${settings.answerPalette}`) : null,
      settings.answerSymbols !== 'shapes' ? t(`host.create.answerSymbolsOptions.${settings.answerSymbols}`) : null,
    ],
    scoring: [
      settings.speedBonus ? t('host.create.speedBonus') : null,
      settings.streakBonus ? t('host.create.streakBonus') : null,
      answerChangesLabel(settings, t),
      settings.shuffleOptions ? t('host.create.shuffle') : null,
    ],
  }[section]
  return items.filter((item): item is string => Boolean(item))
}

/** Short label of the answer changes setting, or null when it is off. */
/** How teams answer, e.g. "Majority vote" or "Majority vote, teams choose". */
export function teamAnswerLabel(settings: GameSettings, t: TFunction): string {
  const mode = t(`host.create.teamAnswerOptions.${settings.teamAnswer}`)
  return settings.teamsChoose ? t('host.create.teamAnswerChosen', { mode }) : mode
}

export function answerChangesLabel(settings: GameSettings, t: TFunction): string | null {
  if (!settings.answerChanges) return null
  return settings.answerLockSec > 0
    ? t('host.create.answerChangesLocked', { count: settings.answerLockSec })
    : t('host.create.answerChangesShort')
}

/** One line describing the settings, e.g. "Classic · After each question · Plain · Speed bonus". */
export function settingsSummary(settings: GameSettings, t: TFunction): string {
  return allSections.flatMap((section) => sectionSummary(settings, section, t)).join(' · ')
}

/** Whether any setting of `section` differs between two settings. */
export function sectionChanged(a: GameSettings, b: GameSettings, section: SettingsSection): boolean {
  return settingsSections[section].some((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
}

/** `settings` with one group taken from `from`. */
export function withSection(settings: GameSettings, from: GameSettings, section: SettingsSection): GameSettings {
  const next = { ...settings }
  for (const key of settingsSections[section]) Object.assign(next, { [key]: from[key] })
  return next
}

/**
 * Game settings. Used in the quiz editor (the quiz's defaults), when starting a game (overrides)
 * and, one group at a time (`sections`), in the batch edit of several quizzes.
 */
export function GameSettingsForm({
  value,
  onChange,
  sections = allSections,
}: {
  value: GameSettings
  onChange: (settings: GameSettings) => void
  sections?: readonly SettingsSection[]
}) {
  const { t } = useTranslation()
  const [newTeam, setNewTeam] = useState('')
  const set = (patch: Partial<GameSettings>) => onChange({ ...value, ...patch })
  const show = (section: SettingsSection) => sections.includes(section)
  const error = settingsError(value)

  function addTeam() {
    const name = newTeam.trim()
    if (!name || value.teamNames.length >= 20) return
    set({ teamNames: [...value.teamNames, name] })
    setNewTeam('')
  }

  return (
    <div className="flex flex-col gap-6">
      {show('flow') && (
        <>
          <ChoiceCards
            legend={t('host.create.mode')}
            value={value.mode}
            choices={(['classic', 'team'] as const).map((mode) => ({
              value: mode,
              label: t(`host.create.modes.${mode}`),
              description: t(`host.create.modes.${mode}Help`),
            }))}
            onChange={(mode) =>
              set(
                mode === 'team' && value.teamNames.length === 0
                  ? { mode, teamNames: [t('host.create.defaultTeam', { n: 1 }), t('host.create.defaultTeam', { n: 2 })] }
                  : { mode },
              )
            }
          />

          {value.mode === 'team' && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-bold">{t('host.create.teams')}</legend>
              <ul className="flex flex-wrap gap-2">
                {value.teamNames.map((name, i) => (
                  <li
                    key={`${name}-${i}`}
                    className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 font-semibold text-secondary-foreground"
                  >
                    <span>{name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-8 rounded-full"
                      aria-label={t('host.create.removeTeam', { name })}
                      onClick={() => set({ teamNames: value.teamNames.filter((_, j) => j !== i) })}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTeam()
                    }
                  }}
                  maxLength={40}
                  aria-label={t('host.create.teamName')}
                  placeholder={t('host.create.teamName')}
                  className="flex-1"
                />
                <Button type="button" variant="secondary" onClick={addTeam}>
                  {t('host.create.addTeam')}
                </Button>
              </div>
              {error && <p className="text-sm font-semibold text-destructive">{t(error)}</p>}
            </fieldset>
          )}
          {value.mode === 'team' && (
            <>
              <ChoiceCards
                legend={t('host.create.teamAnswer')}
                value={value.teamAnswer}
                columns={1}
                choices={teamAnswerModes.map((mode) => ({
                  value: mode,
                  label: t(`host.create.teamAnswerOptions.${mode}`),
                  description: t(`host.create.teamAnswerOptions.${mode}Help`),
                }))}
                onChange={(teamAnswer) => set({ teamAnswer })}
              />
              <SwitchRow
                label={t('host.create.teamsChoose')}
                description={t('host.create.teamsChooseHelp')}
                checked={value.teamsChoose}
                onChange={(teamsChoose) => set({ teamsChoose })}
              />
            </>
          )}
        </>
      )}
      {show('look') && (
        <ChoiceCards
          legend={t('host.create.theme')}
          value={value.theme}
          choices={gameThemes.map((theme) => ({
            value: theme,
            label: t(`host.create.themeOptions.${theme}`),
            adornment: <ThemeSwatch colours={themeSwatches(theme)} />,
          }))}
          onChange={(theme) => set({ theme })}
          help={t('host.create.themeHelp')}
        />
      )}
      {show('flow') && (
        <>
          <ChoiceCards
            legend={t('host.create.revealAnswers')}
            value={value.revealAnswers}
            choices={choices(['afterQuestion', 'atEnd'] as const, (v) => t(`host.create.revealAnswersOptions.${v}`))}
            // Scores would give the answers away, so results at the end means no scoreboard until then.
            onChange={(revealAnswers) => set(revealAnswers === 'atEnd' ? { revealAnswers, scoreboard: 'onDemand' } : { revealAnswers })}
          />
          <ChoiceCards
            legend={t('host.create.scoreboard')}
            value={value.scoreboard}
            choices={choices(['afterQuestion', 'onDemand'] as const, (v) => t(`host.create.scoreboardOptions.${v}`))}
            onChange={(scoreboard) => set({ scoreboard })}
            disabled={value.revealAnswers === 'atEnd'}
            help={value.revealAnswers === 'atEnd' ? t('host.create.scoreboardAtEnd') : undefined}
          />
          <ChoiceCards
            legend={t('host.create.finalResults')}
            value={value.finalResults}
            choices={choices(['immediately', 'onRelease'] as const, (v) => t(`host.create.finalResultsOptions.${v}`))}
            onChange={(finalResults) => set({ finalResults })}
            help={value.finalResults === 'onRelease' ? t('host.create.finalResultsHelp') : undefined}
          />
        </>
      )}
      {show('look') && (
        <>
          <ChoiceCards
            legend={t('host.create.answerPalette')}
            value={value.answerPalette}
            choices={answerPalettes.map((palette) => ({
              value: palette,
              label: t(`host.create.answerPaletteOptions.${palette}`),
              adornment: <PaletteSwatch palette={palette} />,
            }))}
            onChange={(answerPalette) => set({ answerPalette })}
            help={t('host.create.answerPaletteHelp')}
          />
          <ChoiceCards
            legend={t('host.create.answerSymbols')}
            value={value.answerSymbols}
            choices={answerSymbols.map((symbols) => ({
              value: symbols,
              label: t(`host.create.answerSymbolsOptions.${symbols}`),
              adornment: <SymbolsSwatch symbols={symbols} />,
            }))}
            onChange={(answerSymbols) => set({ answerSymbols })}
          />
          <ChoiceCards
            legend={t('host.create.answerStyle')}
            value={value.answerStyle}
            choices={choices(['colourful', 'plain'] as const, (v) => t(`host.create.answerStyleOptions.${v}`))}
            onChange={(answerStyle) => set({ answerStyle })}
            help={t('host.create.answerStyleHelp')}
          />
        </>
      )}
      {show('scoring') && (
        <div className="flex flex-col">
          <SwitchRow
            label={t('host.create.speedBonus')}
            description={t('host.create.speedBonusHelp')}
            checked={value.speedBonus}
            onChange={(speedBonus) => set({ speedBonus })}
          />
          <SwitchRow
            label={t('host.create.streakBonus')}
            description={t('host.create.streakBonusHelp')}
            checked={value.streakBonus}
            onChange={(streakBonus) => set({ streakBonus })}
          />
          <SwitchRow
            label={t('host.create.answerChanges')}
            description={t('host.create.answerChangesHelp')}
            checked={value.answerChanges}
            onChange={(answerChanges) => set({ answerChanges })}
          />
          {value.answerChanges && (
            <div className="pb-2">
              <ChoiceCards
                legend={t('host.create.answerLock')}
                value={String(value.answerLockSec)}
                choices={[...new Set([0, 5, 10, value.answerLockSec])]
                  .sort((a, b) => a - b)
                  .map((sec) => ({
                    value: String(sec),
                    label: sec === 0 ? t('host.create.answerLockEnd') : t('host.create.answerLockBefore', { count: sec }),
                  }))}
                onChange={(sec) => set({ answerLockSec: Number(sec) })}
              />
            </div>
          )}
          <SwitchRow
            label={t('host.create.shuffle')}
            checked={value.shuffleOptions}
            onChange={(shuffleOptions) => set({ shuffleOptions })}
          />
        </div>
      )}
    </div>
  )
}

function choices<T extends string>(values: readonly T[], label: (value: T) => string) {
  return values.map((value) => ({ value, label: label(value) }))
}

function ThemeSwatch({ colours }: { colours: readonly string[] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
      {colours.map((colour) => (
        <span key={colour} className="size-6 rounded-full border-2 border-card" style={{ background: colour }} />
      ))}
    </span>
  )
}

/** The six answer colours of a palette; the wrapper's data-palette selects them in styles.css. */
function PaletteSwatch({ palette }: { palette: AnswerPalette }) {
  return (
    <span aria-hidden="true" data-palette={palette} className="flex shrink-0 -space-x-1">
      {Array.from({ length: OPTION_COLOURS }, (_, n) => (
        <span key={n} className="size-5 rounded-full border-2 border-card" style={{ background: `var(--option-${n + 1})` }} />
      ))}
    </span>
  )
}

function SymbolsSwatch({ symbols }: { symbols: AnswerSymbols }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 gap-1 text-foreground">
      {[0, 1, 2].map((index) => (
        <span key={index} className="grid size-6 place-items-center rounded-md bg-muted text-xs">
          <OptionSymbol symbols={symbols} index={index} className="size-3.5" />
        </span>
      ))}
    </span>
  )
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-sm text-muted-foreground">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
