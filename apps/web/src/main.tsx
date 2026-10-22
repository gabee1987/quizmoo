import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import '@fontsource-variable/nunito'
import './i18n'
import { ApiError } from './lib/api'
import { meQueryOptions } from './lib/auth'
import './lib/mode'
import './styles.css'

// 423: the host's screens were locked (from another tab or device); the host layout then shows the lock screen.
const onLocked = (error: unknown) => {
  if (error instanceof ApiError && error.status === 423) void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
}
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onLocked }),
  mutationCache: new MutationCache({ onError: onLocked }),
})
const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Installable app (public/sw.js). Not in development: Vite serves unbundled modules there.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
