import { UnitOfWork } from '@domain/shared/unit-of-work/unit-of-work.interface'
import { Injectable } from '@nestjs/common'
import { runInTransaction } from 'typeorm-transactional'

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  async execute<T>(work: () => Promise<T>): Promise<T> {
    // runInTransaction publishes the transactional EntityManager to CLS, so injected
    // repositories inside `work` actually join the transaction (dataSource.transaction did not).
    return runInTransaction(work)
  }
}
