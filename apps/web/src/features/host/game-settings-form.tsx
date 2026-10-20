import {
  MAX_TEAMS,
  answerPalettes,
  answerSymbols,
  gameSettingsSchema,
  gameThemes,
  newGameSettingsSchema,
  teamAnswerModes,
  teamSetups,
  type AnswerPalette,
  type AnswerSymbols,
  type CustomPalette,
  type CustomTheme,
  type GameSettings,
} from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { InfoIcon, PaletteIcon, RouteIcon, TrophyIcon, XIcon } from 'lucide-react'
import { useId, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChoiceCards } from '@/components/choice-cards'
import { Collapse } from '@/components/collapse'
import { ColourWheel } from '@/components/colour-wheel'
import { OptionSymbol } from '@/components/icons'
import { OPTION_COLOURS } from '@/components/option-colours'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { PlayerAvatar } from '@/components/player-avatar'
import { paletteVars, textOn, themeSwatches, themeVars } from '@/lib/themes'

/**
 * i18n key of the first settings problem, or null when the settings are valid. A new game
 * (`newGame`) also checks its teams.
 */
export function settingsError(settings: GameSettings, { newGame = false } = {}): string | null {
  const result = (newGame ? newGameSettingsSchema : gameSettingsSchema).safeParse(settings)
  return result.success ? null : (result.error.issues[0]?.message ?? 'errors.invalidInput')
}

/** Settings only a game has (its teams): quizzes, My settings and batch edits leave them alone. */
export const gameOnlySettings = ['teamSetup', 'teamNames', 'soloPlayers'] as const satisfies readonly (keyof GameSettings)[]

/**
 * A new game's starting settings from a quiz's: a team quiz without saved team names lets the
 * players make the teams (saved names, from before teams were set per game, stay the host's list).
 */
export function newGameSettings(quizSettings: GameSettings): GameSettings {
  if (quizSettings.mode !== 'team' || quizSettings.teamNames.length > 0) return quizSettings
  return { ...quizSettings, teamSetup: 'players' }
}

/** The settings in each group of the form; a batch edit changes a group as a whole. */
export const settingsSections = {
  flow: ['mode', 'teamSetup', 'teamNames', 'soloPlayers', 'teamAnswer', 'teamsChoose', 'lateJoin', 'revealAnswers', 'scoreboard', 'finalResults'],
  look: ['theme', 'customTheme', 'answerPalette', 'customPalette', 'answerSymbols', 'answerStyle'],
  scoring: ['speedBonus', 'streakBonus', 'answerChanges', 'answerLockSec', 'shuffleOptions'],
} as const satisfies Record<string, readonly (keyof GameSettings)[]>
export type SettingsSection = keyof typeof settingsSections
export const allSections = Object.keys(settingsSections) as SettingsSection[]
/** Each group's icon on its tab (My settings, the new game dialog). */
export const sectionIcons: Record<SettingsSection, ComponentType<{ className?: string }>> = {
  flow: RouteIcon,
  look: PaletteIcon,
  scoring: TrophyIcon,
}

