import {
  ClockIcon,
  EllipsisVerticalIcon,
  EyeOffIcon,
  FileDownIcon,
  FlagIcon,
  FlameIcon,
  GamepadIcon,
  GiftIcon,
  GripVerticalIcon,
  HeartIcon,
  HistoryIcon,
  HourglassIcon,
  ImageIcon,
  KeyboardIcon,
  KeyRoundIcon,
  LibraryIcon,
  Link2Icon,
  Share2Icon,
  LayersIcon,
  LayoutGridIcon,
  ListChecksIcon,
  LockIcon,
  LogOutIcon,
  MegaphoneIcon,
  MonitorIcon,
  MousePointerClickIcon,
  PaletteIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PresentationIcon,
  QrCodeIcon,
  RotateCwIcon,
  RouteIcon,
  SaveIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  SmileIcon,
  SpellCheckIcon,
  TableIcon,
  TagIcon,
  ToggleRightIcon,
  TrophyIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon,
  UsersRoundIcon,
  VoteIcon,
  CrownIcon,
  CheckIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react'
import { typeIcons } from '@/features/editor/type-picker'

/**
 * The help page's structure: groups, sections, the icon of each point and where in the app a
 * section's links lead. The texts are in the dictionaries under `help.sections.<section>`
 * (`heading`, optional `paragraphs`, `items.<item>.term` / `.text`); a point whose term is a label
 * the app already has (`termKey`) has only its text there, so the help names it exactly as the app
 * does. The section ids are anchors: the tours' last bubbles link to them (`tours.ts`).
 */

export type HelpLinkTarget = '/' | '/host/quizzes' | '/host/library' | '/host/games' | '/host/settings' | '/host/users' | '/host/nicknames'

export interface HelpItem {
  id: string
  icon: LucideIcon
  /** The term is this existing app label instead of `items.<id>.term`. */
  termKey?: string
}

export interface HelpLink {
  to: HelpLinkTarget
  hash?: string
  /** Under `help.links`. */
  label: string
}

export interface HelpSectionDef {
  id: string
  items: HelpItem[]
  links?: HelpLink[]
}

export interface HelpGroupDef {
  id: 'players' | 'hosts'
  icon: LucideIcon
  sections: HelpSectionDef[]
}

const quizzesLink: HelpLink = { to: '/host/quizzes', label: 'quizzes' }
const gamesLink: HelpLink = { to: '/host/games', label: 'games' }

export const helpGroups: HelpGroupDef[] = [
  {
    id: 'players',
    icon: GamepadIcon,
    sections: [
      {
        id: 'joining',
        items: [
          { id: 'pin', icon: QrCodeIcon },
          { id: 'name', icon: SmileIcon },
          { id: 'team', icon: UsersIcon },
          { id: 'wait', icon: HourglassIcon },
          { id: 'who', icon: UsersRoundIcon },
          { id: 'react', icon: HeartIcon },
        ],
        links: [{ to: '/', label: 'join' }],
      },
      {
        id: 'answering',
        items: (['single', 'multiple', 'truefalse', 'text', 'number', 'order', 'poll'] as const).map((type) => ({
          id: type,
          icon: typeIcons[type],
          termKey: `questionTypes.${type}`,
        })),
      },
      {
        id: 'points',
        items: [
          { id: 'right', icon: CheckIcon },
          { id: 'speed', icon: ZapIcon, termKey: 'host.create.speedBonus' },
          { id: 'streak', icon: FlameIcon, termKey: 'host.create.streakBonus' },
        ],
      },
      {
        id: 'teams',
        items: [
          { id: 'captain', icon: CrownIcon, termKey: 'host.create.teamAnswerOptions.captain' },
          { id: 'majority', icon: VoteIcon, termKey: 'host.create.teamAnswerOptions.majority' },
          { id: 'average', icon: UsersIcon, termKey: 'host.create.teamAnswerOptions.average' },
        ],
      },
      {
        id: 'connection',
        items: [
          { id: 'back', icon: RotateCwIcon },
          { id: 'leave', icon: LogOutIcon, termKey: 'play.leave.action' },
        ],
      },
    ],
  },
  {
    id: 'hosts',
    icon: PresentationIcon,
    sections: [
      {
        id: 'host-start',
        items: [
          { id: 'devices', icon: MonitorIcon },
          { id: 'starter', icon: GiftIcon, termKey: 'host.starter.add' },
        ],
        links: [quizzesLink],
      },
      {
        id: 'quizzes',
        items: [
          { id: 'new', icon: PlusIcon, termKey: 'host.newQuiz' },
          { id: 'import', icon: UploadIcon, termKey: 'quizFile.import' },
          { id: 'play', icon: PlayIcon, termKey: 'host.play' },
          { id: 'more', icon: EllipsisVerticalIcon },
          { id: 'select', icon: ListChecksIcon, termKey: 'host.select' },
        ],
        links: [quizzesLink],
      },
      {
        id: 'editor',
        items: [
          { id: 'saving', icon: SaveIcon },
          { id: 'add', icon: PlusIcon, termKey: 'editor.addQuestion' },
          { id: 'order', icon: GripVerticalIcon },
          { id: 'off', icon: ToggleRightIcon, termKey: 'editor.inGame.label' },
          { id: 'rounds', icon: LayersIcon },
          { id: 'preview', icon: SmartphoneIcon },
          { id: 'keys', icon: KeyboardIcon },
        ],
        links: [quizzesLink],
      },
      {
        id: 'library',
        items: [
          { id: 'library', icon: LibraryIcon, termKey: 'bank.title' },
          { id: 'linked', icon: Link2Icon },
          { id: 'select', icon: ListChecksIcon, termKey: 'editor.select.start' },
          { id: 'share', icon: Share2Icon },
          { id: 'enterCode', icon: KeyRoundIcon, termKey: 'share.enter.open' },
        ],
        links: [{ to: '/host/library', label: 'library' }],
      },
      {
        id: 'game-settings',
        items: [
          { id: 'flow', icon: RouteIcon, termKey: 'host.batch.groups.flow' },
          { id: 'look', icon: PaletteIcon, termKey: 'host.batch.groups.look' },
          { id: 'scoring', icon: TrophyIcon, termKey: 'host.batch.groups.scoring' },
          { id: 'branding', icon: ImageIcon, termKey: 'settings.tabs.branding' },
        ],
        links: [{ to: '/host/settings', label: 'settings' }],
      },
      {
        id: 'starting',
        items: [
          { id: 'play', icon: PlayIcon },
          { id: 'projector', icon: MonitorIcon, termKey: 'host.game.openProjector' },
          { id: 'players', icon: UsersIcon },
          { id: 'lock', icon: LockIcon, termKey: 'host.game.lockJoining' },
        ],
        links: [quizzesLink],
      },
      {
        id: 'running',
        items: [
          { id: 'primary', icon: MousePointerClickIcon },
          { id: 'question', icon: PauseIcon },
          { id: 'board', icon: LayoutGridIcon },
          { id: 'hide', icon: EyeOffIcon, termKey: 'host.board.hideAnswers' },
          { id: 'message', icon: MegaphoneIcon },
          { id: 'reactions', icon: HeartIcon, termKey: 'reactions.mute' },
          { id: 'grading', icon: SpellCheckIcon },
          { id: 'lock', icon: LockIcon, termKey: 'host.lock.button' },
          { id: 'keys', icon: KeyboardIcon },
          { id: 'end', icon: FlagIcon, termKey: 'host.game.end' },
        ],
        links: [gamesLink],
      },
      {
        id: 'results',
        items: [
          { id: 'summary', icon: TrophyIcon },
          { id: 'tabs', icon: TableIcon },
          { id: 'export', icon: FileDownIcon, termKey: 'results.exportCsv' },
          { id: 'history', icon: HistoryIcon, termKey: 'nav.games' },
          { id: 'kept', icon: ClockIcon },
        ],
        links: [gamesLink],
      },
      {
        id: 'settings',
        items: [
          { id: 'games', icon: SlidersHorizontalIcon, termKey: 'settings.tabs.games' },
          { id: 'messages', icon: MegaphoneIcon, termKey: 'settings.tabs.messages' },
          { id: 'branding', icon: ImageIcon, termKey: 'settings.tabs.branding' },
          { id: 'account', icon: UserRoundIcon, termKey: 'settings.tabs.account' },
        ],
        links: [
          { to: '/host/settings', label: 'settings' },
          { to: '/host/settings', hash: 'account', label: 'tours' },
        ],
      },
      {
        id: 'admin',
        items: [
          { id: 'users', icon: UsersRoundIcon, termKey: 'users.title' },
          { id: 'names', icon: TagIcon, termKey: 'nicknames.nav' },
        ],
        links: [
          { to: '/host/users', label: 'users' },
          { to: '/host/nicknames', label: 'names' },
        ],
      },
    ],
  },
]

/** The FAQ's groups, in order; the questions are `help.faq.groups.<id>.items`. */
export const faqGroups = [
  { id: 'playing', icon: GamepadIcon },
  { id: 'hosting', icon: PresentationIcon },
  { id: 'privacy', icon: ShieldCheckIcon },
] as const
