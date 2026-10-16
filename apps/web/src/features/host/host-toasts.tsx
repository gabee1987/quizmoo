import type { HostSnapshot, PlayerPublic } from '@quizmoo/shared'
import { BellIcon, BellOffIcon } from 'lucide-react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import i18next from 'i18next'
import { Button } from '@/components/ui/button'
import { playerEvents, playerToasts, type PlayerEvent } from './player-events'

const STORAGE_KEY = 'quizmoo.hostToasts'
/** Events within this time become one toast per kind, so 50 joins show a few toasts, not 50. */
const BATCH_MS = 1500

// Muted per browser, a convenience for this host's device only.
let muted = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off'
  } catch {
    return false
  }
})()
const listeners = new Set<() => void>()

function setMuted(next: boolean) {
  muted = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, 'off')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage may be unavailable in private mode
  }
  listeners.forEach((listener) => listener())
}

function useMuted() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => muted,
  )
}

/**
 * Toasts on the host control for players joining, going offline, coming back, leaving or being
 * removed, derived from the changes between snapshots. The first snapshot of a game shows nothing.
 */
export function useHostToasts(host: HostSnapshot | null) {
  const previous = useRef<{ pin: string; players: readonly PlayerPublic[] } | null>(null)
  const pending = useRef<PlayerEvent[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!host) return
    const before = previous.current
    previous.current = { pin: host.pin, players: host.players }
    if (before?.pin !== host.pin || muted) return
    const events = playerEvents(before.players, host.players)
    if (events.length === 0) return
    pending.current.push(...events)
    timer.current ??= setTimeout(() => {
      timer.current = null
      const batch = pending.current
      pending.current = []
      if (muted) return
      for (const item of playerToasts(batch)) {
        const text = i18next.t(`host.game.toasts.${item.kind}`, { name: item.name, count: item.count })
        // One toast per kind: the next batch replaces it instead of stacking.
        const options = { id: `host-${item.kind}`, duration: 4000 }
        if (item.kind === 'joined' || item.kind === 'back') toast.success(text, options)
        else toast.info(text, options)
      }
    }, BATCH_MS)
  }, [host])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
}

/** Turns the player toasts off and on for this browser. */
export function HostToastsToggle() {
  const { t } = useTranslation()
  const off = useMuted()
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="size-7 rounded-full text-muted-foreground"
      aria-label={t('host.game.toasts.label')}
      aria-pressed={!off}
      title={off ? t('host.game.toasts.off') : t('host.game.toasts.on')}
      onClick={() => setMuted(!off)}
    >
      {off ? <BellOffIcon className="size-4" aria-hidden="true" /> : <BellIcon className="size-4" aria-hidden="true" />}
    </Button>
  )
}
