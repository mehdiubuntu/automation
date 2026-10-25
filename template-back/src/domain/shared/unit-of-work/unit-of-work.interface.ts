export const UNIT_OF_WORK_TOKEN = Symbol('UNIT_OF_WORK_TOKEN')
export interface UnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>
}
