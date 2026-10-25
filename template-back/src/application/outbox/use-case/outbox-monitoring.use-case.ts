import { IGetOutboxMessagesPaginateInput } from '@application/outbox/interface/get-outbox-messages-paginate.input.interface'
import { AuthUser } from '@domain/auth/type/auth-user.type'
import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OUTBOX_DELIVERY_CONFIG } from '@domain/outbox/constant/outbox-delivery.constant'
import { OutboxStatus } from '@domain/outbox/enum/outbox.enum'
import { OUTBOX_REPOSITORY_TOKEN, type IOutboxRepository, OutboxHealthCounts, OutboxProblemBreakdown } from '@domain/outbox/repository/outbox.repository'
import { GenericException } from '@domain/shared/error/base-http.exception'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { Inject, Injectable, Logger } from '@nestjs/common'

type OutboxMessageView = ReturnType<OutboxMessage['toOperationalView']>

export interface OutboxHealthView {
  counts: OutboxHealthCounts
  problems: OutboxProblemBreakdown[]
  config: typeof OUTBOX_DELIVERY_CONFIG
}

export interface IBulkRetryOutboxInput {
  ids: string[]
}

export interface IBulkRetryOutboxResult {
  requested: number
  retried: number
  skipped: number
}

/** Retry applies only to messages that have failed permanently or been withdrawn (BR25.1). */
const RETRYABLE_STATUSES = [OutboxStatus.FAILED, OutboxStatus.CANCELLED]
const MAX_BULK_RETRY = 1000

/**
 * Operational surface over the outbox table. Always serves the payload-free
 * projection — payloads carry secrets (OTP codes) and never
 * leave through a read endpoint.
 *
 * The console never sends anything itself: retry and cancel only move a row's
 * state, and the ordinary dispatcher remains the single delivery path. There is
 * deliberately no "resend" — our messages reference business records whose own
 * state governs delivery, so copying one would produce a message that silently
 * does nothing (BR25.5); the originating business function must compose afresh.
 */
@Injectable()
export class OutboxMonitoringUseCase {
  private readonly logger = new Logger(OutboxMonitoringUseCase.name)

  constructor(
    @Inject(OUTBOX_REPOSITORY_TOKEN)
    private readonly outboxRepository: IOutboxRepository
  ) {}

  async getOutboxMessages(input: IGetOutboxMessagesPaginateInput): Promise<IPaginatedResponse<OutboxMessageView>> {
    const result = await this.outboxRepository.findMessages(input)
    return {
      data: result.data.map((message) => message.toOperationalView()),
      meta: result.meta,
    }
  }

  async getOutboxMessageById(id: string): Promise<OutboxMessageView> {
    return (await this.mustGetMessage(id)).toOperationalView()
  }

  /**
   * Queue health plus the delivery rules in force. Every figure comes from two
   * aggregate queries, so the console can refresh often without scanning the
   * ever-growing published record set.
   */
  async getOutboxHealth(): Promise<OutboxHealthView> {
    const now = new Date()
    const [counts, problems] = await Promise.all([
      this.outboxRepository.countHealth(now, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      this.outboxRepository.countProblemsByEventType(),
    ])
    return { counts, problems, config: OUTBOX_DELIVERY_CONFIG }
  }

  /**
   * Returns a failed or withdrawn message to the queue with a fresh attempt
   * allowance. A delivered message is never retried — that would be a resend,
   * and this system deliberately has no resend (see the class docblock).
   */
  async retryOutboxMessage(currentUser: AuthUser, id: string): Promise<OutboxMessageView> {
    const message = await this.mustGetMessage(id)
    const applied = await this.outboxRepository.transitionWhileInStatus(id, RETRYABLE_STATUSES, {
      status: OutboxStatus.PENDING,
      retryCount: 0,
      nextAttemptAt: new Date(),
    })

    if (!applied) {
      throw new GenericException(`Only failed or cancelled messages can be retried. This message is ${message.status}.`, 409, 'OUTBOX', 'OUTBOX_002')
    }

    this.logger.log(`Outbox message ${id} returned to the queue by user ${currentUser.userId}`)
    return (await this.mustGetMessage(id)).toOperationalView()
  }

  /**
   * Withdraws a message that has not yet been claimed. A message already in
   * delivery is beyond recall, and a settled one is terminal — both are refused
   * rather than silently ignored.
   */
  async cancelOutboxMessage(currentUser: AuthUser, id: string): Promise<OutboxMessageView> {
    const message = await this.mustGetMessage(id)
    const applied = await this.outboxRepository.transitionWhileInStatus(id, [OutboxStatus.PENDING], { status: OutboxStatus.CANCELLED })

    if (!applied) {
      throw new GenericException(`Only messages still awaiting delivery can be cancelled. This message is ${message.status}.`, 409, 'OUTBOX', 'OUTBOX_003')
    }

    this.logger.log(`Outbox message ${id} cancelled by user ${currentUser.userId}`)
    return (await this.mustGetMessage(id)).toOperationalView()
  }

  /** Ineligible messages are skipped and counted, never failing the whole action. */
  async bulkRetryOutboxMessages(currentUser: AuthUser, input: IBulkRetryOutboxInput): Promise<IBulkRetryOutboxResult> {
    if (input.ids.length === 0 || input.ids.length > MAX_BULK_RETRY) {
      throw new GenericException(`Select between 1 and ${MAX_BULK_RETRY} messages.`, 400, 'OUTBOX', 'OUTBOX_004')
    }

    const retriedIds = await this.outboxRepository.retryManyWhileInStatus(input.ids, RETRYABLE_STATUSES, new Date())
    this.logger.log(`Outbox bulk retry by user ${currentUser.userId}: ${retriedIds.length}/${input.ids.length} returned to the queue`)

    return { requested: input.ids.length, retried: retriedIds.length, skipped: input.ids.length - retriedIds.length }
  }

  private async mustGetMessage(id: string): Promise<OutboxMessage> {
    const message = await this.outboxRepository.findById(id)
    if (!message) {
      throw new GenericException('Outbox message not found.', 404, 'OUTBOX', 'OUTBOX_001')
    }
    return message
  }
}
