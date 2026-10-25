import { discoverMigrations } from '@infrastructure/database/migrator'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('discoverMigrations', () => {
  let root: string
  const put = (relative: string, sql: string) => {
    const file = join(root, relative)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, sql)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'migrations-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('orders core first, then jobs, then the requested engines alphabetically, and files by name', () => {
    put('engines/zeta/migrations/0001_a.sql', 'CREATE TABLE a (id int);')
    put('engines/alpha/migrations/0002_b.sql', 'CREATE TABLE b (id int);')
    put('engines/alpha/migrations/0001_a.sql', 'CREATE TABLE a (id int);')
    put('infrastructure/jobs/migrations/0001_j.sql', 'SELECT 1;')
    put('infrastructure/database/migrations/0002_c.sql', 'SELECT 2;')
    put('infrastructure/database/migrations/0001_c.sql', 'SELECT 1;')
    put('engines/unused/migrations/0001_a.sql', 'CREATE TABLE u (id int);')

    const found = discoverMigrations(['zeta', 'alpha'], root).map((file) => `${file.owner}/${file.name}@${file.schema}`)

    expect(found).toEqual([
      'core/0001_c.sql@platform',
      'core/0002_c.sql@platform',
      'jobs/0001_j.sql@jobs',
      'alpha/0001_a.sql@alpha',
      'alpha/0002_b.sql@alpha',
      'zeta/0001_a.sql@zeta',
    ])
  })

  it('treats missing folders and non-sql files as nothing to do', () => {
    put('infrastructure/database/migrations/notes.txt', 'ignore me')

    expect(discoverMigrations(['ghost'], root)).toEqual([])
  })

  it('gives a Windows checkout and a Linux build the same checksum', () => {
    put('infrastructure/database/migrations/0001_a.sql', 'SELECT 1;\nSELECT 2;\n')
    const unix = discoverMigrations([], root)[0]
    put('infrastructure/database/migrations/0001_a.sql', 'SELECT 1;\r\nSELECT 2;\r\n')
    const windows = discoverMigrations([], root)[0]

    expect(windows.checksum).toBe(unix.checksum)
    expect(windows.sql).not.toContain('\r')
  })

  it('rejects badly named files and two files with the same number', () => {
    put('infrastructure/database/migrations/create_users.sql', 'SELECT 1;')
    expect(() => discoverMigrations([], root)).toThrow('file names look like 0001_create_things.sql')

    rmSync(join(root, 'infrastructure'), { recursive: true })
    put('infrastructure/database/migrations/0001_a.sql', 'SELECT 1;')
    put('infrastructure/database/migrations/0001_b.sql', 'SELECT 1;')
    expect(() => discoverMigrations([], root)).toThrow('two files share the number 0001')
  })

  it('refuses an engine migration that leaves its own schema, but trusts core and jobs', () => {
    put('engines/audit/migrations/0001_bad.sql', 'CREATE TABLE t (id int REFERENCES platform."User" (id));')
    expect(() => discoverMigrations(['audit'], root)).toThrow('Migration audit/0001_bad.sql: engine SQL may only use its own schema "audit"')

    rmSync(join(root, 'engines'), { recursive: true })
    put('engines/audit/migrations/0001_bad.sql', 'SET search_path TO platform;')
    expect(() => discoverMigrations(['audit'], root)).toThrow('not allowed')

    rmSync(join(root, 'engines'), { recursive: true })
    put('infrastructure/jobs/migrations/0001_ok.sql', 'CREATE TABLE j (id int REFERENCES platform."Project" (id));')
    expect(() => discoverMigrations([], root)).not.toThrow()
  })
})
