import {
  AlarmClockPlusIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleDotIcon,
  CrownIcon,
  EllipsisVerticalIcon,
  FileDownIcon,
  FlameIcon,
  GripVerticalIcon,
  HourglassIcon,
  ImageIcon,
  LaptopIcon,
  LockIcon,
  LogOutIcon,
  MegaphoneIcon,
  MonitorIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  QrCodeIcon,
  Settings2Icon,
  SkipForwardIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  TrophyIcon,
  UploadIcon,
  UserRoundIcon,
  WifiOffIcon,
  ZapIcon,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ShapeIcon } from '@/components/icons'
import { optionFill, optionVars } from '@/components/option-colours'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { sectionIcons } from '@/features/host/game-settings-form'

/** My settings' tab icons (`routes/host/settings.tsx`). */
const settingsTabIcons = { games: SlidersHorizontalIcon, messages: MegaphoneIcon, branding: ImageIcon, account: UserRoundIcon } as const

/**
 * Small pictures of the app's own controls for the help page, one per section, built from the same
 * buttons, colours, icons and labels as the real screens so they follow the theme, the colour mode
 * and the language. They are pictures, not controls: hidden from screen readers and not focusable
 * (the section's text says the same in words), with a visible caption.
 */

/** A button's look without being a button. */
function Btn({
  variant = 'default',
  size = 'sm',
  className,
  children,
}: {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'success'
  size?: 'sm' | 'default' | 'lg' | 'xl' | 'icon-sm'
  className?: string
  children: ReactNode
}) {
  return <span className={buttonVariants({ variant, size, className: cn('pointer-events-none', className) })}>{children}</span>
}

function Avatar({ n }: { n: number }) {
  const tones = ['bg-primary text-primary-foreground', 'bg-accent text-accent-foreground', 'bg-secondary text-secondary-foreground', 'bg-success text-success-foreground']
  return <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-sm font-black', tones[(n - 1) % tones.length])}>{n}</span>
}

function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-60 flex-col gap-3 rounded-[1.75rem] border-4 border-foreground/15 bg-background p-3 pt-5 shadow-soft', className)}>
      {children}
    </div>
  )
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex w-full flex-col gap-3 rounded-2xl border bg-card p-3 shadow-soft', className)}>{children}</div>
}

function Switch() {
  return (
    <span className="relative inline-block h-6 w-11 shrink-0 rounded-full bg-primary">
      <span className="absolute top-0.5 right-0.5 size-5 rounded-full bg-background shadow" />
    </span>
  )
}

function JoinFigure() {
  const { t } = useTranslation()
  return (
    <Phone>
      <span className="text-sm font-bold">{t('join.pin')}</span>
      <span className="flex justify-between gap-1">
        {'123456'.split('').map((digit, index) => (
          <span key={index} className="grid h-10 flex-1 place-items-center rounded-lg border-2 bg-card text-lg font-black">
            {digit}
          </span>
        ))}
      </span>
      <Btn size="default" className="w-full">
        {t('join.submit')}
      </Btn>
      <Btn variant="secondary" className="w-full">
        <QrCodeIcon aria-hidden="true" />
        {t('join.scan')}
      </Btn>
    </Phone>
  )
}

function AnsweringFigure() {
  const { t } = useTranslation()
  const options = t('help.figures.answering.options', { returnObjects: true }) as string[]
  return (
    <Phone>
      <span className="flex items-center gap-2">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full w-2/3 rounded-full bg-primary" />
        </span>
        <span className="grid size-8 place-items-center rounded-full border-3 border-primary text-xs font-black tabular-nums">12</span>
      </span>
      <span className="text-center font-extrabold">{t('help.figures.answering.question')}</span>
      <span className="grid grid-cols-2 gap-2">
        {options.map((option, index) => (
          <span
            key={option}
            style={optionVars(index)}
            className={cn(optionFill, 'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-bold', index === 1 && 'ring-3 ring-primary ring-offset-2 ring-offset-background')}
          >
            <ShapeIcon index={index} className="size-4" />
            {option}
          </span>
        ))}
      </span>
    </Phone>
  )
}

