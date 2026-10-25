import { Project } from '@domain/project/aggregate/project.aggregate'
import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'

export const PROJECT_REPOSITORY_TOKEN = Symbol('PROJECT_REPOSITORY_TOKEN')

/** All reads exclude soft-deleted rows. */
export interface IProjectRepository {
  insertOne(entity: Project): Promise<Project>
  findById(id: string): Promise<Project | null>
  findByName(name: string): Promise<Project | null>
  findByCode(code: string): Promise<Project | null>
  findProjects(query: { limit?: number; page?: number; order?: OrderDirectionEnum; search?: string; isActive?: boolean }): Promise<IPaginatedResponse<Project>>
  updateById(id: string, entity: Project): Promise<Project | null>
  /** Soft delete (sets deletedAt) - returns whether a row was removed. */
  softDeleteById(id: string): Promise<boolean>
}
