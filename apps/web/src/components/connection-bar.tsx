import { WifiOffIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNow } from '../lib/clock'
import type { ConnectionStatus } from '../lib/socket'

/** A first connection usually takes a moment: the bar waits this long before saying "Connecting". */
const CONNECTING_GRACE_S = 1

/** Thin bar shown whenever the socket is not connected, with the time since the connection dropped. */
export function ConnectionBar({ status, since }: { status: ConnectionStatus; since: number }) {
  const { t } = useTranslation()
  const lost = status === 'connecting' || status === 'reconnecting' || status === 'offline'
  const now = useNow(lost)
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  if (!lost || (status === 'connecting' && seconds < CONNECTING_GRACE_S)) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-1.5 text-sm font-bold text-destructive-foreground tabular-nums"
    >
      <WifiOffIcon className="size-4" aria-hidden="true" />
      {status === 'connecting' ? t('connection.connecting') : t(`connection.${status}`, { seconds })}
    </div>
  )
}
