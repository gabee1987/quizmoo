import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { shortcutKeys, type EditorShortcut } from './shortcuts'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

/** The editor's keyboard shortcuts, opened with "?". */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editor.shortcuts.title')}</DialogTitle>
          <DialogDescription>{t('editor.shortcuts.help')}</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-2">
          {(Object.keys(shortcutKeys) as EditorShortcut[]).map((shortcut) => (
            <div key={shortcut} className="flex min-h-10 items-center justify-between gap-4">
              <dt>{t(`editor.shortcuts.${shortcut}`)}</dt>
              <dd className="flex shrink-0 gap-1">
                {shortcutKeys[shortcut].map((key) => (
                  <kbd
                    key={key}
                    className="min-w-8 rounded-md border border-b-[3px] bg-muted px-2 py-0.5 text-center font-mono text-sm font-bold"
                  >
                    {key === 'mod' ? (isMac ? '⌘' : 'Ctrl') : key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
