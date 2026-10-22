import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { emitAck } from '../../lib/socket'

const INTERVAL_MS = 10_000

/** Colour of a round-trip time: green on a good LAN, amber when slow, red when very slow or lost. */
export function roundTripTone(ms: number | null): 'good' | 'slow' | 'bad' {
  if (ms === null || ms >= 500) return 'bad'
  return ms < 150 ? 'good' : 'slow'
}

/** Round-trip time to the server, measured with `host:ping` every 10 s while connected. */
export function RoundTripBadge({ connected }: { connected: boolean }) {
  const { t } = useTranslation()
  const [ms, setMs] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    if (!connected) return
    let cancelled = false
    const measure = async () => {
      const started = performance.now()
      const res = await emitAck('host:ping', {})
      if (!cancelled) setMs('error' in res ? null : Math.round(performance.now() - started))
    }
    void measure()
    const timer = setInterval(() => void measure(), INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [connected])

  if (ms === undefined) return null
  const tone = roundTripTone(ms)
  const label = ms === null ? t('host.game.roundTripNone') : t('host.game.roundTrip', { ms })
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-bold tabular-nums"
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          tone === 'good' ? 'bg-success' : tone === 'slow' ? 'bg-warning' : 'bg-destructive',
        )}
      />
      {ms === null ? '–' : `${ms} ms`}
    </span>
  )
}
