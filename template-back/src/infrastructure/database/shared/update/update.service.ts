import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm'
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'

type UpdateAndReturn<T extends ObjectLiteral> = {
  repository: Repository<T>
  where: FindOptionsWhere<T>
  data: QueryDeepPartialEntity<T>
}

export async function updateAndReturn<T extends ObjectLiteral>(params: UpdateAndReturn<T>): Promise<T | null> {
  const { repository, where, data } = params

  const qb = repository.createQueryBuilder().update(repository.target).set(data).where(where).returning('*') // PostgreSQL

  const result = await qb.execute()

  if (!result.raw?.length) {
    return null
  }

  return repository.create(result.raw[0] as T)
}
