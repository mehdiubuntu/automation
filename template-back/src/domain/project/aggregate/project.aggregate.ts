export const PROJECT_CODE_MAX_LENGTH = 32
export const PROJECT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/

/** Uppercase slug: accents stripped, every run of other characters becomes one dash. Empty when nothing usable is left. */
export function slugifyProjectCode(source: string): string {
  return source
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PROJECT_CODE_MAX_LENGTH)
    .replace(/-+$/g, '')
}

/** Flat (non-tenant) project that work items hang off. Fields are optional so the class doubles as a partial-update carrier. */
export class Project {
  constructor(
    public id?: string,
    public name?: string,
    public code?: string,
    public description?: string | null,
    public isActive?: boolean,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {}

  static create(props: { id?: string; name?: string; code?: string; description?: string | null; isActive?: boolean }): Project {
    return new Project(props.id, props.name, props.code, props.description, props.isActive)
  }

  static restore(id: string, name: string, code: string, description: string | null, isActive: boolean, createdAt: Date, updatedAt: Date): Project {
    return new Project(id, name, code, description, isActive, createdAt, updatedAt)
  }

  toPrimitives() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      description: this.description,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
