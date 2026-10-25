import { ICreateExampleItemInput, IGetExampleItemsPaginateInput, IUpdateExampleItemInput } from '@application/example-item/interface/example-item.input.interface'
import { ExampleItem } from '@domain/example-item/aggregate/example-item.aggregate'
import { EXAMPLE_ITEM_REPOSITORY_TOKEN, type IExampleItemRepository } from '@domain/example-item/repository/example-item.repository'
import { PROJECT_REPOSITORY_TOKEN, type IProjectRepository } from '@domain/project/repository/project.repository'
import { GenericException } from '@domain/shared/error/base-http.exception'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { type UnitOfWork, UNIT_OF_WORK_TOKEN } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { Inject, Injectable } from '@nestjs/common'

/**
 * Copy-me reference for a project-scoped feature. The project is always passed explicitly (body on
 * create, query on list) and checked to exist and be active before anything is read or written;
 * a row is owned by its project forever (projectId is never updatable). Every active user may work
 * on any project, so there is no per-project membership check.
 */
@Injectable()
export class ExampleItemUseCase {
  constructor(
    @Inject(EXAMPLE_ITEM_REPOSITORY_TOKEN)
    private readonly exampleItemRepository: IExampleItemRepository,
    @Inject(PROJECT_REPOSITORY_TOKEN)
    private readonly projectRepository: IProjectRepository,
    @Inject(UNIT_OF_WORK_TOKEN)
    private readonly uow: UnitOfWork
  ) {}

  async createExampleItem(input: ICreateExampleItemInput): Promise<ExampleItem> {
    await this.assertProjectUsable(input.projectId)
    const name = input.name.trim()
    await this.assertNameAvailable(input.projectId, name)
    return this.uow.execute(() =>
      this.exampleItemRepository.insertOne(ExampleItem.create({ projectId: input.projectId, name, description: input.description?.trim() || null, isActive: true }))
    )
  }

  async getExampleItems(input: IGetExampleItemsPaginateInput): Promise<IPaginatedResponse<ExampleItem>> {
    await this.assertProjectUsable(input.projectId)
    return this.exampleItemRepository.findExampleItems(input)
  }

  async getExampleItemById(id: string): Promise<ExampleItem> {
    return this.mustGetExampleItem(id)
  }

  async updateExampleItem(id: string, input: IUpdateExampleItemInput): Promise<ExampleItem> {
    const current = await this.mustGetExampleItem(id)
    const name = input.name?.trim()
    if (name !== undefined && name !== current.name) {
      await this.assertNameAvailable(current.projectId!, name)
    }
    const description = input.description === undefined ? undefined : input.description.trim() || null
    const updated = await this.uow.execute(() => this.exampleItemRepository.updateById(id, ExampleItem.create({ name, description, isActive: input.isActive })))
    if (!updated) {
      throw new GenericException('Example item not found.', 404, 'EXAMPLE_ITEM', 'EXAMPLE_ITEM_001')
    }
    return updated
  }

  async deleteExampleItem(id: string): Promise<void> {
    await this.mustGetExampleItem(id)
    await this.uow.execute(() => this.exampleItemRepository.softDeleteById(id))
  }

  private async assertProjectUsable(projectId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId)
    if (!project) {
      throw new GenericException('Project not found.', 404, 'PROJECT', 'PROJECT_001')
    }
    if (!project.isActive) {
      throw new GenericException('The project is not active.', 409, 'PROJECT', 'PROJECT_005')
    }
  }

  private async mustGetExampleItem(id: string): Promise<ExampleItem> {
    const item = await this.exampleItemRepository.findById(id)
    if (!item) {
      throw new GenericException('Example item not found.', 404, 'EXAMPLE_ITEM', 'EXAMPLE_ITEM_001')
    }
    return item
  }

  private async assertNameAvailable(projectId: string, name: string): Promise<void> {
    if (await this.exampleItemRepository.findByNameInProject(projectId, name)) {
      throw new GenericException('An example item with this name already exists in the project.', 409, 'EXAMPLE_ITEM', 'EXAMPLE_ITEM_002')
    }
  }
}
