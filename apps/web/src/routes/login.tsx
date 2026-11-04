import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

// Hosts log in on the front page's Host tab; this address stays for old links and bookmarks.
export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/', search: { side: 'host', redirect: search.redirect }, replace: true })
  },
})
