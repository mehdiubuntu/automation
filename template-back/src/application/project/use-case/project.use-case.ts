import { ICreateProjectInput, IGetProjectsPaginateInput, IUpdateProjectInput } from '@application/project/interface/project.input.interface'
import { Project, PROJECT_CODE_MAX_LENGTH, PROJECT_CODE_PATTERN, slugifyProjectCode } from '@domain/project/aggregate/project.aggregate'
import { PROJECT_REPOSITORY_TOKEN, type IProjectRepository } from '@domain/project/repository/project.repository'
import { GenericException } from '@domain/shared/error/base-http.exception'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { type UnitOfWork, UNIT_OF_WORK_TOKEN } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { Inject, Injectable } from '@nestjs/common'

/** Flat projects. Writes are restricted to SUPERADMIN at the controller; reads are open to every active user. */
@Injectable()
export class ProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY_TOKEN)
    private readonly projectRepository: IProjectRepository,
    @Inject(UNIT_OF_WORK_TOKEN)
    private readonly uow: UnitOfWork
  ) {}

  async createProject(input: ICreateProjectInput): Promise<Project> {
    const name = input.name.trim()
    const code = this.resolveCode(input.code, name)
    await this.assertNameAvailable(name)
    await this.assertCodeAvailable(code)
    return this.uow.execute(() => this.projectRepository.insertOne(Project.create({ name, code, description: input.description?.trim() || null, isActive: true })))
  }

  async getProjects(input: IGetProjectsPaginateInput): Promise<IPaginatedResponse<Project>> {
    return this.projectRepository.findProjects(input)
  }

  async getProjectById(id: string): Promise<Project> {
    return this.mustGetProject(id)
  }

  async updateProject(id: string, input: IUpdateProjectInput): Promise<Project> {
    const current = await this.mustGetProject(id)
    const name = input.name?.trim()
    if (name !== undefined && name !== current.name) {
      await this.assertNameAvailable(name)
    }
    const description = input.description === undefined ? undefined : input.description.trim() || null
    const updated = await this.uow.execute(() => this.projectRepository.updateById(id, Project.create({ name, description, isActive: input.isActive })))
    if (!updated) {
      throw new GenericException('Project not found.', 404, 'PROJECT', 'PROJECT_001')
    }
    return updated
  }

  async deleteProject(id: string): Promise<void> {
    await this.mustGetProject(id)
    await this.uow.execute(() => this.projectRepository.softDeleteById(id))
  }

  /** The code is immutable after creation; it is either supplied (normalised) or derived from the name. */
  private resolveCode(supplied: string | undefined, name: string): string {
    const code = slugifyProjectCode(supplied?.trim() || name)
    if (!code || code.length > PROJECT_CODE_MAX_LENGTH || !PROJECT_CODE_PATTERN.test(code)) {
      throw new GenericException('A project code could not be derived; provide one using letters, digits, dashes or underscores.', 400, 'PROJECT', 'PROJECT_004')
    }
    return code
  }

  private async mustGetProject(id: string): Promise<Project> {
    const project = await this.projectRepository.findById(id)
    if (!project) {
      throw new GenericException('Project not found.', 404, 'PROJECT', 'PROJECT_001')
    }
    return project
  }

  private async assertNameAvailable(name: string): Promise<void> {
    if (await this.projectRepository.findByName(name)) {
      throw new GenericException('A project with this name already exists.', 409, 'PROJECT', 'PROJECT_002')
    }
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    if (await this.projectRepository.findByCode(code)) {
      throw new GenericException('A project with this code already exists.', 409, 'PROJECT', 'PROJECT_003')
    }
  }
}
