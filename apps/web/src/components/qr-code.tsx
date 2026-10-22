import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

/** Join QR code, as large as `className` allows: phones scan it from across a room. Always dark on white, in every mode and theme, so every camera reads it. */
export function QrCode({ value, className = '' }: { value: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`rounded-2xl bg-white p-4 ${className}`}>
      <QRCodeSVG value={value} size={512} marginSize={2} title={t('screen.qrCode')} className="block h-auto w-full" />
    </div>
  )
}