function PointsFigure() {
  const { t } = useTranslation()
  return (
    <Panel className="max-w-72">
      <span className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-success text-success-foreground">
          <CheckIcon className="size-6" aria-hidden="true" />
        </span>
        <span className="text-3xl font-black tabular-nums">+950</span>
      </span>
      <span className="flex flex-col gap-1.5 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <ZapIcon className="size-4 text-primary" aria-hidden="true" />
          {t('help.figures.points.speed')}
        </span>
        {/* 1000 points at once, half of them for an answer in the last moment; this one came halfway. */}
        <span className="relative h-3 overflow-hidden rounded-full bg-muted">
          <span className="absolute inset-y-0 left-0 w-3/4 rounded-full bg-primary" />
        </span>
        <span className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>500</span>
          <span>750</span>
          <span>1000</span>
        </span>
      </span>
      <span className="flex items-center gap-2 rounded-xl bg-warning px-3 py-1.5 text-sm font-bold text-warning-foreground">
        <FlameIcon className="size-4" aria-hidden="true" />
        {t('help.figures.points.streak')}
      </span>
    </Panel>
  )
}

function TeamsFigure() {
  const { t } = useTranslation()
  const picks = [0, 0, 1]
  return (
    <Panel className="max-w-80">
      {picks.map((pick, index) => (
        <span key={index} className="flex items-center gap-2.5">
          <Avatar n={index + 1} />
          <span className="flex-1 truncate text-sm font-bold">{t('help.figures.player', { n: index + 1 })}</span>
          {index === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
              <CrownIcon className="size-3.5 text-warning" aria-hidden="true" />
              {t('play.team.captain')}
            </span>
          )}
          <span style={optionVars(pick)} className={cn(optionFill, 'grid size-8 place-items-center rounded-lg')}>
            <ShapeIcon index={pick} className="size-4" />
          </span>
        </span>
      ))}
      <span className="flex items-center justify-end gap-2 border-t pt-3 text-sm font-extrabold">
        {t('help.figures.teams.answer')}
        <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span style={optionVars(0)} className={cn(optionFill, 'grid size-9 place-items-center rounded-lg ring-3 ring-primary ring-offset-2 ring-offset-card')}>
          <ShapeIcon index={0} className="size-5" />
        </span>
      </span>
    </Panel>
  )
}

function ConnectionFigure() {
  const { t } = useTranslation()
  return (
    <Phone className="relative">
      <span className="flex items-center justify-center gap-2 rounded-lg bg-warning px-2 py-1.5 text-center text-xs font-bold text-warning-foreground">
        <WifiOffIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {t('errors.connectionLost')}
      </span>
      <span className="flex justify-end">
        <Btn variant="secondary" size="icon-sm" className="rounded-full">
          <Settings2Icon aria-hidden="true" />
        </Btn>
      </span>
      <span className="ml-auto flex w-44 flex-col rounded-xl border bg-popover p-1 text-sm shadow-soft">
        <span className="flex items-center gap-2 rounded-lg bg-accent px-2 py-1.5 font-semibold text-accent-foreground">
          <LogOutIcon className="size-4" aria-hidden="true" />
          {t('play.leave.action')}
        </span>
      </span>
    </Phone>
  )
}

function HostStartFigure() {
  const { t } = useTranslation()
  const device = (Icon: ComponentType<{ className?: string }>, label: string, many = false) => (
    <span className="flex flex-col items-center gap-1.5">
      <span className="flex">
        {(many ? [0, 1, 2] : [0]).map((index) => (
          <span key={index} className={cn('grid size-12 place-items-center rounded-2xl border bg-card shadow-soft', index > 0 && '-ml-4')}>
            <Icon className="size-6 text-primary" />
          </span>
        ))}
      </span>
      <span className="text-center text-xs font-bold">{label}</span>
    </span>
  )
  return (
    <span className="flex flex-wrap items-center justify-center gap-3">
      {device(LaptopIcon, t('help.figures.devices.host'))}
      <ArrowRightIcon className="size-5 text-muted-foreground" aria-hidden="true" />
      {device(MonitorIcon, t('help.figures.devices.screen'))}
      <span className="basis-full" />
      {device(SmartphoneIcon, t('help.figures.devices.players'), true)}
    </span>
  )
}

