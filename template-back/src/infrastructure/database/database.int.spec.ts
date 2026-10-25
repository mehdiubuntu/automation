import { ENGINES } from '@engines/index'
import { applyMigrations, discoverMigrations, pendingMigrations } from '@infrastructure/database/migrator'
import { ProjectOrmEntity } from '@infrastructure/database/project/orm-entity/project.orm.entity'
import { createTestDatabase, describeWithDatabase, TestDatabase } from '@infrastructure/database/testing/test-database'
import { UserOrmEntity } from '@infrastructure/database/user/orm-entity/user.orm.entity'
import { DataSource } from 'typeorm'

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const files = discoverMigrations(ENGINES.map((engine) => engine.id))

describeWithDatabase('database (real PostgreSQL)', () => {
  let db: TestDatabase
  let dataSource: DataSource

  beforeAll(async () => {
    db = await createTestDatabase()
    dataSource = await db.connect(true)
  })
  afterAll(() => db.drop())

  it('applies the core, jobs and every engine migration to an empty database', async () => {
    expect(await pendingMigrations(dataSource, files)).toHaveLength(files.length)

    const applied = await applyMigrations(dataSource, files)

    expect(applied).toEqual(files.map((file) => `${file.owner}/${file.name}`))
    expect(applied).toEqual(expect.arrayContaining(['core/0001_init.sql', 'jobs/0001_init.sql', 'audit/0001_init.sql', 'keyword/0001_init.sql', 'content/0001_init.sql']))
    const schemas = await dataSource.query<Array<{ schema_name: string }>>(`SELECT schema_name FROM information_schema.schemata`)
    expect(schemas.map((row) => row.schema_name)).toEqual(expect.arrayContaining(['platform', 'jobs', 'audit', 'keyword', 'content']))
    expect(await pendingMigrations(dataSource, files)).toEqual([])
  })

  it('is idempotent: a second run applies nothing', async () => {
    expect(await applyMigrations(dataSource, files)).toEqual([])
  })

  it('refuses a migration that was edited after it was applied', async () => {
    const edited = files.map((file, index) => (index === 0 ? { ...file, checksum: 'changed' } : file))

    await expect(applyMigrations(dataSource, edited)).rejects.toThrow('was changed after it was applied')
  })

  it('keeps the ORM entities and the SQL migrations in step (no pending schema difference)', async () => {
    const difference = await dataSource.driver.createSchemaBuilder().log()

    expect(difference.upQueries.map((query) => query.query)).toEqual([])
  })

  it('lets Postgres generate time-ordered UUIDv7 ids', async () => {
    const projects = dataSource.getRepository(ProjectOrmEntity)
    const saved: ProjectOrmEntity[] = []
    for (const name of ['Alpha', 'Beta', 'Gamma']) saved.push(await projects.save(projects.create({ name, code: name.toUpperCase(), description: null, isActive: true })))

    for (const row of saved) expect(row.id).toMatch(UUID_V7)
    expect(saved.map((row) => row.id)).toEqual([...saved.map((row) => row.id)].sort())
  })

  it('stores a user with a generated id and the foreign key to projects holds', async () => {
    const users = dataSource.getRepository(UserOrmEntity)
    const user = await users.save(
      users.create({
        email: 'ada@example.test',
        password: 'hash',
        role: 1,
        status: 1,
        emailVerifiedAt: null,
        lockedUntil: null,
        lastLoginAt: null,
        failedLoginAttempts: 0,
      })
    )
    expect(user.id).toMatch(UUID_V7)

    await expect(
      dataSource.query(`INSERT INTO "platform"."ExampleItem" ("projectId", "name") VALUES ('00000000-0000-7000-8000-000000000001', 'orphan')`)
    ).rejects.toThrow(/foreign key/i)
  })

  it('serialises concurrent migrators: two processes booting together apply each file exactly once', async () => {
    const fresh = await createTestDatabase()
    try {
      const [first, second] = await Promise.all([fresh.connect(), fresh.connect()])
      const [a, b] = await Promise.all([applyMigrations(first, files), applyMigrations(second, files)])

      expect(a.length + b.length).toBe(files.length)
      expect([...a, ...b].sort()).toEqual(files.map((file) => `${file.owner}/${file.name}`).sort())
    } finally {
      await fresh.drop()
    }
  })

  it('rolls a failing migration back completely and reports which file failed', async () => {
    const fresh = await createTestDatabase()
    try {
      const source = await fresh.connect()
      const broken = [{ owner: 'core', schema: 'platform', name: '0001_broken.sql', sql: 'CREATE TABLE half_done (id int); SELECT * FROM missing_table;', checksum: 'x' }]

      await expect(applyMigrations(source, broken)).rejects.toThrow('core/0001_broken.sql failed')
      const [{ present }] = await source.query<Array<{ present: boolean }>>(`SELECT to_regclass('platform.half_done') IS NOT NULL AS present`)
      expect(present).toBe(false)
    } finally {
      await fresh.drop()
    }
  })
})
