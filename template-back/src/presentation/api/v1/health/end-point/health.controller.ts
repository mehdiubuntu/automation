import { HealthUseCase } from '@application/health/use-case/health.use-case'
import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

/** Deliberately public (no guards) — the deploy healthcheck and edge probes hit it unauthenticated. */
@ApiTags('Health')
@Controller('v1/health')
export class HealthEndPoint {
  constructor(private readonly healthUseCase: HealthUseCase) {}

  @ApiOperation({ summary: 'Liveness/readiness: database, redis and outbox backlog' })
  @Get()
  async getHealth() {
    return await this.healthUseCase.getHealth()
  }
}
