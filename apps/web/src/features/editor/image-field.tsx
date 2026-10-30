import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { ImageUpIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { apiFetch, apiUpload, errorCode } from '../../lib/api'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
const FORMATS: Record<string, string> = { 'image/webp': 'WebP', 'image/jpeg': 'JPEG', 'image/png': 'PNG' }

interface ImageInfo {
  width: number
  height: number
  bytes: number
  mime: string
}

/** Pixel size, file size and format in the page's language, and all three in one line ("1280 × 720 px · 84 kB · WebP"). */
function imageDetails(info: ImageInfo, language: string, t: TFunction) {
  const mb = info.bytes >= 1024 * 1024
  const size = new Intl.NumberFormat(language, {
    style: 'unit',
    unit: mb ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: mb ? 1 : 0,
  }).format(mb ? info.bytes / 1024 / 1024 : Math.max(1, Math.round(info.bytes / 1024)))
  const parts = {
    pixels: t('editor.imagePixelsValue', { width: info.width, height: info.height }),
    size,
    format: FORMATS[info.mime] ?? info.mime.replace('image/', '').toUpperCase(),
  }
  return { ...parts, line: t('editor.imageDetails', { ...parts }) }
}

/** The image in a paste, unless the clipboard also holds text (then the paste belongs to a text field). */
function pastedImage(data: DataTransfer | null): File | null {
  if (!data || data.types.includes('text/plain')) return null
  return Array.from(data.files).find((f) => f.type.startsWith('image/')) ?? null
}

/**
 * Picks, drops or pastes an image and uploads it straight away with a progress bar.
 * Shows a thumbnail with replace and remove; the phone preview shows how it fits.
 * With `pasteAnywhere` (the question image), pasting a screenshot anywhere on the page uploads
 * it here unless a focused option image field takes it; otherwise paste works while the field has focus.
 */
export function ImageField({
  imageId,
  onChange,
  label,
  compact = false,
  pasteAnywhere = false,
  showLabel = true,
}: {
  imageId: string | undefined
  onChange: (imageId: string | undefined) => void
  label: string
  compact?: boolean
  pasteAnywhere?: boolean
  /** The label as the picture card's heading; off where the page already shows it above the field. */
  showLabel?: boolean
}) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const queryClient = useQueryClient()
  // Ids never change their bytes, so the details are fetched once; another host's image (a copied quiz) gives none.
  const info = useQuery({
    queryKey: ['imageInfo', imageId],
    queryFn: () => apiFetch<ImageInfo>(`/api/images/${imageId}/info`),
    enabled: !!imageId,
    staleTime: Infinity,
    retry: false,
  }).data
  const details = info ? imageDetails(info, i18n.language, t) : undefined
  const [progress, setProgress] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  async function upload(file: File) {
    if (!ACCEPT.includes(file.type)) return void toast.error(t('errors.unsupportedImage'))
    if (file.size > MAX_BYTES) return void toast.error(t('errors.fileTooLarge'))
    setProgress(0)
    try {
      const body = new FormData()
      body.append('file', file)
      const { id: imageId, ...info } = await apiUpload<{ id: string } & ImageInfo>('/api/images', body, setProgress)
      queryClient.setQueryData(['imageInfo', imageId], info)
      onChangeRef.current(imageId)
    } catch (err) {
      toast.error(t(errorCode(err)))
    } finally {
      setProgress(null)
    }
  }
  const uploadRef = useRef(upload)
  uploadRef.current = upload

  useEffect(() => {
    if (!pasteAnywhere) return
    const onPaste = (e: globalThis.ClipboardEvent) => {
      // Handled already by a focused image field (an option's).
      if (e.defaultPrevented) return
      const file = pastedImage(e.clipboardData)
      if (!file) return
      e.preventDefault()
      void uploadRef.current(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [pasteAnywhere])

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      setDragOver(true)
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) void upload(file)
    },
    onPaste: (e: ClipboardEvent) => {
      const file = pastedImage(e.clipboardData)
      if (!file) return
      e.preventDefault()
      void upload(file)
    },
  }
  const uploading = progress !== null
  const fileInput = (
    <input
      id={id}
      type="file"
      accept={ACCEPT.join(',')}
      className="peer sr-only"
      aria-label={imageId ? t('editor.replaceImage') : label}
      disabled={uploading}
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void upload(file)
      }}
    />
  )
  const bar = uploading && (
    <Progress value={Math.round(progress * 100)} aria-label={t('editor.uploading')} className={compact ? 'w-16' : 'w-36'} />
  )

  if (imageId && !compact) {
    const stats = details && [
      { label: t('editor.imagePixels'), value: details.pixels },
      { label: t('editor.imageFileSize'), value: details.size },
      { label: t('editor.imageFormat'), value: details.format },
    ]
    return (
      <div
        {...dropProps}
        className={cn('flex flex-col gap-4 rounded-2xl border p-3 sm:flex-row', dragOver && 'border-primary ring-[3px] ring-ring')}
      >
        <img
          src={`/api/images/${imageId}`}
          alt={label}
          className="aspect-video w-full shrink-0 self-start rounded-xl border bg-muted object-contain sm:w-64"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            {showLabel && <p className="font-extrabold">{label}</p>}
            <p className="text-sm text-muted-foreground">{t('editor.imageDetailsHelp')}</p>
          </div>
          {stats && (
            <dl className="flex flex-wrap gap-2">
              {stats.map((s) => (
                <div key={s.label} className="flex-auto rounded-xl bg-muted px-3 py-2 whitespace-nowrap">
                  <dt className="text-xs font-semibold text-muted-foreground">{s.label}</dt>
                  <dd className="font-bold tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {fileInput}
            <Button asChild variant="secondary" size="sm">
              <label htmlFor={id} className="cursor-pointer peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring">
                <ImageUpIcon aria-hidden="true" />
                {t('editor.replaceImage')}
              </label>
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => onChange(undefined)}>
              <Trash2Icon aria-hidden="true" />
              {t('editor.removeImage')}
            </Button>
            {bar}
          </div>
        </div>
      </div>
    )
  }

  if (imageId) {
    return (
      <div {...dropProps} className={cn('flex flex-wrap items-center gap-2 rounded-xl', dragOver && 'ring-[3px] ring-ring')}>
        <img
          src={`/api/images/${imageId}`}
          alt={label}
          title={details?.line}
          className="h-12 w-16 rounded-xl border bg-muted object-contain"
        />
        {bar}
        {fileInput}
        <label
          htmlFor={id}
          className="flex min-h-10 cursor-pointer items-center rounded-lg px-2 text-sm font-semibold underline underline-offset-4 peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring hover:bg-muted"
        >
          {t('editor.replaceImage')}
        </label>
        <button
          type="button"
          className="min-h-10 rounded-lg px-2 text-sm font-semibold text-destructive underline underline-offset-4 outline-none hover:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring"
          onClick={() => onChange(undefined)}
        >
          {t('editor.removeImage')}
        </button>
      </div>
    )
  }

  return (
    <div {...dropProps} className="flex flex-col gap-1">
      {/* Before its label so the label can show the input's keyboard focus (peer). */}
      {fileInput}
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-sm font-semibold text-muted-foreground transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring hover:border-ring hover:text-foreground',
          compact ? 'px-3' : 'flex-col px-4 py-3 text-center',
          dragOver && 'border-primary bg-secondary text-foreground',
        )}
      >
        {uploading ? (
          <>
            <span>{t('editor.uploading')}</span>
            {bar}
          </>
        ) : compact ? (
          t('editor.addImageShort')
        ) : (
          <>
            <ImageUpIcon className="size-6" aria-hidden="true" />
            <span>{t('editor.addImage')}</span>
            <span className="text-xs font-normal">{t('editor.addImageHint')}</span>
          </>
        )}
      </label>
    </div>
  )
}
