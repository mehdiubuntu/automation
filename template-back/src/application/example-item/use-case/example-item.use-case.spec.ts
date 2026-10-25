import { fakeId } from '@application/shared/testing/fake-id'
import { ExampleItemUseCase } from '@application/example-item/use-case/example-item.use-case'
import { InMemoryProjectRepository } from '@application/project/testing/in-memory-project.repository'
import { ExampleItem } from '@domain/example-item/aggregate/example-item.aggregate'
import { IExampleItemRepository } from '@domain/example-item/repository/example-item.repository'
import { Project } from '@domain/project/aggregate/project.aggregate'
import { GenericException } from '@domain/shared/error/base-http.exception'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'

class InMemoryExampleItemRepository implements IExampleItemRepository {
  rows: Array<{ item: ExampleItem; deleted: boolean }> = []
  private nextId = 1

  private live() {
    return this.rows.filter((row) => !row.deleted).map((row) => row.item)
  }

  insertOne(entity: ExampleItem): Promise<ExampleItem> {
    const saved = ExampleItem.restore(fakeId(this.nextId++), entity.projectId, entity.name, entity.description ?? null, entity.isActive)
    this.rows.push({ item: saved, deleted: false })
    return Promise.resolve(saved)
  }

  findById(id: string) {
    return Promise.resolve(this.live().find((item) => item.id === id) ?? null)
  }

  findByNameInProject(projectId: string, name: string) {
    return Promise.resolve(this.live().find((item) => item.projectId === projectId && item.name === name) ?? null)
  }

  findExampleItems(query: { projectId: string }): Promise<IPaginatedResponse<ExampleItem>> {
    const data = this.live().filter((item) => item.projectId === query.projectId)
    return Promise.resolve({ data, meta: { itemsPerPage: 10, totalItems: data.length, currentPage: 1, totalPages: 1 } })
  }

  updateById(id: string, entity: ExampleItem) {
    const found = this.live().find((item) => item.id === id)
    if (!found) return Promise.resolve(null)
    if (entity.name !== undefined) found.name = entity.name
    if (entity.description !== undefined) found.description = entity.description
    if (entity.isActive !== undefined) found.isActive = entity.isActive
    return Promise.resolve(found)
  }

  softDeleteById(id: string) {
    const row = this.rows.find((r) => r.item.id === id && !r.deleted)
    if (row) row.deleted = true
    return Promise.resolve(!!row)
  }
}

const passthroughUow: UnitOfWork = { execute: <T>(work: () => Promise<T>) => work() }

describe('ExampleItemUseCase', () => {
  let projects: InMemoryProjectRepository
  let repo: InMemoryExampleItemRepository
  let useCase: ExampleItemUseCase
  let alpha: Project
  let beta: Project

  beforeEach(async () => {
    projects = new InMemoryProjectRepository()
    repo = new InMemoryExampleItemRepository()
    useCase = new ExampleItemUseCase(repo, projects, passthroughUow)
    alpha = await projects.insertOne(Project.create({ name: 'Alpha', code: 'ALPHA', isActive: true }))
    beta = await projects.insertOne(Project.create({ name: 'Beta', code: 'BETA', isActive: true }))
  })

  it('creates an active item in the given project with a trimmed name', async () => {
    const item = await useCase.createExampleItem({ projectId: alpha.id!, name: '  Widget  ', description: ' first ' })

    expect(item).toMatchObject({ projectId: alpha.id, name: 'Widget', description: 'first', isActive: true })
  })

  it('requires the project to exist (404) and to be active (409)', async () => {
    await expect(useCase.createExampleItem({ projectId: fakeId(999), name: 'Widget' })).rejects.toMatchObject({ status: 404, errorCode: 'PROJECT_001' })

    await projects.updateById(alpha.id!, Project.create({ isActive: false }))
    await expect(useCase.createExampleItem({ projectId: alpha.id!, name: 'Widget' })).rejects.toMatchObject({ status: 409, errorCode: 'PROJECT_005' })
    await expect(useCase.getExampleItems({ projectId: alpha.id! })).rejects.toMatchObject({ status: 409, errorCode: 'PROJECT_005' })
    expect(repo.rows).toHaveLength(0)
  })

  it('does not accept a soft-deleted project', async () => {
    await projects.softDeleteById(alpha.id!)

    await expect(useCase.createExampleItem({ projectId: alpha.id!, name: 'Widget' })).rejects.toMatchObject({ status: 404 })
    await expect(useCase.getExampleItems({ projectId: alpha.id! })).rejects.toMatchObject({ status: 404 })
  })

  it('rejects a duplicate name inside the same project with 409 but allows it in another project', async () => {
    await useCase.createExampleItem({ projectId: alpha.id!, name: 'Widget' })

    await expect(useCase.createExampleItem({ projectId: alpha.id!, name: 'Widget' })).rejects.toMatchObject({ status: 409 })
    await expect(useCase.createExampleItem({ projectId: alpha.id!, name: 'Widget' })).rejects.toBeInstanceOf(GenericException)
    await expect(useCase.createExampleItem({ projectId: beta.id!, name: 'Widget' })).resolves.toMatchObject({ projectId: beta.id })
  })

  it('lists only the requested project items', async () => {
    await useCase.createExampleItem({ projectId: alpha.id!, name: 'A1' })
    await useCase.createExampleItem({ projectId: beta.id!, name: 'B1' })

    const result = await useCase.getExampleItems({ projectId: beta.id! })

    expect(result.data.map((item) => item.name)).toEqual(['B1'])
  })

  it('updates only the supplied fields and blocks a rename onto an existing name of the same project', async () => {
    const first = await useCase.createExampleItem({ projectId: alpha.id!, name: 'A', description: 'keep' })
    await useCase.createExampleItem({ projectId: alpha.id!, name: 'B' })
    await useCase.createExampleItem({ projectId: beta.id!, name: 'C' })

    const updated = await useCase.updateExampleItem(first.id!, { isActive: false })
    expect(updated).toMatchObject({ name: 'A', description: 'keep', isActive: false, projectId: alpha.id })

    await expect(useCase.updateExampleItem(first.id!, { name: 'B' })).rejects.toMatchObject({ status: 409 })
    await expect(useCase.updateExampleItem(first.id!, { name: 'C' })).resolves.toMatchObject({ name: 'C' })
    await expect(useCase.updateExampleItem(first.id!, { name: 'C' })).resolves.toBeDefined()
  })

  it('soft-deletes: the item disappears from reads and its name becomes reusable', async () => {
    const item = await useCase.createExampleItem({ projectId: alpha.id!, name: 'Widget' })

    await useCase.deleteExampleItem(item.id!)

    await expect(useCase.getExampleItemById(item.id!)).rejects.toMatchObject({ status: 404 })
    expect((await useCase.getExampleItems({ projectId: alpha.id! })).data).toHaveLength(0)
    await expect(useCase.createExampleItem({ projectId: alpha.id!, name: 'Widget' })).resolves.toBeDefined()
    expect(repo.rows).toHaveLength(2)
  })

  it('answers 404 for an unknown item', async () => {
    await expect(useCase.getExampleItemById(fakeId(99))).rejects.toMatchObject({ status: 404, errorCode: 'EXAMPLE_ITEM_001' })
    await expect(useCase.updateExampleItem(fakeId(99), { name: 'X' })).rejects.toMatchObject({ status: 404 })
    await expect(useCase.deleteExampleItem(fakeId(99))).rejects.toMatchObject({ status: 404 })
  })
})
