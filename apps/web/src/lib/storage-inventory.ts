/**
 * Everything Quizmoo keeps in the browser, shown on the cookies page and behind the storage notice.
 * All of it is strictly necessary for something the visitor asked for (logging in, playing, their
 * own choices), so none of it needs consent under the ePrivacy rules. `storage-inventory.test.ts`
 * fails when the code uses a `quizmoo.*` key that is not listed here, so the page stays true.
 */
export interface StoredItem {
  /** The cookie or storage key; `<PIN>` stands for a game's PIN. */
  name: string
  kind: 'cookie' | 'localStorage' | 'sessionStorage' | 'cache'
  /** Who gets it. */
  who: 'hosts' | 'players' | 'everyone'
  /** i18n key under `legal.cookies.items.<id>` for its purpose and lifetime. */
  id: string
}

export const storedItems: readonly StoredItem[] = [
  { name: '__Host-quizmoo_session', kind: 'cookie', who: 'hosts', id: 'session' },
  { name: 'quizmoo.player.<PIN>', kind: 'localStorage', who: 'players', id: 'player' },
  { name: 'quizmoo.draft.<PIN>', kind: 'localStorage', who: 'players', id: 'draft' },
  { name: 'quizmoo.dismissed.<PIN>', kind: 'sessionStorage', who: 'players', id: 'dismissed' },
  { name: 'quizmoo.picksOpen.<PIN>', kind: 'sessionStorage', who: 'players', id: 'picksOpen' },
  { name: 'quizmoo.lang', kind: 'localStorage', who: 'everyone', id: 'lang' },
  { name: 'quizmoo.mode', kind: 'localStorage', who: 'everyone', id: 'mode' },
  { name: 'quizmoo.storageNotice', kind: 'localStorage', who: 'everyone', id: 'notice' },
  { name: 'quizmoo.hostToasts', kind: 'localStorage', who: 'hosts', id: 'hostToasts' },
  { name: 'quizmoo.hostBoard', kind: 'localStorage', who: 'hosts', id: 'hostBoard' },
  { name: 'quizmoo-*', kind: 'cache', who: 'everyone', id: 'appCache' },
]

/** The storage notice's own key: set once "Got it" is pressed. */
export const STORAGE_NOTICE_KEY = 'quizmoo.storageNotice'
