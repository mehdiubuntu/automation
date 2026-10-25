import { api } from '@/lib/api/client'
import type { Paginated } from '@/lib/api/types'
import type { CreateProjectInput, GetProjectsQuery, Project, UpdateProjectInput } from './project.types'

export const projectsApi = {
  list(query: GetProjectsQuery) {
    return api.get<Paginated<Project>>('/project/get-projects', { params: query })
  },
  get(id: string) {
    return api.get<Project>(`/project/get-project/${id}`)
  },
  create(input: CreateProjectInput) {
    return api.post<Project>('/project/create-project', input)
  },
  update(id: string, input: UpdateProjectInput) {
    return api.put<Project>(`/project/update-project/${id}`, input)
  },
  remove(id: string) {
    return api.delete<unknown>(`/project/delete-project/${id}`)
  },
}
