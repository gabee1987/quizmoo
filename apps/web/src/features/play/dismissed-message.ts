import type { Announcement } from '@quizmoo/shared'
import { useState } from 'react'

// The host message the player swiped away, per game in this tab, so a reload does not bring it back.
// A per-viewer convenience; without storage the message just shows again after a reload.

const key = (pin: string) => `quizmoo.dismissed.${pin}`

export function storedDismissed(pin: string): string | null {
  try {
    return sessionStorage.getItem(key(pin))
  } catch {
    return null
  }
}

export function storeDismissed(pin: string, id: string) {
  try {
    sessionStorage.setItem(key(pin), id)
  } catch {
    // ignore
  }
}

/** The message to show (null once the player hid it) and how to hide it; important messages cannot be hidden. */
export function useDismissable(
  pin: string,
  announcement: Announcement | null,
): { shown: Announcement | null; dismiss: (() => void) | undefined } {
  const [dismissed, setDismissed] = useState(() => storedDismissed(pin))
  if (!announcement) return { shown: null, dismiss: undefined }
  if (announcement.important) return { shown: announcement, dismiss: undefined }
  if (announcement.id === dismissed) return { shown: null, dismiss: undefined }
  return {
    shown: announcement,
    dismiss: () => {
      setDismissed(announcement.id)
      storeDismissed(pin, announcement.id)
    },
  }
}
