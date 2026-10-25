export interface IBaseRepository<T> {
  save(entity: T): Promise<T>
  findOne(where: unknown): Promise<T | null>
  update(where: unknown, entity: T): Promise<T | null>
  delete(where: unknown): Promise<number | null | undefined>
}
