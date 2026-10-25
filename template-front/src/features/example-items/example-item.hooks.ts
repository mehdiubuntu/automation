import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/feedback/toast'
import { ApiError } from '@/lib/api/api-error'
import { exampleItemsApi } from './example-item.api'
import type {
  CreateExampleItemInput,
  GetExampleItemsQuery,
  UpdateExampleItemInput,
} from './example-item.types'

const KEY = 'example-items'

/** The query carries `projectId`, so each project gets its own cache entry. */
export function useExampleItems(query: GetExampleItemsQuery) {
  return useQuery({
    queryKey: [KEY, query],
    queryFn: () => exampleItemsApi.list(query),
    placeholderData: keepPreviousData,
  })
}

function onError(err: unknown) {
  toast.error(err instanceof ApiError ? err.message : 'Something went wrong')
}

export function useCreateExampleItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateExampleItemInput) => exampleItemsApi.create(input),
    onSuccess: () => {
      toast.success('Item created')
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError,
  })
}

export function useUpdateExampleItem(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateExampleItemInput) => exampleItemsApi.update(id, input),
    onSuccess: () => {
      toast.success('Item updated')
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError,
  })
}

export function useDeleteExampleItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => exampleItemsApi.remove(id),
    onSuccess: () => {
      toast.success('Item deleted')
      void qc.invalidateQueries({ queryKey: [KEY] })
    },
    onError,
  })
}