function QuizzesFigure() {
  const { t } = useTranslation()
  return (
    <span className="flex w-full max-w-80 flex-col gap-3">
      <span className="flex gap-2">
        <Btn>
          <PlusIcon aria-hidden="true" />
          {t('host.newQuiz')}
        </Btn>
        <Btn variant="secondary">
          <UploadIcon aria-hidden="true" />
          {t('quizFile.import')}
        </Btn>
      </span>
      <Panel>
        <span className="flex flex-col">
          <span className="font-extrabold">{t('help.figures.quizTitle')}</span>
          <span className="text-sm text-muted-foreground">{t('host.questionCount', { count: 12 })}</span>
        </span>
        <span className="flex gap-2">
          <Btn className="flex-1">
            <PlayIcon aria-hidden="true" />
            {t('host.play')}
          </Btn>
          <Btn variant="secondary" className="flex-1">
            <PencilIcon aria-hidden="true" />
            {t('host.edit')}
          </Btn>
          <Btn variant="ghost" size="icon-sm">
            <EllipsisVerticalIcon aria-hidden="true" />
          </Btn>
        </span>
      </Panel>
    </span>
  )
}

function EditorFigure() {
  const { t } = useTranslation()
  return (
    <span className="flex w-full max-w-96 flex-col gap-3">
      <Panel className="flex-row flex-wrap items-center gap-2">
        <span className="min-w-0 basis-full truncate font-extrabold">{t('help.figures.quizTitle')}</span>
        <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-bold text-success-foreground">
          <CheckIcon className="size-3.5" aria-hidden="true" />
          {t('editor.status.saved')}
        </span>
        <Btn variant="ghost" size="icon-sm">
          <Settings2Icon aria-hidden="true" />
        </Btn>
        <Btn>
          <PlayIcon aria-hidden="true" />
          {t('host.play')}
        </Btn>
      </Panel>
      <Panel className="flex-row items-center gap-2">
        <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-sm font-black">1</span>
        <CircleDotIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t('help.figures.answering.question')}</span>
        <Switch />
      </Panel>
      <Btn variant="outline" className="self-start">
        <PlusIcon aria-hidden="true" />
        {t('editor.addQuestion')}
      </Btn>
    </span>
  )
}

function GameSettingsFigure() {
  const { t } = useTranslation()
  return (
    <span className="flex w-full max-w-80 flex-col gap-2">
      {(['flow', 'look', 'scoring'] as const).map((group) => {
        const Icon = sectionIcons[group]
        const open = group === 'scoring'
        return (
          <Panel key={group} className={cn('gap-2 py-2.5', open && 'border-primary')}>
            <span className="flex items-center gap-2 font-extrabold">
              <Icon className="size-5 text-primary" />
              <span className="flex-1">{t(`host.batch.groups.${group}`)}</span>
              {open && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">{t('host.create.changedForGame')}</span>}
            </span>
            {open &&
              (['speedBonus', 'streakBonus'] as const).map((key) => (
                <span key={key} className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {t(`host.create.${key}`)}
                  <Switch />
                </span>
              ))}
          </Panel>
        )
      })}
    </span>
  )
}

function StartingFigure() {
  const { t } = useTranslation()
  return (
    <Panel className="max-w-80">
      <span className="flex items-center gap-3">
        <span className="flex flex-1 flex-col">
          <span className="text-xs font-bold text-muted-foreground">{t('screen.pin')}</span>
          <span className="text-3xl font-black tracking-wider tabular-nums">123 456</span>
        </span>
        <span className="grid size-14 place-items-center rounded-xl bg-white text-black">
          <QrCodeIcon className="size-10" aria-hidden="true" />
        </span>
      </span>
      <Btn variant="outline" className="w-full">
        <MonitorIcon aria-hidden="true" />
        {t('host.game.openProjector')}
      </Btn>
      <span className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <LockIcon className="size-4" aria-hidden="true" />
          {t('host.game.lockJoining')}
        </span>
        <Switch />
      </span>
      <span className="flex flex-wrap gap-1.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className="inline-flex items-center gap-1.5 rounded-xl border bg-background py-1 pr-2.5 pl-1 text-xs font-bold">
            <Avatar n={n} />
            {t('help.figures.player', { n })}
          </span>
        ))}
      </span>
      <Btn size="lg" className="w-full">
        <PlayIcon aria-hidden="true" />
        {t('host.game.start')}
      </Btn>
    </Panel>
  )
}

