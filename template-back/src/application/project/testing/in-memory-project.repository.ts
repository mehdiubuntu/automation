import { fakeId } from '@application/shared/testing/fake-id'
import { Project } from '@domain/project/aggregate/project.aggregate'
import { IProjectRepository } from '@domain/project/repository/project.repository'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'

export class InMemoryProjectRepository implements IProjectRepository {
  rows: Array<{ project: Project; deleted: boolean }> = []
  private nextId = 1

  private live() {
    return this.rows.filter((row) => !row.deleted).map((row) => row.project)
  }

  insertOne(entity: Project): Promise<Project> {
    const now = new Date()
    const saved = Project.restore(fakeId(this.nextId++), entity.name!, entity.code!, entity.description ?? null, entity.isActive ?? true, now, now)
    this.rows.push({ project: saved, deleted: false })
    return Promise.resolve(saved)
  }

  findById(id: string) {
    return Promise.resolve(this.live().find((project) => project.id === id) ?? null)
  }

  findByName(name: string) {
    return Promise.resolve(this.live().find((project) => project.name === name) ?? null)
  }

  findByCode(code: string) {
    return Promise.resolve(this.live().find((project) => project.code === code) ?? null)
  }

  findProjects(): Promise<IPaginatedResponse<Project>> {
    const data = this.live()
    return Promise.resolve({ data, meta: { itemsPerPage: 10, totalItems: data.length, currentPage: 1, totalPages: 1 } })
  }

  updateById(id: string, entity: Project) {
    const found = this.live().find((project) => project.id === id)
    if (!found) return Promise.resolve(null)
    if (entity.name !== undefined) found.name = entity.name
    if (entity.description !== undefined) found.description = entity.description
    if (entity.isActive !== undefined) found.isActive = entity.isActive
    return Promise.resolve(found)
  }

  softDeleteById(id: string) {
    const row = this.rows.find((r) => r.project.id === id && !r.deleted)
    if (row) row.deleted = true
    return Promise.resolve(!!row)
  }
}
