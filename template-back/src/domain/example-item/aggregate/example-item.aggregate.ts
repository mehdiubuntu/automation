/**
 * Reference project-scoped aggregate: every row belongs to one Project (`projectId`).
 * Fields are optional so the same class doubles as a partial-update carrier.
 */
export class ExampleItem {
  constructor(
    public id?: string,
    public projectId?: string,
    public name?: string,
    public description?: string | null,
    public isActive?: boolean
  ) {}

  static create(props: { id?: string; projectId?: string; name?: string; description?: string | null; isActive?: boolean }): ExampleItem {
    return new ExampleItem(props.id, props.projectId, props.name, props.description, props.isActive)
  }

  static restore(id?: string, projectId?: string, name?: string, description?: string | null, isActive?: boolean): ExampleItem {
    return new ExampleItem(id, projectId, name, description, isActive)
  }

  toPrimitives() {
    return {
      id: this.id,
      projectId: this.projectId,
      name: this.name,
      description: this.description,
      isActive: this.isActive,
    }
  }
}
