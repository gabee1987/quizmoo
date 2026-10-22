import type { PlayerSnapshot } from '@quizmoo/shared'
import { useNavigate } from '@tanstack/react-router'
import { Loader2Icon, RotateCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { getStoredPlayer, storePlayer } from '../../lib/player-storage'
import { emitAck } from '../../lib/socket'

/**
 * After "Play again": one tap joins the next round as a new player with the same name, avatar
 * and team, then the page follows to it.
 */
export function NextRound({ snapshot, pin }: { snapshot: PlayerSnapshot; pin: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nextPin = snapshot.nextPin
  if (!nextPin) return null

  async function join() {
    if (!nextPin) return
    setPending(true)
    setError(null)
    const avatar = getStoredPlayer(pin)?.avatar ?? snapshot.me.avatar
    const res = await emitAck('player:join', {
      pin: nextPin,
      name: snapshot.me.name,
      avatar,
      ...(snapshot.me.teamId ? { teamId: snapshot.me.teamId } : {}),
    })
    setPending(false)
    if ('error' in res) return setError(res.error)
    storePlayer(nextPin, { token: res.token, name: snapshot.me.name, avatar })
    void navigate({ to: '/play/$pin', params: { pin: nextPin } })
  }

  return (
    <div className="mb-4 flex animate-pop flex-col gap-3 rounded-[1.25rem] border-2 border-primary/35 bg-popover p-4 text-center font-extrabold shadow-[0_4px_0_color-mix(in_oklch,var(--primary)_30%,var(--border))]">
      <p className="text-lg">{t('play.nextRoundReady')}</p>
      {error && <FormAlert>{t(error)}</FormAlert>}
      <Button size="lg" disabled={pending} onClick={() => void join()}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <RotateCcwIcon aria-hidden="true" />}
        {t('play.joinNextRound')}
      </Button>
    </div>
  )
}
