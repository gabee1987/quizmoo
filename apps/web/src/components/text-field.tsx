import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Labelled input with an optional error under it (wired up with aria-describedby).
 * A password field gets a button on its right that shows the characters.
 */
export function TextField({
  label,
  error,
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined }) {
  const { t } = useTranslation()
  const id = useId()
  const [shown, setShown] = useState(false)
  const password = type === 'password'
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={password && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('text-lg', password && 'pr-13')}
          {...props}
        />
        {password && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute inset-y-0 right-1 my-auto text-muted-foreground hover:text-foreground"
            aria-label={t('auth.showPassword')}
            aria-pressed={shown}
            aria-controls={id}
            onClick={() => setShown((s) => !s)}
          >
            {shown ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          </Button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
