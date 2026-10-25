import { fakeId } from '@application/shared/testing/fake-id'
import { ProjectUseCase } from '@application/project/use-case/project.use-case'
import { InMemoryProjectRepository } from '@application/project/testing/in-memory-project.repository'
import { slugifyProjectCode } from '@domain/project/aggregate/project.aggregate'
import { GenericException } from '@domain/shared/error/base-http.exception'
import { UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'

const passthroughUow: UnitOfWork = { execute: <T>(work: () => Promise<T>) => work() }

describe('slugifyProjectCode', () => {
  it.each([
    ['Website redesign', 'WEBSITE-REDESIGN'],
    ['  Café & Co!  ', 'CAFE-CO'],
    ['web_app 2', 'WEB-APP-2'],
    ['***', ''],
  ])('%s -> %s', (source, expected) => {
    expect(slugifyProjectCode(source)).toBe(expected)
  })

  it('caps the length at 32 without a trailing dash', () => {
    const code = slugifyProjectCode('a'.repeat(31) + ' b')
    expect(code.length).toBeLessThanOrEqual(32)
    expect(code.endsWith('-')).toBe(false)
  })
})

describe('ProjectUseCase', () => {
  let repo: InMemoryProjectRepository
  let useCase: ProjectUseCase

  beforeEach(() => {
    repo = new InMemoryProjectRepository()
    useCase = new ProjectUseCase(repo, passthroughUow)
  })

  it('creates an active project and derives an uppercase code from the name', async () => {
    const project = await useCase.createProject({ name: '  Website redesign ', description: ' pitch ' })

    expect(project).toMatchObject({ name: 'Website redesign', code: 'WEBSITE-REDESIGN', description: 'pitch', isActive: true })
  })

  it('normalises a supplied code to an uppercase slug', async () => {
    const project = await useCase.createProject({ name: 'Alpha', code: 'alpha 1' })

    expect(project.code).toBe('ALPHA-1')
  })

  it('rejects duplicate names (409) and duplicate codes (409)', async () => {
    await useCase.createProject({ name: 'Alpha' })

    await expect(useCase.createProject({ name: 'Alpha', code: 'OTHER' })).rejects.toMatchObject({ status: 409, errorCode: 'PROJECT_002' })
    await expect(useCase.createProject({ name: 'Beta', code: 'alpha' })).rejects.toMatchObject({ status: 409, errorCode: 'PROJECT_003' })
    await expect(useCase.createProject({ name: 'Beta', code: 'alpha' })).rejects.toBeInstanceOf(GenericException)
  })

  it('refuses a name that yields no usable code unless one is supplied', async () => {
    await expect(useCase.createProject({ name: '***' })).rejects.toMatchObject({ status: 400, errorCode: 'PROJECT_004' })
    await expect(useCase.createProject({ name: '***', code: 'STARS' })).resolves.toMatchObject({ code: 'STARS' })
  })

  it('updates only the supplied fields, never the code, and blocks a rename onto another project', async () => {
    const alpha = await useCase.createProject({ name: 'Alpha', description: 'keep' })
    await useCase.createProject({ name: 'Beta' })

    const updated = await useCase.updateProject(alpha.id!, { isActive: false })
    expect(updated).toMatchObject({ name: 'Alpha', code: 'ALPHA', description: 'keep', isActive: false })

    await expect(useCase.updateProject(alpha.id!, { name: 'Beta' })).rejects.toMatchObject({ status: 409, errorCode: 'PROJECT_002' })
    await expect(useCase.updateProject(alpha.id!, { name: 'Alpha' })).resolves.toBeDefined()
  })

  it('answers 404 for unknown ids', async () => {
    await expect(useCase.getProjectById(fakeId(99))).rejects.toMatchObject({ status: 404, errorCode: 'PROJECT_001' })
    await expect(useCase.updateProject(fakeId(99), { name: 'X' })).rejects.toMatchObject({ status: 404 })
    await expect(useCase.deleteProject(fakeId(99))).rejects.toMatchObject({ status: 404 })
  })

  it('soft-deletes: the project disappears and its name and code become reusable', async () => {
    const alpha = await useCase.createProject({ name: 'Alpha' })

    await useCase.deleteProject(alpha.id!)

    await expect(useCase.getProjectById(alpha.id!)).rejects.toMatchObject({ status: 404 })
    expect((await useCase.getProjects({})).data).toHaveLength(0)
    await expect(useCase.createProject({ name: 'Alpha' })).resolves.toBeDefined()
    expect(repo.rows).toHaveLength(2)
  })
})
