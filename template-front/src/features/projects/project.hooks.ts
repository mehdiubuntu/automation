import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/feedback/toast'
import { ApiError } from '@/lib/api/api-error'
import { projectsApi } from './project.api'
import type { CreateProjectInput, GetProjectsQuery, UpdateProjectInput } from './project.types'

export const PROJECTS_KEY = 'projects'

function onError(err: unknown) {
  toast.error(err instanceof ApiError ? err.message : 'Something went wrong')
}

export function useProjects(query: GetProjectsQuery) {
  return useQuery({
    queryKey: [PROJECTS_KEY, 'list', query],
    queryFn: () => projectsApi.list(query),
    placeholderData: keepPreviousData,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [PROJECTS_KEY, 'detail', id],
    queryFn: () => projectsApi.get(id),
    enabled: Boolean(id),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => {
      toast.success('Project created')
      void qc.invalidateQueries({ queryKey: [PROJECTS_KEY] })
    },
    onError,
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsApi.update(id, input),
    onSuccess: () => {
      toast.success('Project updated')
      void qc.invalidateQueries({ queryKey: [PROJECTS_KEY] })
    },
    onError,
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      toast.success('Project deleted')
      void qc.invalidateQueries({ queryKey: [PROJECTS_KEY] })
    },
    onError,
  })
}
