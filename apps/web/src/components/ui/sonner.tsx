import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useMode } from '@/lib/mode'

/** Toasts in the app's colour mode and tokens. Mounted once in the root layout. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useMode()

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      // Every toast can be swiped away sideways, like the host's messages on the phones.
      swipeDirections={['left', 'right']}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
