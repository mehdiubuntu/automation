import { OutboxMessage } from '@domain/outbox/aggregate/outbox-message.aggregate'
import { OutboxAggregateType, OutboxEventType, OutboxStatus } from '@domain/outbox/enum/outbox.enum'

describe('OutboxMessage', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')

  it('starts PENDING with zero retries and due immediately', () => {
    const message = OutboxMessage.emailVerificationOtp({ email: 'a@example.test', code: '123456', expiresInMinutes: 10 }, now)

    expect(message).toMatchObject({
      aggregateType: OutboxAggregateType.EMAIL,
      eventType: OutboxEventType.SEND_EMAIL_VERIFICATION_OTP,
      status: OutboxStatus.PENDING,
      retryCount: 0,
      nextAttemptAt: now,
    })
  })

  it('backs off exponentially: 30s, 60s, 120s', () => {
    const message = OutboxMessage.passwordResetOtp({ email: 'a@example.test', code: '123456', expiresInMinutes: 10 }, now)

    const delays = [0, 1, 2].map((retryCount) => {
      message.retryCount = retryCount
      return message.nextRetryAt(now).getTime() - now.getTime()
    })

    expect(delays).toEqual([30_000, 60_000, 120_000])
  })

  it('reports exhausted retries once attempts reach the cap', () => {
    const message = OutboxMessage.passwordResetOtp({ email: 'a@example.test', code: '123456', expiresInMinutes: 10 }, now)

    message.retryCount = 1
    expect(message.hasExhaustedRetries(3)).toBe(false)
    message.retryCount = 2
    expect(message.hasExhaustedRetries(3)).toBe(true)
  })

  it('remembers which handlers already succeeded so a retry skips them', () => {
    const message = OutboxMessage.emailVerificationOtp({ email: 'a@example.test', code: '123456', expiresInMinutes: 10 }, now)

    expect(message.hasBeenHandledBy('email')).toBe(false)
    message.recordHandledBy('email')
    expect(message.hasBeenHandledBy('email')).toBe(true)
    expect(message.hasBeenHandledBy('other')).toBe(false)
  })

  it('never exposes the payload (it can hold secrets) in the operational view', () => {
    const message = OutboxMessage.passwordResetOtp({ email: 'a@example.test', code: '987654', expiresInMinutes: 10 }, now)

    expect(JSON.stringify(message.toOperationalView())).not.toContain('987654')
  })

  it('drops the OTP code from the payload kept after delivery', () => {
    const message = OutboxMessage.passwordResetOtp({ email: 'a@example.test', code: '987654', expiresInMinutes: 10 }, now)

    expect(JSON.stringify(message.redactedPayload())).not.toContain('987654')
  })
})
