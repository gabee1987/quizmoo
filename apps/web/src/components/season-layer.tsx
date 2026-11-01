import { lazy, Suspense } from 'react'
import type { Density } from '@/features/season/season-decor'
import { useActiveSeason } from '@/lib/season'

const SeasonDecor = lazy(() => import('@/features/season/season-decor').then((m) => ({ default: m.SeasonDecor })))

/**
 * The season's decorations behind the page, while this page shows a season (`useActiveSeason`).
 * The drawings are a separate chunk, loaded only then.
 */
export function SeasonLayer({ density }: { density: Density }) {
  const season = useActiveSeason()
  if (!season) return null
  return (
    <Suspense fallback={null}>
      <SeasonDecor season={season} density={density} />
    </Suspense>
  )
}
