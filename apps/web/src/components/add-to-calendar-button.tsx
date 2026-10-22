import { CalendarPlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { downloadIcs } from '@/lib/ics'

/** Saves a scheduled game as a calendar event (.ics) with its PIN and join link. */
export function AddToCalendarButton({
  pin,
  scheduledAt,
  quizTitle,
  joinUrl,
  variant = 'secondary',
}: {
  pin: string
  scheduledAt: number
  quizTitle: string
  joinUrl: string
  variant?: 'secondary' | 'outline'
}) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() =>
        downloadIcs(
          {
            uid: `${pin}-${scheduledAt}@quizmoo`,
            start: scheduledAt,
            title: t('calendar.summary', { title: quizTitle }),
            description: t('calendar.description', { pin, url: joinUrl }),
            url: joinUrl,
          },
          `quizmoo-${pin}`,
        )
      }
    >
      <CalendarPlusIcon aria-hidden="true" />
      {t('calendar.add')}
    </Button>
  )
}