function RunningFigure() {
  const { t } = useTranslation()
  const tiles: (number | null)[] = [0, 2, null, 1]
  return (
    <span className="flex w-full max-w-96 flex-col gap-3">
      <Panel className="@container gap-2">
        <Btn size="lg" className="w-full">
          {t('host.game.endQuestion')}
        </Btn>
        {/* As in the app: the icons go when the bar is narrow, so the labels keep to one row. */}
        <span className="flex gap-2 [&>span]:min-w-0 @max-xs:[&_svg]:hidden">
          <Btn variant="secondary" className="flex-1 px-2">
            <PauseIcon aria-hidden="true" />
            {t('host.game.pause')}
          </Btn>
          <Btn variant="secondary" className="flex-1 px-2">
            <AlarmClockPlusIcon aria-hidden="true" />
            {t('host.game.extend')}
          </Btn>
          <Btn variant="secondary" className="flex-1 px-2">
            <SkipForwardIcon aria-hidden="true" />
            {t('host.game.skip')}
          </Btn>
        </span>
      </Panel>
      <span className="grid grid-cols-2 gap-2">
        {tiles.map((pick, index) => (
          <span key={index} className="flex items-center gap-2 rounded-xl border bg-card p-2 shadow-soft">
            <Avatar n={index + 1} />
            <span className="min-w-0 flex-1 truncate text-xs font-bold">{t('help.figures.player', { n: index + 1 })}</span>
            {pick === null ? (
              <HourglassIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <span style={optionVars(pick)} className={cn(optionFill, 'grid size-6 place-items-center rounded-md')}>
                <ShapeIcon index={pick} className="size-3.5" />
              </span>
            )}
          </span>
        ))}
      </span>
      <Btn variant="outline" className="self-end">
        {t('host.game.end')}
      </Btn>
    </span>
  )
}

function ResultsFigure() {
  const { t } = useTranslation()
  const podium = [
    { rank: 2, height: 'h-14', medal: 'bg-slate-300 text-black' },
    { rank: 1, height: 'h-20', medal: 'bg-yellow-400 text-black' },
    { rank: 3, height: 'h-10', medal: 'bg-orange-400 text-black' },
  ]
  return (
    <Panel className="max-w-80 items-center">
      <span className="flex items-end gap-2">
        {podium.map((place) => (
          <span key={place.rank} className="flex w-20 flex-col items-center gap-1">
            {place.rank === 1 && <TrophyIcon className="size-5 text-warning" aria-hidden="true" />}
            <span className="w-full truncate text-center text-xs font-bold">{t('help.figures.player', { n: place.rank })}</span>
            <span className={cn('grid w-full place-items-start justify-center rounded-t-xl bg-primary/15 pt-1.5', place.height)}>
              <span className={cn('grid size-7 place-items-center rounded-full text-sm font-black', place.medal)}>{place.rank}</span>
            </span>
          </span>
        ))}
      </span>
      <Btn variant="secondary">
        <FileDownIcon aria-hidden="true" />
        {t('results.exportCsv')}
      </Btn>
    </Panel>
  )
}

function SettingsFigure() {
  const { t } = useTranslation()
  return (
    <span className="grid w-full max-w-80 grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
      {(['games', 'messages', 'branding', 'account'] as const).map((tab, index) => {
        const Icon = settingsTabIcons[tab]
        return (
          <span
            key={tab}
            className={cn('flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-bold', index === 0 ? 'bg-card shadow-soft' : 'text-muted-foreground')}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {t(`settings.tabs.${tab}`)}
          </span>
        )
      })}
    </span>
  )
}

/** Each section's picture, by section id. A section without one shows its points only. */
export const helpFigures: Record<string, ComponentType> = {
  joining: JoinFigure,
  answering: AnsweringFigure,
  points: PointsFigure,
  teams: TeamsFigure,
  connection: ConnectionFigure,
  'host-start': HostStartFigure,
  quizzes: QuizzesFigure,
  editor: EditorFigure,
  'game-settings': GameSettingsFigure,
  starting: StartingFigure,
  running: RunningFigure,
  results: ResultsFigure,
  settings: SettingsFigure,
}

/** A section's picture with its caption (`help.sections.<id>.figure`). */
export function HelpFigure({ id }: { id: string }) {
  const { t } = useTranslation()
  const Figure = helpFigures[id]
  if (!Figure) return null
  return (
    <figure className="flex flex-col items-center gap-2.5 self-start rounded-2xl bg-muted/60 p-4">
      <div aria-hidden="true" inert data-palette="vivid" className="flex w-full justify-center">
        <Figure />
      </div>
      <figcaption className="text-center text-sm font-semibold text-muted-foreground">{t(`help.sections.${id}.figure`)}</figcaption>
    </figure>
  )
}
