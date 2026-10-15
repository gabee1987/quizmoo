import { builtInMessages, type HostSettings, type NewQuickMessage, type OwnQuickMessage, type QuickMessage } from '@quizmoo/shared'
import { queryOptions } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { apiFetch } from '@/lib/api'
import { newId } from '../editor/draft'

/** The logged-in host's own settings (My settings). */
export const hostSettingsQueryOptions = queryOptions({
  queryKey: ['hostSettings'],
  queryFn: async () => (await apiFetch<{ settings: HostSettings }>('/api/me/settings')).settings,
})

export async function saveHostSettings(settings: HostSettings): Promise<HostSettings> {
  return (await apiFetch<{ settings: HostSettings }>('/api/me/settings', { method: 'PUT', body: JSON.stringify(settings) })).settings
}

/** "Save to my messages": adds one message to the library and returns it with its id. */
export async function addToMyMessages(message: NewQuickMessage): Promise<OwnQuickMessage> {
  return (await apiFetch<{ message: OwnQuickMessage }>('/api/me/quick-messages', { method: 'POST', body: JSON.stringify(message) }))
    .message
}

/** How long a quick message stays: until cleared (null), the common choices, or any 5 to 600 s. */
export const MESSAGE_DURATIONS = [null, 10, 30, 60] as const

/** Typed seconds within the host message limits (5 to 600); 30 when it is not a number. */
export function clampSeconds(raw: string): number {
  const parsed = Math.round(Number(raw))
  return raw.trim() && Number.isFinite(parsed) ? Math.min(600, Math.max(5, parsed)) : 30
}

/** A quick message's text: built-in ones in the host's language, own ones as typed. */
export function messageText(message: QuickMessage, t: TFunction): string {
  return 'builtIn' in message ? t(`host.game.message.presets.${message.builtIn}`) : message.text
}

/** The list with every built-in message that is missing added back at the end (ids kept unique). */
export function restoreBuiltIns(messages: QuickMessage[]): QuickMessage[] {
  const ids = new Set(messages.map((m) => m.id))
  const missing = builtInMessages
    .filter((name) => !messages.some((m) => 'builtIn' in m && m.builtIn === name))
    .map((name): QuickMessage => ({ id: ids.has(name) ? newId() : name, builtIn: name, durationSec: null }))
  return [...messages, ...missing]
}
