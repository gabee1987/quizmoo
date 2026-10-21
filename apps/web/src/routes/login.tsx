import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { FloatingShapes } from '@/components/floating-shapes'
import { HomeHero } from '@/components/home-hero'
import { LegalLinks } from '@/components/legal-links'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/login-form'
import { useSiteInfo } from '../lib/site'

export const Route = createFileRoute('/login')({
  // The host page that sent a logged-out visitor here (e.g. the Users page from a sign-up e-mail).
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const { redirect } = Route.useSearch()
  const site = useSiteInfo()

  return (
    <div className="mx-auto grid w-full max-w-sm flex-1 content-center gap-7 lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16">
      <FloatingShapes />
      <HomeHero tagline={t('home.tagline')} />
      <div className="flex w-full flex-col gap-5 lg:max-w-sm lg:justify-self-center">
        <Card className="animate-pop">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              <h2>{t('auth.title')}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm redirect={redirect} />
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link to="/" className={footerLink}>
            {t('home.joinLink')}
          </Link>
          {site.data?.registrationOpen && (
            <Link to="/register" className={footerLink}>
              {t('auth.register.link')}
            </Link>
          )}
        </div>
        <LegalLinks />
      </div>
    </div>
  )
}

const footerLink =
  'rounded-md text-sm font-semibold text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring'
