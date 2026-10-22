import jsQR from 'jsqr'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pinFromScan } from '../lib/pin'

const SCAN_INTERVAL_MS = 150
const SCAN_WIDTH = 480

/**
 * Reads the projector's QR code with the phone's camera, in the app. Frames are decoded on the
 * device and never leave it. Loaded lazily from the join page (the decoder is 40 KB), and offered
 * only where the browser allows camera access (HTTPS or localhost).
 */
export default function QrScanner({ onResult, onClose }: { onResult: (pin: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  // The camera is opened once; the latest callback is read when a code is found.
  const report = useRef(onResult)
  report.current = onResult

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    let done = false
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    const scan = () => {
      const el = video.current
      if (!el || !context || el.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return
      const scale = Math.min(1, SCAN_WIDTH / el.videoWidth)
      canvas.width = Math.round(el.videoWidth * scale)
      canvas.height = Math.round(el.videoHeight * scale)
      context.drawImage(el, 0, 0, canvas.width, canvas.height)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
      const pin = code ? pinFromScan(code.data) : null
      if (pin && !done) {
        done = true
        report.current(pin)
      }
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        stream = s
        if (!video.current) return
        video.current.srcObject = s
        timer = setInterval(scan, SCAN_INTERVAL_MS)
      })
      .catch((err: unknown) => {
        setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'join.cameraDenied' : 'join.cameraUnavailable')
      })

    return () => {
      clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('join.scan')}</DialogTitle>
          <DialogDescription>{t('join.scanHint')}</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-foreground/90">
          {/* muted + playsInline: iOS Safari refuses to autoplay a camera stream otherwise. */}
          <video ref={video} autoPlay muted playsInline className="size-full object-cover" />
          <div
            aria-hidden="true"
            className="absolute inset-[12%] rounded-2xl border-4 border-primary-foreground/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]"
          />
          {error && (
            <p className="absolute inset-x-4 bottom-4 rounded-xl bg-card px-4 py-3 text-center font-semibold text-foreground">{t(error)}</p>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