/** Short descriptions of one group's settings, e.g. ["Classic", "Answers: after each question", ...]. */
export function sectionSummary(settings: GameSettings, section: SettingsSection, t: TFunction): string[] {
  const items = {
    flow: [
      t(`host.create.modes.${settings.mode}`),
      settings.mode === 'team' ? teamAnswerLabel(settings, t) : null,
      settings.mode === 'team' && settings.soloPlayers ? t('host.create.soloPlayers') : null,
      settings.lateJoin ? t('host.create.lateJoin') : null,
      `${t('host.create.revealAnswers')}: ${t(`host.create.revealAnswersOptions.${settings.revealAnswers}`)}`,
      settings.revealAnswers === 'afterQuestion'
        ? `${t('host.create.scoreboard')}: ${t(`host.create.scoreboardOptions.${settings.scoreboard}`)}`
        : null,
      `${t('host.create.finalResults')}: ${t(`host.create.finalResultsOptions.${settings.finalResults}`)}`,
    ],
    look: [
      `${t('host.create.theme')}: ${t(`host.create.themeOptions.${settings.theme}`)}`,
      t(`host.create.answerStyleOptions.${settings.answerStyle}`),
      settings.answerPalette !== 'vivid'
        ? `${t('host.create.answerPalette')}: ${t(`host.create.answerPaletteOptions.${settings.answerPalette}`)}`
        : null,
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

/** How teams answer: "Teams choose", or "Same for all teams: Majority vote". */
export function teamAnswerLabel(settings: GameSettings, t: TFunction): string {
  if (settings.teamsChoose) return t('host.create.teamsChooseOptions.choose')
  return t('host.create.teamAnswerSame', { mode: t(`host.create.teamAnswerOptions.${settings.teamAnswer}`) })
}

/** Short label of the answer changes setting, or null when it is off. */
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
 * Game settings. Used in the quiz editor (the quiz's defaults), My settings, when starting a game
 * (`newGame`: also who makes the teams and the host's team list) and, one group at a time
 * (`sections`), in the batch edit of several quizzes.
 */
export function GameSettingsForm({
  value,
  onChange,
  sections = allSections,
  newGame = false,
}: {
  value: GameSettings
  onChange: (settings: GameSettings) => void
  sections?: readonly SettingsSection[]
  newGame?: boolean
}) {
  const { t } = useTranslation()
  const set = (patch: Partial<GameSettings>) => onChange({ ...value, ...patch })
  const show = (section: SettingsSection) => sections.includes(section)

  function setTeamSetup(teamSetup: GameSettings['teamSetup']) {
    // The host's list starts with two teams to rename; players' teams need none.
    const seeded = teamSetup === 'host' && value.teamNames.length === 0
    set(seeded ? { teamSetup, teamNames: [t('host.create.defaultTeam', { n: 1 }), t('host.create.defaultTeam', { n: 2 })] } : { teamSetup })
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
            onChange={(mode) => set({ mode })}
          />

          {/* Team settings open and close with the mode instead of jumping in (the parent's gap is taken inside). */}
          <Collapse open={value.mode === 'team'} className="-mt-6" innerClassName="flex flex-col gap-6 pt-6">
            {newGame && (
              <>
                <ChoiceCards
                  legend={t('host.create.teamSetup')}
                  value={value.teamSetup}
                  columns={1}
                  choices={teamSetups.map((setup) => ({
                    value: setup,
                    label: t(`host.create.teamSetupOptions.${setup}`),
                    description: t(`host.create.teamSetupOptions.${setup}Help`),
                  }))}
                  onChange={setTeamSetup}
                />
                <Collapse open={value.teamSetup !== 'players'} className="-mt-6" innerClassName="pt-6">
                  <TeamNamesField value={value} onChange={(teamNames) => set({ teamNames })} />
                </Collapse>
                <SwitchRow
                  label={t('host.create.soloPlayers')}
                  description={t('host.create.soloPlayersHelp')}
                  checked={value.soloPlayers}
                  onChange={(soloPlayers) => set({ soloPlayers })}
                />
              </>
            )}
              <ChoiceCards
                legend={t('host.create.teamAnswer')}
                value={value.teamsChoose ? 'choose' : 'same'}
                columns={1}
                choices={(['choose', 'same'] as const).map((option) => ({
                  value: option,
                  label: t(`host.create.teamsChooseOptions.${option}`),
                  description: t(`host.create.teamsChooseOptions.${option}Help`),
                }))}
                // Teams that choose all start on captain decides.
                onChange={(option) => set(option === 'choose' ? { teamsChoose: true, teamAnswer: 'captain' } : { teamsChoose: false })}
              />
              <Collapse open={!value.teamsChoose} className="-mt-6" innerClassName="pt-6">
                <ChoiceCards
                  legend={t('host.create.teamAnswerMode')}
                  value={value.teamAnswer}
                  columns={1}
                  choices={teamAnswerModes.map((mode) => ({
                    value: mode,
                    label: t(`host.create.teamAnswerOptions.${mode}`),
                    description: t(`host.create.teamAnswerOptions.${mode}Help`),
                  }))}
                  onChange={(teamAnswer) => set({ teamAnswer })}
                />
              </Collapse>
          </Collapse>
        </>
      )}
      {show('look') && (
        <ChoiceCards
          legend={t('host.create.theme')}
          value={value.theme}
          choices={gameThemes.map((theme) => ({
            value: theme,
            label: t(`host.create.themeOptions.${theme}`),
            adornment: <ThemeSwatch colours={themeSwatches(theme, value.customTheme)} />,
          }))}
          onChange={(theme) => set({ theme })}
          help={t('host.create.themeHelp')}
        />
      )}
      {show('look') && (
        <Collapse open={value.theme === 'custom'} className="-mt-6" innerClassName="pt-6">
          <CustomThemePicker value={value.customTheme} onChange={(customTheme) => set({ customTheme })} />
        </Collapse>
      )}
      {show('flow') && (
        <>
          <ChoiceCards
            legend={t('host.create.revealAnswers')}
            value={value.revealAnswers}
            choices={choices(['afterQuestion', 'atEnd'] as const, (v) => t(`host.create.revealAnswersOptions.${v}`))}
            // Scores would give the answers away, so results at the end means a scoreboard only when the host shows it.
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
          <SwitchRow
            label={t('host.create.lateJoin')}
            description={t('host.create.lateJoinHelp')}
            checked={value.lateJoin}
            onChange={(lateJoin) => set({ lateJoin })}
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
              adornment: <PaletteSwatch palette={palette} custom={value.customPalette} />,
            }))}
            onChange={(answerPalette) => set({ answerPalette })}
            help={t('host.create.answerPaletteHelp')}
          />
          <Collapse open={value.answerPalette === 'custom'} className="-mt-6" innerClassName="pt-6">
            <CustomPalettePicker
              value={value.customPalette}
              symbols={value.answerSymbols}
              onChange={(customPalette) => set({ customPalette })}
            />
          </Collapse>
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
          <Collapse open={value.answerChanges} innerClassName="pb-2">
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
          </Collapse>
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

/** The host's teams for a new game: chips with remove, a name field and "Add team", and the list's problem. */
function TeamNamesField({ value, onChange }: { value: GameSettings; onChange: (teamNames: string[]) => void }) {
  const { t } = useTranslation()
  const [newTeam, setNewTeam] = useState('')
  const error = settingsError(value, { newGame: true })
  // The last problem stays as text while its line closes.
  const [shownError, setShownError] = useState(error)
  if (error && error !== shownError) setShownError(error)
  const full = value.teamNames.length >= MAX_TEAMS

  function addTeam() {
    const name = newTeam.trim()
    if (!name || full) return
    onChange([...value.teamNames, name])
    setNewTeam('')
  }

  return (
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
              onClick={() => onChange(value.teamNames.filter((_, j) => j !== i))}
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
          disabled={full}
          aria-label={t('host.create.teamName')}
          placeholder={t('host.create.teamName')}
          className="flex-1"
        />
        <Button type="button" variant="secondary" onClick={addTeam} disabled={full}>
          {t('host.create.addTeam')}
        </Button>
      </div>
      <Collapse open={!!error} className="-mt-2" innerClassName="pt-2">
        <p className="text-sm font-semibold text-destructive">{shownError && t(shownError)}</p>
      </Collapse>
    </fieldset>
  )
}

/** The custom theme's colours: main and accent on a colour wheel, and how strong the colours are. */
function CustomThemePicker({ value, onChange }: { value: CustomTheme; onChange: (value: CustomTheme) => void }) {
  const { t } = useTranslation()
  const strengthId = useId()
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-dashed p-4">
      <LegendWithHelp title={t('host.create.customTheme.title')} help={t('host.create.customTheme.help')} />
      <div className="flex flex-wrap items-center gap-6">
        <ColourWheel
          chroma={value.chroma}
          handles={[
            { key: 'hue', hue: value.hue, label: t('host.create.customTheme.main') },
            { key: 'accent', hue: value.accent, label: t('host.create.customTheme.accent') },
          ]}
          onChange={(key, hue) => onChange({ ...value, [key]: hue })}
        />
        <div className="flex min-w-48 flex-1 flex-col gap-3">
          <label htmlFor={strengthId} className="font-semibold">
            {t('host.create.customTheme.strength')}
          </label>
          <input
            id={strengthId}
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={value.chroma}
            onChange={(e) => onChange({ ...value, chroma: Number(e.target.value) })}
            className="h-2 w-full cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-sm text-muted-foreground" aria-hidden="true">
            <span>{t('host.create.customTheme.muted')}</span>
            <span>{t('host.create.customTheme.vivid')}</span>
          </div>
        </div>
      </div>
      <CustomThemeSample value={value} />
    </fieldset>
  )
}

/** A fieldset's legend with an info button; the longer explanation shows only when asked for. */
function LegendWithHelp({ title, help }: { title: string; help: string }) {
  const { t } = useTranslation()
  const helpId = useId()
  const [open, setOpen] = useState(false)
  return (
    <>
      <legend className="flex items-center gap-1 px-1 font-bold">
        {title}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-full text-muted-foreground hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground"
          aria-label={t('host.create.aboutThis', { title })}
          aria-expanded={open}
          aria-controls={helpId}
          onClick={() => setOpen((o) => !o)}
        >
          <InfoIcon aria-hidden="true" />
        </Button>
      </legend>
      {/* The fieldset's gap is taken inside (below), so a closed one leaves none. */}
      <Collapse open={open} className="-mb-3" innerClassName="pb-3">
        <p id={helpId} className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          {help}
        </p>
      </Collapse>
    </>
  )
}

/**
 * The lobby card a player waits on, in the custom colours: the main colour on the button, the accent
 * on the avatar bubble and in the ring. The question preview shows little of the accent, so this
 * makes the accent handle's effect visible while it is dragged.
 */
function CustomThemeSample({ value }: { value: CustomTheme }) {
  const { t } = useTranslation()
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold text-muted-foreground">{t('host.create.customTheme.sample')}</figcaption>
      <div
        aria-hidden="true"
        data-theme="custom"
        style={themeVars({ theme: 'custom', customTheme: value })}
        className="flex justify-center rounded-2xl bg-background px-4 py-6 text-foreground"
      >
        <div className="glow-border flex w-full max-w-64 flex-col items-center gap-3 rounded-3xl bg-card p-5 shadow-soft">
          <PlayerAvatar avatar="🐮" size="lg" className="bg-accent" />
          <p className="text-lg font-black">{t('host.create.customTheme.sampleName')}</p>
          <span className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
            {t('host.create.customTheme.sampleButton')}
          </span>
        </div>
      </div>
    </figure>
  )
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

/**
 * The custom answer colours: any colour per answer from the browser's colour picker. Each row shows
 * the answer as it will look, with the text colour the app picks for it (white or dark).
 */
function CustomPalettePicker({
  value,
  symbols,
  onChange,
}: {
  value: CustomPalette
  symbols: AnswerSymbols
  onChange: (value: CustomPalette) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-dashed p-4">
      <LegendWithHelp title={t('host.create.customPalette.title')} help={t('host.create.customPalette.help')} />
      <ul className="grid gap-2 sm:grid-cols-2">
        {value.map((colour, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl p-1 focus-within:ring-[3px] focus-within:ring-ring">
              <input
                type="color"
                value={colour}
                onChange={(e) => onChange(value.map((c, j) => (j === i ? e.target.value.toLowerCase() : c)))}
                aria-label={t('host.create.customPalette.answer', { n: i + 1 })}
                className="size-11 shrink-0 cursor-pointer rounded-lg border-2 border-border bg-card p-0.5"
              />
              {/* The answer as it will look, with the text colour the app picks. */}
              <span
                aria-hidden="true"
                // A faint edge, so a white or very light answer still shows its shape.
                className="flex h-11 flex-1 items-center gap-2 rounded-xl px-3 font-bold ring-1 ring-foreground/15 ring-inset"
                style={{ background: colour, color: textOn(colour) }}
              >
                <OptionSymbol symbols={symbols} index={i} className="size-4" />
                {t('host.create.customPalette.answer', { n: i + 1 })}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/** The six answer colours of a palette; the wrapper's data-palette selects them in styles.css (the custom one's come inline). */
function PaletteSwatch({ palette, custom }: { palette: AnswerPalette; custom: CustomPalette }) {
  return (
    <span
      aria-hidden="true"
      data-palette={palette}
      style={paletteVars({ answerPalette: palette, customPalette: custom })}
      className="flex shrink-0 -space-x-1"
    >
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

export function SwitchRow({
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
