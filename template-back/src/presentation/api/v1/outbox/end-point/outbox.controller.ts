import { OutboxMonitoringUseCase } from '@application/outbox/use-case/outbox-monitoring.use-case'
import type { AuthUser } from '@domain/auth/type/auth-user.type'
import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { BulkRetryOutboxDto, GetOutboxMessagesPaginateDto } from '@presentation/api/v1/outbox/dto/get-outbox-messages-paginate.dto'
import { CurrentUser } from '@presentation/common/decorators/current-user.decorator'
import { IdDto } from '@presentation/common/dto/id.dto'
import { AuthGuard } from '@presentation/common/guards/auth.guard'
import { RolesGuard } from '@presentation/common/guards/roles.guard'
import { Roles } from '@presentation/common/decorators/roles.decorator'
import { UserRole } from '@domain/user/enum/user.enum'

@ApiTags('Outbox')
@Controller('v1/outbox')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class OutboxEndPoint {
  constructor(private readonly outboxMonitoringUseCase: OutboxMonitoringUseCase) {}

  @ApiOperation({
    summary: 'Get the list of outbox messages',
    description: 'Operational view only — message payloads are never exposed (they carry OTP codes).',
  })
  @Get('get-outbox-messages')
  async getOutboxMessages(@Query() getOutboxMessagesPaginateDto: GetOutboxMessagesPaginateDto) {
    return await this.outboxMonitoringUseCase.getOutboxMessages(getOutboxMessagesPaginateDto)
  }

  @ApiOperation({
    summary: 'Queue health and the delivery rules in force',
    description:
      'Counts by state plus "retrying" (pending AND already attempted — the key health signal), work due now, 24h volume, ' +
      'and a problem breakdown by event type so a channel-wide fault is distinguishable from a general one. ' +
      'Deliberately cheap: nothing here scans the whole published record set.',
  })
  @Get('get-outbox-health')
  async getOutboxHealth() {
    return await this.outboxMonitoringUseCase.getOutboxHealth()
  }

  @ApiOperation({
    summary: 'Get an outbox message',
  })
  @Get('get-outbox-message/:id')
  async getOutboxMessage(@Param() params: IdDto) {
    return await this.outboxMonitoringUseCase.getOutboxMessageById(params.id)
  }

  @ApiOperation({
    summary: 'Return a failed or cancelled message to the queue',
    description:
      'Restores it with a fresh attempt allowance. Conditional on the message still being failed or cancelled, ' +
      'so a message the dispatcher claims at the same moment is simply not affected (409). Delivered messages are never retried.',
  })
  @Put('retry-outbox-message/:id')
  async retryOutboxMessage(@Param() params: IdDto, @CurrentUser() user: AuthUser) {
    return await this.outboxMonitoringUseCase.retryOutboxMessage(user, params.id)
  }

  @ApiOperation({
    summary: 'Return many failed or cancelled messages to the queue',
    description: 'Up to 1000 per action. Ineligible messages are skipped rather than failing the request; the response reports requested/retried/skipped.',
  })
  @Put('bulk-retry-outbox-messages')
  async bulkRetryOutboxMessages(@Body() bulkRetryOutboxDto: BulkRetryOutboxDto, @CurrentUser() user: AuthUser) {
    return await this.outboxMonitoringUseCase.bulkRetryOutboxMessages(user, bulkRetryOutboxDto)
  }

  @ApiOperation({
    summary: 'Withdraw a message before delivery',
    description:
      'Only messages still awaiting delivery can be cancelled — one already in delivery is beyond recall and a settled one is terminal (both 409). ' +
      'A cancelled message can later be retried. Separate from retry because withdrawing is a distinct risk from re-delivering.',
  })
  @Put('cancel-outbox-message/:id')
  async cancelOutboxMessage(@Param() params: IdDto, @CurrentUser() user: AuthUser) {
    return await this.outboxMonitoringUseCase.cancelOutboxMessage(user, params.id)
  }
}
