import type { HostSnapshot } from '@quizmoo/shared'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PhoneScreenPreview } from './phone-screen-preview'

/**
 * What everyone sees: the real projector page live, as a public projector shows it, scaled down in
 * an inert frame (it loads only while open), and the screen the phones get, drawn from the host's
 * snapshot.
 */
export function ScreenPreview({ host, clockOffset, defaultOpen }: { host: HostSnapshot; clockOffset: number; defaultOpen: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section aria-labelledby="preview-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h2 id="preview-title" className="text-lg font-extrabold">
          {t('host.preview.title')}
        </h2>
        <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          {open ? t('host.preview.close') : t('host.preview.open')}
        </Button>
      </div>
      {open && (
        <Tabs defaultValue="projector" className="flex flex-col gap-3">
          <TabsList className="self-start">
            <TabsTrigger value="projector">{t('host.preview.projector')}</TabsTrigger>
            <TabsTrigger value="phone">{t('host.preview.phone')}</TabsTrigger>
          </TabsList>
          <TabsContent value="projector">
            <ScaledFrame src={`/screen/${host.pin}?preview=1`} width={1920} height={1080} title={t('host.preview.projectorFrame')} />
          </TabsContent>
          <TabsContent value="phone">
            <PhoneScreenPreview host={host} clockOffset={clockOffset} />
          </TabsContent>
        </Tabs>
      )}
    </section>
  )
}

/** A page at its real size (`width` × `height` CSS pixels), scaled down to the box's width. */
function ScaledFrame({ src, width, height, title }: { src: string; width: number; height: number; title: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setScale((entry?.contentRect.width ?? 0) / width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-xl border bg-background" style={{ height: height * scale }}>
      {scale > 0 && (
        <iframe
          src={src}
          title={title}
          inert
          tabIndex={-1}
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
          style={{ width, height, transform: `scale(${scale})` }}
        />
      )}
    </div>
  )
}
