import i18next from 'i18next'
import { toast } from 'sonner'
import { errorCode } from './api'

/** Translated error toast for a failed request where no form field is at fault. */
export function toastError(error: unknown) {
  const code = errorCode(error)
  // The code as id: the same failure repeated (e.g. autosave retries) shows one toast, not a stack.
  toast.error(i18next.t(code), { id: code })
}
