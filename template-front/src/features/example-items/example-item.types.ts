import type { PaginationParams } from '@/lib/api/types'

/** Project-scoped entity: every item belongs to exactly one project. */
export interface ExampleItem {
  id: string
  projectId: string
  name: string
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateExampleItemInput {
  /** Required on create; comes from the route (`useProjectId()`), never from user input. */
  projectId: string
  name: string
  description?: string
  isActive?: boolean
}

/** projectId cannot be changed after creation. */
export type UpdateExampleItemInput = Partial<Omit<CreateExampleItemInput, 'projectId'>>

export interface GetExampleItemsQuery extends PaginationParams {
  /** Required: lists are always scoped to one project. */
  projectId: string
  name?: string
  isActive?: boolean
}
