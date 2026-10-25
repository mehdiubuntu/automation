import { ExampleItem } from '@domain/example-item/aggregate/example-item.aggregate'
import { ExampleItemOrmEntity } from '@infrastructure/database/example-item/orm-entity/example-item.orm.entity'

export class ExampleItemMapper {
  static toDomain(entity: ExampleItemOrmEntity): ExampleItem {
    return ExampleItem.restore(entity.id, entity.projectId, entity.name, entity.description, entity.isActive)
  }

  /** Only defined fields are copied, so the result doubles as a partial-update payload. */
  static toOrm(item: ExampleItem): ExampleItemOrmEntity {
    const primitives = item.toPrimitives()
    const ormEntity = new ExampleItemOrmEntity()

    if (primitives.id !== undefined) ormEntity.id = primitives.id
    if (primitives.projectId !== undefined) ormEntity.projectId = primitives.projectId
    if (primitives.name !== undefined) ormEntity.name = primitives.name
    if (primitives.description !== undefined) ormEntity.description = primitives.description
    if (primitives.isActive !== undefined) ormEntity.isActive = primitives.isActive

    return ormEntity
  }
}
