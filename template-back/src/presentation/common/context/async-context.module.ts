import { Module } from '@nestjs/common'
import { AsyncContextService } from '@presentation/common/context/async-context.service'

@Module({
  providers: [AsyncContextService],
  exports: [AsyncContextService],
})
export class AsyncContextModule {}
