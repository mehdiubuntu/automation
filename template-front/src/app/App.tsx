import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useAuthBootstrap } from '@/features/auth/useAuthBootstrap'
import { FullscreenLoader } from '@/components/feedback/FullscreenLoader'
import { router } from './router'

export function App() {
  const { ready } = useAuthBootstrap()

  // Hold the app until the session check resolves, so guards don't flicker.
  if (!ready) return <FullscreenLoader label="Starting…" />

  return (
    <Suspense fallback={<FullscreenLoader />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
