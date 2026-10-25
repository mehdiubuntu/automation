import { QueryClient, keepPreviousData } from '@tanstack/react-query'
import { ApiError } from './api-error'

/**
 * Module-singleton QueryClient (the old front created one per render).
 * Defaults tuned for an admin panel: don't hammer refetch, don't retry auth/client
 * errors, keep data warm for a minute.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // When a query key changes (search/filter/page), keep showing the previous
      // result until the new one arrives instead of dropping to the loading
      // skeleton. Skeletons then only appear on a genuine first load; pages can
      // read `isPlaceholderData` to dim stale content while the swap is in flight.
      placeholderData: keepPreviousData,
      retry: (failureCount, error) => {
        // Never retry 4xx (auth, validation, not-found) — only transient errors.
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})
