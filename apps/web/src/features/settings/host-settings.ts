import type { HostSettings, QuickMessage } from '@quizmoo/shared'
import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

/** The logged-in host's own settings (My settings). */
export const hostSettingsQueryOptions = queryOptions({
  queryKey: ['hostSettings'],
  queryFn: async () => (await apiFetch<{ settings: HostSettings }>('/api/me/settings')).settings,
})

export async function saveHostSettings(settings: HostSettings): Promise<HostSettings> {
  return (await apiFetch<{ settings: HostSettings }>('/api/me/settings', { method: 'PUT', body: JSON.stringify(settings) })).settings
}

/** "Save to my messages": adds one message to the library and returns it with its id. */
export async function addToMyMessages(message: Omit<QuickMessage, 'id'>): Promise<QuickMessage> {
  return (await apiFetch<{ message: QuickMessage }>('/api/me/quick-messages', { method: 'POST', body: JSON.stringify(message) })).message
}

/** How long a quick message stays: until cleared (null), the common choices, or any 5 to 600 s. */
export const MESSAGE_DURATIONS = [null, 10, 30, 60] as const
