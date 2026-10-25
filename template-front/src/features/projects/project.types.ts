import type { PaginationParams } from '@/lib/api/types'

export interface Project {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  /** Optional short unique code; the server generates one when omitted. Immutable after creation. */
  code?: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  isActive?: boolean
}

export interface GetProjectsQuery extends PaginationParams {
  search?: string
  isActive?: boolean
}
