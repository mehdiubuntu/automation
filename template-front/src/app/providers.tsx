import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/api/query-client'
import { ToastViewport } from '@/components/feedback/toast'
import { MotionProvider } from '@/lib/motion/MotionProvider'

/** Single place for global providers. QueryClient is a module singleton. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Wraps the toast viewport too — toasts animate and need the features. */}
      <MotionProvider>
        {children}
        <ToastViewport />
      </MotionProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
