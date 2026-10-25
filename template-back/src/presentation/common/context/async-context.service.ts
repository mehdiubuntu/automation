import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'async_hooks'

export interface RequestContext {
  correlationId: string
  requestIp?: string
}

@Injectable()
export class AsyncContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>()

  getStore(): RequestContext | undefined {
    return this.als.getStore()
  }

  run<T>(store: RequestContext, callback: () => T): T {
    return this.als.run(store, callback)
  }

  getCorrelationId(): string | undefined {
    return this.getStore()?.correlationId
  }

  getRequestContext(): RequestContext | undefined {
    return this.getStore()
  }
}
